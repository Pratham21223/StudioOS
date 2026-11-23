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

### Vercel target

The same images can run on Vercel instead of a Docker host:

- **Web + API:** two Vercel Services built from `infra/docker/Dockerfile.web` and
  `infra/docker/Dockerfile.api`. `vercel.json` routes `/api` and `/health` to the API service and
  everything else to the web service.
- **Worker:** a Vercel Daemon built from the `worker` stage of `infra/docker/Dockerfile.api`
  (`infra/docker/Dockerfile.api#worker`). Daemons run in production only and do not receive
  inbound traffic.
- **PostgreSQL, Redis, and object storage:** external managed services. The `postgres` and `redis`
  services in `docker-compose.prod.yml` are not deployed to Vercel.
- **Migrations:** run once from a trusted machine with `npm run db:deploy:production` before the
  deployment. Vercel containers do not run migrations automatically, because every API instance
  would race.
- **Port:** Vercel routes container traffic to the project `PORT` (`4000`). The web nginx config
  listens on both `80` (compose) and `4000` (Vercel).

## First deployment (Vercel)

1. Provision the external dependencies:

   - PostgreSQL 17 or newer with TLS (Neon, Supabase, RDS, or equivalent).
   - Redis 8 with TLS (Upstash, Redis Cloud, ElastiCache, or equivalent). On Upstash, use a Fixed
     plan for BullMQ; the pay-as-you-go plan bills every queue poll and can become expensive.
   - A private S3-compatible bucket.
   - A Resend account with a verified sending domain.
   - Optional: a monitoring webhook URL.

   The Vercel stack does not run PostgreSQL or Redis containers. Do not point production at the
   development S3 mock or at `localhost`.

2. Log in and link the Vercel project:

   ```bash
   npx vercel login
   npx vercel link
   ```

   `.vercel/project.json` is gitignored. Use the same directory that contains `vercel.json`.

3. Create `.env.production` from the example and fill every placeholder:

   ```bash
   cp .env.production.example .env.production   # skip if the file already exists
   openssl rand -hex 32   # SESSION_SECRET
   ```

   Required values:

   | Variable | Value |
   |---|---|
   | `WEB_ORIGIN` | Final production origin, for example `https://studioos.vercel.app` |
   | `API_BASE_URL` | `${WEB_ORIGIN}/api/v1` |
   | `DATABASE_URL` | Managed PostgreSQL URL with `?sslmode=require` |
   | `DIRECT_DATABASE_URL` | Optional direct (non-pooled) URL for migrations |
   | `REDIS_URL` | Managed Redis URL, preferably `rediss://` |
   | `SESSION_SECRET` | 64 hex characters from `openssl rand -hex 32` |
   | `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | Bucket credentials |
   | `S3_ENDPOINT` | Set for R2/MinIO/Wasabi/Backblaze; leave empty for AWS S3 |
   | `EMAIL_API_KEY`, `EMAIL_FROM` | Resend key and a sender on the verified domain |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` | Optional Google OAuth app; callback is `${API_BASE_URL}/auth/oauth/google/callback` |
   | `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`, `GITHUB_CALLBACK_URL` | Optional GitHub OAuth app; callback is `${API_BASE_URL}/auth/oauth/github/callback` |
   | `VITE_API_URL` | `/api/v1` |
   | `PORT` | `4000` |
   | `TRUST_PROXY` | `true` |

   Use the provider's **pooled** connection string for `DATABASE_URL` when it offers one (Neon
   `-pooler`, Supabase port 6543, and similar). If migrations through the pooler fail, set
   `DIRECT_DATABASE_URL` to the direct URL; `npm run db:deploy:production` prefers it.

   `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `REDIS_PASSWORD`, `API_IMAGE`, `WEB_IMAGE`,
   and `WEB_PORT` are for the compose stack only; `npm run vercel:env` skips them.

4. Configure the S3 bucket. Replace `https://app.example.com` with `WEB_ORIGIN`:

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

   The application calls `HeadBucket` on first upload, so the credentials need `s3:ListBucket` on
   the bucket in addition to object access. A minimal policy for AWS S3:

   ```json
   {
     "Version": "2012-10-17",
     "Statement": [
       {
         "Effect": "Allow",
         "Action": ["s3:ListBucket"],
         "Resource": "arn:aws:s3:::BUCKET"
       },
       {
         "Effect": "Allow",
         "Action": ["s3:PutObject", "s3:GetObject"],
         "Resource": "arn:aws:s3:::BUCKET/*"
       }
     ]
   }
   ```

   `s3:HeadObject` is authorized by `s3:GetObject`. Add `s3:DeleteObject` on `BUCKET/*` only if you
   want the credential check to remove its test object; otherwise configure a lifecycle rule for
   the `_studioos/` prefix. Add `s3:GetBucketCORS` if you want `npm run check:external` to verify
   the CORS rule automatically.

   ### Resend without a custom domain

   Resend is a sending API, not an inbox. Without a verified domain, the only supported sender is
   `onboarding@resend.dev`, and it can only deliver to the email address on the Resend account:

   ```dotenv
   EMAIL_FROM=StudioOS <onboarding@resend.dev>
   ```

   Use that only for a smoke test. It cannot send invitations, password resets, or reminders to
   real users. For production, add a domain or subdomain in Resend → Domains, publish the DNS
   records Resend provides, wait for **Verified**, then set `EMAIL_FROM` to an address on that
   domain. Resend can also receive mail with a verified domain, but this application only needs
   outbound delivery; replies go to `EMAIL_FROM` unless a `reply_to` is configured.

