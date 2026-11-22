# StudioOS production runbook

## Architecture

- **Web:** nginx-served React SPA; proxies `/api/` to the API service.
- **API:** Express modular monolith; runs migrations separately and serves `/health`, `/health/ready`,
  and `/api/v1`. Swagger UI/OpenAPI routes exist only when `API_DOCS_ENABLED=true`.
- **Worker:** separate process from the same API image; polls the PostgreSQL outbox, sends email
  through Redis/BullMQ, and schedules deadline reminders.
- **PostgreSQL:** source of truth; composite tenant constraints and workflow checks.
- **Redis:** BullMQ queue. Loss of Redis delays email but does not roll back committed data.
- **Object storage:** external S3-compatible bucket for deliverables. Never use the development
  S3 mock in production.

## First deployment

1. Provision PostgreSQL 17, Redis 8, an S3-compatible private bucket, and a TLS reverse proxy/DNS
   entry for the web app.
2. Copy `docker-compose.prod.yml` and `infra/docker/nginx.conf` to the host, plus
   `.env.production.example` → `.env.production`.
3. Fill every placeholder. Generate secrets with `openssl rand -hex 32`. Use the same strong
   password in `POSTGRES_PASSWORD` and the password portion of `DATABASE_URL`; likewise for Redis.
4. Configure S3 CORS:

   ```json
   [
     {
       "AllowedOrigins": ["https://app.example.com"],
       "AllowedMethods": ["GET", "PUT", "HEAD"],
       "AllowedHeaders": ["*"],
       "ExposeHeaders": ["ETag"],
       "MaxAgeSeconds": 3600
     }
   ]
   ```

   The bucket policy should allow only `s3:PutObject`, `s3:GetObject`, and `s3:HeadObject` for the
   application credentials, scoped to the bucket prefix.
5. Log in to GHCR if images are private, then start the stack:

   ```bash
   export API_IMAGE=ghcr.io/org/studioos/api:latest
   export WEB_IMAGE=ghcr.io/org/studioos/web:latest
   docker compose -f docker-compose.prod.yml --env-file .env.production pull
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

   The `migrate` service runs `prisma migrate deploy` before API/worker start. If migrations fail,
   the API/worker do not start.

6. Verify:

   ```bash
   curl -fsS https://app.example.com/health
   curl -fsS https://app.example.com/health/ready
   curl -fsS https://app.example.com/api/v1/openapi.json >/dev/null
   ```

7. Create the first workspace through the public registration page, then remove/disable open
   registration if the deployment should be invite-only (future policy gate).

## Release workflow

`.github/workflows/release.yml` builds and publishes both images to GHCR on `v*` tags or manual
dispatch. Manual dispatch can also deploy to production when these repository/environment secrets
exist:

| Secret | Purpose |
|---|---|
| `DEPLOY_HOST` | SSH hostname |
| `DEPLOY_USER` | SSH user with Docker access |
| `DEPLOY_SSH_KEY` | Private deploy key |
| `DEPLOY_KNOWN_HOSTS` | Pre-pinned host key(s) |
| `DEPLOY_PATH` | Directory containing `docker-compose.prod.yml` and `.env.production` |

The deploy job logs in to GHCR, pulls the exact commit-tagged images, runs the migration service, and
recreates the stack. Rotate the deploy key after staff changes. The host key must be captured out of
band; do not accept an unknown key during deployment.

## Routine operations

### Logs

```bash
docker compose -f docker-compose.prod.yml logs -f api worker web
```

Logs are structured JSON. Cookies, authorization headers, tokens, hashes, email bodies, and signed
URLs are redacted or never logged.

### Health and alerts

- Liveness: `GET /health`
- Readiness: `GET /health/ready` (database + Redis when configured)
- Alert on API 5xx rate, readiness failures, BullMQ failed jobs, and
  `outbox_events.status = 'FAILED'`.
- Set `MONITORING_WEBHOOK_URL` to forward sanitized errors to your collector.

### Queue/outbox recovery

```sql
SELECT status, count(*) FROM outbox_events GROUP BY status;
SELECT id, attempts, last_error FROM outbox_events WHERE status = 'FAILED' ORDER BY updated_at DESC;
```

To retry a failed outbox row after fixing the provider:

```sql
UPDATE outbox_events
SET status = 'PENDING', attempts = 0, last_error = NULL, available_at = now()
WHERE id = '<uuid>';
```

The dispatcher will re-enqueue it. Do not replay already `PROCESSED` rows.

### Scaling

- API is stateless apart from cookie/session DB rows; scale behind the load balancer.
- Worker can scale horizontally; the dispatcher deduplicates queue jobs by outbox ID.
- Move rate limiting to Redis before adding API replicas.
- Queue workers use concurrency 5 per process; tune with provider limits.

### Secret rotation

- `SESSION_SECRET`: rotating invalidates every active session and every pending invitation/reset
  link, and makes existing encrypted outbox emails undecryptable. Drain the outbox before rotating,
  then plan a maintenance window.
- `POSTGRES_PASSWORD` / `REDIS_PASSWORD`: update the database/Redis and `.env.production`
  together, then restart dependent services.
- S3/email/API keys: create new credentials, update `.env.production`, restart API and worker, then
  revoke the old credentials.

## Backup and restore

### Backup

Run at least daily (target RPO 24 hours) from a host with PostgreSQL client tools:

```bash
DATABASE_URL='postgresql://...' \
BACKUP_DIR=/srv/studioos-backups \
BACKUP_RETENTION_DAYS=14 \
./infra/scripts/backup-postgres.sh
```

Or from the running container:

```bash
docker compose -f docker-compose.prod.yml exec -T postgres \
  pg_dump -U studioos -d studio_os -Fc --no-owner --no-acl > studio_os-$(date -u +%Y%m%dT%H%M%SZ).dump
