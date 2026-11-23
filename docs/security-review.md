# StudioOS security review — Milestones 0–6

Review date: 2026-11-22
Scope: API, worker, web client, PostgreSQL schema, object storage integration, queue/outbox, and
deployment configuration.

## Trust boundaries

1. Public browser → API over HTTPS, cookie session, CSRF double-submit token.
2. API → PostgreSQL (tenant-scoped queries and composite foreign keys).
3. Browser → S3-compatible object storage using short-lived signed URLs.
4. API → outbox table → Redis/BullMQ → email provider.
5. Client portal → client-scoped deliverables only; no internal organization routes.

## Controls verified

| Area | Control | Evidence |
|---|---|---|
| Passwords | Argon2id, 12+ chars, generic login errors, dummy hash | Auth tests |
| Signup verification | 6-digit OTP hashed with HMAC and scoped to the user, 10-minute expiry, 5-attempt cap, resend cooldown, single-use claim, no session before verification | Auth tests |
| OAuth | Passport Google/GitHub strategies, HTTP-only state cookie validated on callback, verified provider email required, account links stored separately | OAuth tests |
| Sessions | Opaque token, HMAC hash at rest, HTTP-only/SameSite cookie, rotation on login | Auth tests |
| CSRF | Double-submit cookie and header on unsafe methods | Auth/API tests |
| Tenant isolation | URL org is a selector; active membership re-resolved per request; 404 for inaccessible tenants | Tenancy tests |
| RBAC | Centralized permission matrix in `packages/shared`; no controller role strings | Policy + feature tests |
| Workflow | Fixed state machine in shared/domain code; role policy; version/status compare-and-swap; DB check | Content tests |
| Tasks | Tenant/project composite FKs; assignee active-member/project checks; own-task status policy | Task tests |
| Clients/portal | Separate `ClientMembership`; portal joins by active membership; internal review records filtered | Client + portal tests |
| Uploads | Allowlisted MIME, size cap, random server key, expiring single-use intent, owner check | Asset tests |
| Storage completion | `HeadObject` size/MIME verification; conditional completion; no client-supplied key authorization | Asset tests |
| Downloads | Short-lived signed URL; tenant/project/client authorization before signing | Asset/portal tests |
| Approval | `expectedVersion` + status/version CAS; review stores version, reviewer, decision, asset | Portal tests |
| Notifications | Always filtered by `userId`; encrypted outbox payloads; no email bodies in logs | Notification tests |
| Jobs | Bounded retries, exponential backoff, failed-job visibility, outbox failure state | Worker test |
| Input | Zod bodies/params/query; Prisma parameterization; 1 MB JSON limit | Suite |
| Headers/CORS | Helmet, narrow origin allowlist, secure web headers in nginx | Health tests |
| Secrets | `.env` ignored; production example contains placeholders only | Repository review |
| Dev-only links/codes | Invite/reset URLs and signup OTP codes hidden unless `DEV_LINKS_ENABLED=true` and non-production | Config review |
| API docs | Swagger/OpenAPI routes disabled unless `API_DOCS_ENABLED=true` | App bootstrap |
| Audit | Security-relevant writes audited in the same transaction | Audit tests |
| Browser E2E | Playwright smoke suite for internal workspace, client portal, mobile overflow | `npm run test:e2e` |

## Findings

### Resolved during implementation

- Cross-project task/content linking was initially guarded only by service checks; a composite FK
  plus a restore migration now enforces it in PostgreSQL.
- Client-visible portal responses originally shared internal presenter shapes; portal-specific
  queries and presenters now filter review records and hide assignees/internal notes.
- Concurrent workflow transitions could have replayed an obsolete intent; version is now sent by
  the client and included in the compare-and-swap predicate.
- Invitation/reset links in queued email were plaintext; outbox payloads are now AES-256-GCM
  encrypted with a key derived from `SESSION_SECRET`.

### Open risks and accepted limitations

| Risk | Severity | Mitigation / next step |
|---|---|---|
| Rate limiting uses an in-memory store | Medium | Move to Redis before horizontally scaling API instances |
| Lists are not paginated | Low | Add cursor pagination before large tenant onboarding |
| Expired sessions cleaned lazily | Low | Add a daily worker cleanup job |
| S3 bucket policy/CORS is deployment-specific | Medium | Apply least privilege and restrict CORS to the production origin |
| Dev S3 mock is in-memory | Low | Never use the mock in production |
| Web CSP allows inline styles | Low | Required by React style attributes; revisit with nonces |
| Single email provider implementation (Resend) | Low | Add SES behind the adapter if required |
| Prisma CLI config advisories | Low | CLI is used only for migration jobs against the trusted bundled schema; plan Prisma 7 upgrade |

No known critical tenant-isolation, authorization bypass, or unauthenticated asset-access defect
remains after the automated suite and the M1–M5 headless review flows.

## Deployment security checklist

- [ ] HTTPS terminated by a trusted proxy/load balancer; `TRUST_PROXY=true`.
- [ ] Unique `SESSION_SECRET`; rotation invalidates sessions and pending invite/reset links.
- [ ] Database and Redis reachable only on private networks with strong passwords.
- [ ] S3 bucket private, versioning/retention enabled, CORS restricted to the web origin.
- [ ] Email provider key scoped to sending only.
- [ ] `MONITORING_WEBHOOK_URL` points to an authenticated collector.
- [ ] Backups encrypted off-host; restore tested into a scratch database.
- [ ] `docker compose -f docker-compose.prod.yml` migration job succeeds before API/worker.
- [ ] `DEV_LINKS_ENABLED=false` and `API_DOCS_ENABLED=false` unless explicitly intended.
- [ ] Health checks green; failed BullMQ jobs and `outbox_events.status = 'FAILED'` alerted.
- [ ] Production-like load test recorded in `docs/performance.md`.