5. Test every external dependency before deploying:

   ```bash
   npm run check:external
   npm run check:external -- --send-email you@example.com
   ```

   The check connects to PostgreSQL and Redis, reports pending migrations, performs a
   Put/Head/Get/Delete round-trip in the bucket, verifies the bucket CORS origin, lists the Resend
   sender domain, optionally sends a real test email, and posts to the monitoring webhook. It never
   prints credential values. Warnings about `localhost`, missing TLS, or CORS are actionable.

6. Apply migrations from a trusted machine:

   ```bash
   npm run db:deploy:production
   ```

   This reads `DATABASE_URL` from `.env.production` and runs `prisma migrate deploy`. The database
   must be reachable from the machine running the command. If it is private, run the same command
   from a host with access; do not add migrations to the API container startup.

7. Sync environment variables and deploy:

   ```bash
   npm run vercel:env
   npm run vercel:deploy
   ```

   `vercel:env` refuses placeholder values and writes only the Production environment. Vercel
   containers and daemons read environment variables at deploy time, so redeploy after every
   change. The first build creates two Services (`api`, `web`) and the `worker` Daemon.

8. Verify:

   ```bash
   DOMAIN=https://your-project.vercel.app
   curl -fsS "$DOMAIN/health"
   curl -fsS "$DOMAIN/health/ready"
   curl -fsSI "$DOMAIN/" | head
   ```

   `/api/v1/openapi.json` is only available when `API_DOCS_ENABLED=true`. If a workspace already
   exists, run the API smoke test:

   ```bash
   API_SMOKE_BASE_URL="$DOMAIN/api/v1" \
   API_SMOKE_ADMIN_EMAIL=admin@example.com \
   API_SMOKE_ADMIN_PASSWORD='...' \
   npm run api:smoke
   ```

   Confirm the worker is running and its logs are clean:

   ```bash
   npx vercel daemons
   npx vercel logs "$DOMAIN" --follow
   ```

9. Create the first workspace through the public registration page, then remove/disable open
   registration if the deployment should be invite-only (future policy gate).

## First deployment (Docker Compose / self-hosted)

1. Provision PostgreSQL 17, Redis 8, an S3-compatible private bucket, and a TLS reverse proxy/DNS
   entry for the web app.
2. Copy `docker-compose.prod.yml` and `infra/docker/nginx.conf` to the host, plus
   `.env.production.example` → `.env.production`.
3. Fill every placeholder. Generate secrets with `openssl rand -hex 32`. Use the same strong
   password in `POSTGRES_PASSWORD` and the password portion of `DATABASE_URL`; likewise for Redis.
   Apply the S3 CORS and bucket policy from the Vercel section, replacing the origin with the
   compose host.
4. Log in to GHCR if images are private, then start the stack:

   ```bash
   export API_IMAGE=ghcr.io/org/studioos/api:latest
   export WEB_IMAGE=ghcr.io/org/studioos/web:latest
   docker compose -f docker-compose.prod.yml --env-file .env.production pull
   docker compose -f docker-compose.prod.yml --env-file .env.production up -d
   ```

   The `migrate` service runs `prisma migrate deploy` before API/worker start. If migrations fail,
   the API/worker do not start.

5. Verify:

   ```bash
   curl -fsS https://app.example.com/health
   curl -fsS https://app.example.com/health/ready
   curl -fsS https://app.example.com/ | head
   ```

   `/api/v1/openapi.json` is only available when `API_DOCS_ENABLED=true`.