```

Copy backups to encrypted off-host storage and verify checksums. Object storage should have its own
provider-level versioning/retention; database backups do not contain file bytes.

### Restore drill / recovery

Target RTO: 4 hours.

1. Provision a scratch PostgreSQL database and restore there first:

   ```bash
   CONFIRM_RESTORE=yes DATABASE_URL='postgresql://.../studio_os_restore' \
     ./infra/scripts/restore-postgres.sh /srv/studioos-backups/studio_os-....dump
   ```

2. Run `npx prisma migrate deploy --schema apps/api/prisma/schema.prisma` against the restored
   database (the backup may predate the latest migration).
3. Point a staging API at it and verify `/health/ready`, sign-in, a project read, asset download,
   and a workflow transition.
4. For production recovery, stop API and worker, restore into the production database with
   `CONFIRM_RESTORE=yes`, start the `migrate` service, then API/worker. Verify health and a sample
   client portal approval.
5. Record the restore duration and any data loss window in the incident log.

### Rollback

- Application rollback: deploy the previous image tag:

  ```bash
  export API_IMAGE=ghcr.io/org/studioos/api:<previous-sha>
  export WEB_IMAGE=ghcr.io/org/studioos/web:<previous-sha>
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d
  ```

- Database migrations are forward-only. If a release must be rolled back, restore the pre-release
  backup or apply a reviewed compensating migration. Never edit an applied migration.

## Incident checklist

1. Confirm scope: tenant, client, asset, or authentication.
2. Preserve audit logs, API logs, queue/outbox rows, and relevant object-storage access logs.
3. Revoke affected sessions (`DELETE FROM sessions WHERE user_id = ...`) and client memberships if
   needed.
4. Rotate exposed credentials and `SESSION_SECRET` if token exposure is possible.
5. Restore service, verify readiness, and document the timeline and remediation.
6. Add a regression test before closing the incident.

## API documentation

API docs are hidden unless `API_DOCS_ENABLED=true`. Keep them disabled in production unless you
intend to expose the contract; enable temporarily for an authorized review and disable afterward.

- Swagger UI: `/api/docs`
- OpenAPI JSON: `/api/v1/openapi.json`

## Known operational limitations

- The recorded load smoke is a local single-host measurement. Repeat it on production-like
  infrastructure and record results in `docs/performance.md`.
- In-memory rate limiting is single-instance only.
- Session and upload-intent cleanup are lazy; schedule maintenance SQL or a cleanup job.
- The development S3 mock is not durable and must not be deployed.