6. Create the first workspace through the public registration page, then remove/disable open
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

This workflow is the **self-hosted compose path only**. Vercel builds its own images from
`infra/docker/Dockerfile.api` and `infra/docker/Dockerfile.web`; deploy with `npm run vercel:deploy`
after `npm run db:deploy:production` and `npm run vercel:env`, or connect the repository to Vercel
for Git-driven deployments. Run migrations once before promoting a Vercel deployment; do not rely on
the workflow above.

## Routine operations

### Logs

Compose:

```bash
docker compose -f docker-compose.prod.yml logs -f api worker web
```

Vercel:

```bash
npx vercel logs https://your-project.vercel.app --follow
npx vercel daemons
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

- API is stateless apart from cookie/session DB rows; scale behind the load balancer. On Vercel,
  Services scale automatically.
- Worker can scale horizontally; the dispatcher deduplicates queue jobs by outbox ID. Vercel
  Daemons use manual per-region instance counts and run in production only.
- Rate limiting uses Redis when `REDIS_URL` is configured. Verify the Redis store is active before
  exposing Vercel traffic to the public; the in-memory fallback is per container instance and
  resets on scale-to-zero. Vercel runs multiple API instances.
- Queue workers use concurrency 5 per process; tune with provider limits.

### Secret rotation

- `SESSION_SECRET`: rotating invalidates every active session and every pending invitation/reset
  link, and makes existing encrypted outbox emails undecryptable. Drain the outbox before rotating,
  then plan a maintenance window.
- `POSTGRES_PASSWORD` / `REDIS_PASSWORD`: update the database/Redis and `.env.production`
  together, then restart dependent services. On Vercel, update `DATABASE_URL` / `REDIS_URL` and
  redeploy.
- S3/email/API keys: create new credentials, update `.env.production`, restart API and worker, then
  revoke the old credentials. On Vercel, run `npm run vercel:env` and redeploy; running containers
  and daemons do not pick up environment changes until a new deployment.
- `SESSION_SECRET` rotation on Vercel has the same outbox impact as compose. Drain the outbox,
  rotate, redeploy, and expect every session and invitation/reset link to be invalidated.

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

On Vercel, PostgreSQL is a managed external service. Enable the provider's automated backups and
point-in-time recovery, and still keep a logical `pg_dump` in your own encrypted storage. The compose
container dump command above does not apply, but `infra/scripts/backup-postgres.sh` works from any
host that can reach the managed database.

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
4. For production recovery with compose, stop API and worker, restore into the production database
   with `CONFIRM_RESTORE=yes`, start the `migrate` service, then API/worker. Verify health and a
   sample client portal approval.
5. For production recovery on Vercel, promote a deployment that points at the restored database (or
   restore in place with the API and worker stopped), run `npm run db:deploy:production`, then
   redeploy and verify health. The worker Daemon is recreated by the new deployment.
6. Record the restore duration and any data loss window in the incident log.

### Rollback

- Compose application rollback: deploy the previous image tag:

  ```bash
  export API_IMAGE=ghcr.io/org/studioos/api:<previous-sha>
  export WEB_IMAGE=ghcr.io/org/studioos/web:<previous-sha>
  docker compose -f docker-compose.prod.yml --env-file .env.production up -d
  ```

- Vercel application rollback: use the dashboard's **Instant Rollback**, or promote the previous
  production deployment. Image and environment changes are deployment-scoped, so the previous
  deployment also restores its previous environment.
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
- Rate limiting is Redis-backed when `REDIS_URL` is configured and falls back to in-memory in
  local development. Keep `REDIS_URL` set in production; the fallback is single-instance only.
- Session and upload-intent cleanup are lazy; schedule maintenance SQL or a cleanup job.
- The development S3 mock is not durable and must not be deployed.
- Vercel Daemons are in public beta, run in production only, do not autoscale, and have no
  persistent local storage. Preview deployments do not start a worker, so queued email is not
  delivered from previews.
- Vercel container images do not support Secure Compute or static outbound IPs. Do not put the
  bucket or database behind an IP allowlist that requires a fixed egress address.
- Container Services scale to zero when idle and have cold starts. Keep request handlers short and
  use the presigned-URL upload/download flow instead of proxying file bytes through the API.
- The Vercel build does not run database migrations. `npm run db:deploy:production` is a required
  release step.
