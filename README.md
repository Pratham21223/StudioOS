# StudioOS

StudioOS is a multi-tenant content production and operations platform for media agencies. It
brings clients, projects, deliverables, tasks, assets, reviews, and approvals into one workspace.

This repository currently implements **Milestone 0 (foundation)** through **Milestone 6
(hardening and deployment)** from the product specification.

---

## Current status

| Area | Status |
|---|---|
| Monorepo, TypeScript, linting, CI, Docker Compose | Complete (M0) |
| PostgreSQL schema and migrations | Complete (M1–M6) |
| Registration, login, logout, sessions | Complete (M1) |
| Password reset with hashed single-use tokens | Complete (M1) |
| Organizations, memberships, centralized RBAC | Complete (M1) |
| Internal invitations with hashed single-use tokens | Complete (M1) |
| Tenant-isolation and authorization tests | Complete (M1–M6) |
| React workspace: auth, overview, members, settings | Complete (M1) |
| Clients, client portal invitations, project CRUD, project teams | Complete (M2) |
| Content items, fixed workflow, workflow event history | Complete (M3) |
| Task CRUD, assignment, statuses, filters, overdue views | Complete (M3) |
| Signed direct-to-storage uploads, verified assets, downloads | Complete (M4) |
| Internal review records and client portal approval/revisions | Complete (M4) |
| Invitation/review/assignment email outbox and BullMQ worker | Complete (M5) |
| In-app notifications, deadline reminders, role-aware dashboard | Complete (M5) |
| OpenAPI contract, Swagger UI, automated browser smoke suite | Complete (M6) |
| Public marketing landing page and auth entry points | Complete (M6) |
| Figuring Out Media & Education dataset | Seeded (fictional operations data) |
| Production images, compose stack, release workflow, backups, runbook | Complete (M6) |

The backend tests enforce tenant isolation, client and project boundaries, workflow validity, task
assignment rules, storage authorization, version-aware client approval, notification scoping, and
server-side role authorization for each feature module. Browser smoke tests cover both the internal
workspace and client portal.

---

## Stack

- **Runtime:** Node.js 24 LTS (minimum 22.12)
- **API:** Express 5 + TypeScript
- **Database:** PostgreSQL 17 + Prisma 6
- **Sessions:** opaque server-side sessions with HTTP-only cookies
- **Passwords:** Argon2id via `@node-rs/argon2`
- **Validation:** Zod
- **Logging:** Pino (structured JSON)
- **Files:** S3-compatible object storage with short-lived signed URLs
- **Jobs/queue:** Redis + BullMQ with a transactional outbox
- **Email:** console (development) or Resend behind an adapter
- **Web:** React 19 + Vite + React Router + Tailwind CSS 4
- **Tests:** Vitest + Supertest + a real PostgreSQL test database + S3 mock
- **Local infrastructure:** Docker Compose (PostgreSQL, Redis, S3 mock)
- **CI:** GitHub Actions

Dependency versions are pinned in the workspace `package.json` files.

---

## Repository layout

```text
studioos/
├── apps/
│   ├── api/
│   │   ├── prisma/
│   │   │   ├── schema.prisma
│   │   │   ├── migrations/
│   │   │   └── seed.ts
│   │   ├── src/
│   │   │   ├── config/          # env validation + structured logger
│   │   │   ├── infrastructure/  # Prisma, S3 storage, BullMQ queue, email adapter
│   │   │   ├── middleware/      # auth, tenant, client portal, CSRF, rate limits, errors
│   │   │   ├── modules/         # auth, orgs, clients, projects, content, tasks, assets,
│   │   │   │                    # reviews, portal, notifications, dashboard, audit
│   │   │   ├── shared/          # errors, validation, crypto, presenters
│   │   │   ├── app.ts
│   │   │   ├── server.ts
│   │   │   └── worker.ts        # separately runnable BullMQ worker
│   │   └── tests/               # integration + security tests
│   └── web/
│       └── src/
│           ├── app/
│           ├── components/
│           ├── features/
│           └── lib/
├── packages/
│   └── shared/                  # roles + centralized permission matrix
├── infra/
│   ├── postgres/init.sql
│   ├── docker/                  # production API/web Dockerfiles + nginx
│   └── scripts/                 # PostgreSQL backup/restore
├── e2e/                         # Playwright browser smoke tests
├── docs/                        # security review + production runbook
├── .github/workflows/
│   ├── ci.yml
│   └── release.yml
├── docker-compose.yml
├── docker-compose.prod.yml
├── .env.example
├── .env.production.example
└── README.md
```

The API follows a modular monolith structure. Controllers handle HTTP, services enforce business
rules and transactions, repositories own Prisma queries, and validation schemas guard every
request body and parameter.

---

## Prerequisites

- Node.js 22.12+ (24 recommended)
- npm 11+
- Docker + Docker Compose

---

## Local setup

1. **Install dependencies**

   ```bash
   npm install
   ```

   This also builds the shared workspace package and generates the Prisma client.

2. **Create the environment file**

   ```bash
   cp .env.example .env
   openssl rand -hex 32
   ```

   Put the generated value into `SESSION_SECRET`. Set `SEED_PASSWORD` to a development-only
   password of at least 12 characters. Never commit `.env`.

3. **Start PostgreSQL, Redis, and S3-compatible storage**

   ```bash
   npm run infra:up
   ```

   Postgres is exposed on `5432`, Redis on `6380` (to avoid clashing with a host Redis on
   `6379`), and the development S3 mock on `9090`. These are development defaults only. Wait for
   the health checks to pass:

   ```bash
   docker compose ps
   ```

   The local S3 mock (`adobe/s3mock`) is not a production storage service. Set `S3_ENDPOINT` to
   your S3-compatible provider in staging/production and disable `S3_AUTO_CREATE_BUCKET`.

4. **Apply migrations**

   ```bash
   npm run db:migrate
   ```

   The Prisma CLI loads the repository-root `.env` when run through the root scripts.

5. **Seed Figuring Out data (optional)**

   ```bash
   npm run db:seed
   ```

   The seed is idempotent, refuses to run when `NODE_ENV=production`, and requires
   `SEED_PASSWORD` (12+ characters). It creates **Figuring Out Media & Education**
   (`figuring-out-media`) with fictional `.test` accounts:

   | Access | Name | Email |
   |---|---|---|
   | Admin | Aarav Mehta | `admin@figuringout.test` |
   | Project Manager | Priya Nair | `manager@figuringout.test` |
   | Producer | Rohan Desai | `producer@figuringout.test` |
   | Editor | Ananya Iyer | `editor@figuringout.test` |
   | Client contact | Maya Kapoor | `client@figuringout.test` |

   All accounts use the password in `SEED_PASSWORD`. These are fictional seed identities, not
   real Figuring Out employees or client contacts. The client user has a `ClientMembership` for
   **Figuring Out Originals** and no internal organization membership.

   The dataset includes:

   - A completed **Flagship Podcast: Public Episode Archive** with six real public episode records
     (FO586–FO591), guest names, categories, publication dates, descriptions, and official source
     URLs. These are historical imports, not upcoming production or client approvals.
   - Two active projects: **Weekly Podcast Production Board** and **Cross-platform Content
     Distribution**.
   - Seven weekly-production deliverables across every workflow stage, plus nine distribution
     deliverables.
   - 96 structured tasks across research, guest coordination, production, post-production,
     distribution, multilingual delivery, and experimentation. Dates are relative to the seed run
     date in UTC.
   - Seeded internal feedback, a pending client review with revision history, and an approved
     version history for the client portal.
   - Seeded notifications and audit/workflow activity. No fake assets or live campaign metrics are
     created.
   - Organization profile, social-channel snapshots, content categories, production formats, and
     the 18 publicly listed partner references stored in `seed.reference_data` audit metadata.

   The six archive episodes and 18 partner references are public reference data with source URLs.
   The internal accounts, client contact, active projects, content, tasks, reviews, and approvals are
   fictional seed records. Partner references are not inserted as active client accounts.

   Asset records are intentionally not seeded because they require real objects in configured
   storage. The asset library shows its empty state until a file is uploaded.

   Date strategy: active project deadlines and task due dates are generated relative to the UTC day
   the seed runs. Re-running the seed restores the seeded workflow state and moves the workload
   forward without creating duplicates.

   Expected seed counts: 1 organization, 5 fictional users, 2 clients, 3 projects, 22 content items,
   96 tasks, 9 reviews, 10 notifications, 83 workflow events, and 18 partner references stored in
   metadata. Assets remain empty.

6. **Run the API, web app, and worker**

   ```bash
   npm run dev
   ```

   This runs three processes: the API, Vite, and the BullMQ worker.

   - Web: <http://localhost:5174>
   - API: <http://localhost:4000>
   - Liveness: <http://localhost:4000/health>
   - Readiness (checks PostgreSQL): <http://localhost:4000/health/ready>

   Port `5174` is used for the web app. If you change it, update `WEB_ORIGIN` and the
   invitation/reset base URLs in `.env` as well.

   Email delivery defaults to the `console` adapter, which logs only recipient and subject.
   Configure `EMAIL_PROVIDER=resend` and `EMAIL_API_KEY` to deliver real email.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run API, web, and worker concurrently |
| `npm run dev:api` | Run only the API with hot reload |
| `npm run dev:web` | Run only the web app |
| `npm run dev:worker` | Run only the BullMQ worker |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | TypeScript checks for shared, API, and web |
| `npm test` | API unit + integration tests against the test database |
| `npm run test:e2e` | Playwright browser smoke tests |
| `npm run test:e2e:install` | Install Chromium and system deps for Playwright |
| `npm run build` | Build shared package, API, and web |
| `npm run api:smoke` | Check auth, workspace, and client portal APIs against a running API |
| `npm run format` | Format with Prettier |
| `npm run format:check` | Verify formatting (used in CI) |
| `npm run db:migrate` | Create/apply a development migration |
| `npm run db:deploy` | Apply committed migrations (deploy/CI) |
| `npm run db:seed` | Run the development seed |
| `npm run infra:up` / `infra:down` | Start/stop local PostgreSQL and Redis |

### Test database

Tests never use the development database. The test runner:

1. reads `TEST_DATABASE_URL` (default `studio_os_test`),
2. refuses to run unless the database name ends in `_test`,
3. creates the database if the role has permission,
4. applies all committed migrations,
5. truncates tables between tests.

The Docker init script creates `studio_os_test` on a fresh volume. To reset local state:

```bash
docker compose down -v
npm run infra:up
npm run db:migrate
```

---

## API implemented in Milestones 1–5

All routes are under `/api/v1`. Cookie-authenticated unsafe requests require a matching
`X-CSRF-Token` header and `studioos_csrf` cookie. The web client requests a token from
`GET /auth/csrf` before submitting forms.

### Authentication

| Method | Endpoint | Notes |
|---|---|---|
| GET | `/auth/csrf` | Issue/reuse a double-submit CSRF token |
| POST | `/auth/register` | Atomically creates user, organization, admin membership, session |
| POST | `/auth/login` | Rotates the session; generic invalid-credentials response |
| POST | `/auth/logout` | Deletes the current session and clears cookies |
| GET | `/auth/me` | Current user, internal memberships, and client portal memberships |
| POST | `/auth/password/forgot` | Always returns success semantics; includes `resetUrl` only when `DEV_LINKS_ENABLED=true` |
| POST | `/auth/password/reset` | Single-use token; revokes all sessions on success |

### Organizations and memberships

| Method | Endpoint |
|---|---|
| GET | `/organizations` |
| GET | `/organizations/:orgId` |
| PATCH | `/organizations/:orgId` |
| GET | `/organizations/:orgId/members` |
| PATCH | `/organizations/:orgId/members/:membershipId` |
| GET | `/organizations/:orgId/invitations` |
| POST | `/organizations/:orgId/invitations` |

### Clients and client portal access

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/clients` |
| POST | `/organizations/:orgId/clients` |
| GET | `/organizations/:orgId/clients/:clientId` |
| PATCH | `/organizations/:orgId/clients/:clientId` |
| GET | `/organizations/:orgId/clients/:clientId/members` |
| PATCH | `/organizations/:orgId/clients/:clientId/members/:membershipId` |
| GET | `/organizations/:orgId/clients/:clientId/invitations` |
| POST | `/organizations/:orgId/clients/:clientId/invitations` |

Client invitations create a `ClientMembership`, never an internal `OrganizationMembership`.
Client users have no access to internal organization routes. Their portal experience lives under
`/client-portal` and `/portal` in the web app.

### Projects and project teams

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/projects` |
| POST | `/organizations/:orgId/projects` |
| GET | `/organizations/:orgId/projects/:projectId` |
| PATCH | `/organizations/:orgId/projects/:projectId` |
| GET | `/organizations/:orgId/projects/:projectId/members` |
| POST | `/organizations/:orgId/projects/:projectId/members` |
| DELETE | `/organizations/:orgId/projects/:projectId/members/:userId` |

Admins and project managers see all organization projects. Producers and editors only see projects
where they hold a `ProjectMembership`. Project creation, updates, and team assignment require
`PROJECTS_MANAGE`.

### Content and workflow

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/content-items` |
| GET | `/organizations/:orgId/content-items/:contentId` |
| PATCH | `/organizations/:orgId/content-items/:contentId` |
| GET | `/organizations/:orgId/content-items/:contentId/events` |
| POST | `/organizations/:orgId/content-items/:contentId/transitions` |
| GET | `/organizations/:orgId/projects/:projectId/content-items` |
| POST | `/organizations/:orgId/projects/:projectId/content-items` |

Content list filters: `status`, `type`, `projectId`, `assigneeId` (UUID or `me`), and `search`.
New content always starts in `BRIEF` at version `1`. `PATCH` updates metadata only; status changes
must go through the transition endpoint. Each transition returns the updated content and the
workflow event. The web client sends `expectedVersion` so a stale tab cannot apply a transition to a
newer state.

The fixed workflow is:

```text
BRIEF -> SCRIPT -> SHOOT -> EDITING -> INTERNAL_REVIEW -> CLIENT_APPROVAL -> READY_TO_PUBLISH
```

Allowed back-steps are `INTERNAL_REVIEW -> EDITING` and `CLIENT_APPROVAL -> EDITING`.
`READY_TO_PUBLISH` is terminal. A revision from `CLIENT_APPROVAL` requires a feedback note.
Role policy is centralized in `packages/shared`:

| Role | Allowed workflow actions |
|---|---|
| Admin, Project Manager | Every valid transition |
| Producer | Production stages and internal-review submission; never acts on client approval |
| Editor | `EDITING -> INTERNAL_REVIEW` only |

Admins and project managers see all content. Producers and editors only see content on projects
where they hold a membership. Assignment requires an active internal member; producers and editors
must already be on the project team.

### Tasks

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/tasks` |
| POST | `/organizations/:orgId/tasks` |
| GET | `/organizations/:orgId/tasks/:taskId` |
| PATCH | `/organizations/:orgId/tasks/:taskId` |
| PATCH | `/organizations/:orgId/tasks/:taskId/status` |

Task list filters: `status`, `priority`, `projectId`, `contentItemId`, `assigneeId` (UUID or `me`),
`overdue=true`, and `search`. `overdue` means a due date before today in UTC and a status other than
`DONE`. Tasks may optionally link to a content item from the same project.

Admins, project managers, and producers create and edit tasks. Assignees (including editors) can
change the status of their own task through the status endpoint. Editors cannot create or edit task
metadata. Tasks are read-only when their project is `COMPLETED`.

### Assets and storage

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/assets` |
| POST | `/organizations/:orgId/assets/upload-intents` |
| POST | `/organizations/:orgId/assets/complete` |
| GET | `/organizations/:orgId/assets/:assetId` |
| POST | `/organizations/:orgId/assets/:assetId/download-url` |
| GET | `/organizations/:orgId/content-items/:contentId/assets` |

The browser requests a short-lived signed `PUT` URL, uploads the file directly to object storage,
then calls the completion endpoint. The API verifies the object's existence, byte size, and MIME
type against the stored upload intent before creating the `Asset` record. Upload intents expire and
are single-use. Downloads are issued as short-lived signed URLs with an attachment or inline
disposition. Asset reads follow project access; client contacts use the portal download endpoint.

Allowed types include common image, video, audio, PDF, text, and office-document formats. The
default per-file limit is 250 MB (`ASSET_MAX_BYTES`).

### Reviews and client approval

| Method | Endpoint |
|---|---|
| GET | `/organizations/:orgId/content-items/:contentId/reviews` |
| POST | `/organizations/:orgId/content-items/:contentId/reviews` |
| GET | `/organizations/:orgId/reviews` |

Internal users with `REVIEWS_INTERNAL` can record feedback against the current content version and
optionally an asset. Feedback is retained and creates notifications for the assigned team.

### Client portal

| Method | Endpoint |
|---|---|
| GET | `/client-portal/projects` |
| GET | `/client-portal/projects/:projectId/content-items` |
| GET | `/client-portal/content-items/:contentId` |
| POST | `/client-portal/content-items/:contentId/approve` |
| POST | `/client-portal/content-items/:contentId/request-revision` |
| POST | `/client-portal/assets/:assetId/download-url` |

Client contacts see only projects and deliverables for clients they belong to. A deliverable becomes
visible after it reaches `CLIENT_APPROVAL`. Internal review feedback is never returned by portal
endpoints.

Approval and revision requests require `expectedVersion`. The API verifies the user's client
membership, the `CLIENT_APPROVAL` state, and the version inside a transaction, then:

- records a `Review` decision with the reviewed version and optional asset;
- writes the workflow event;
- moves content to `READY_TO_PUBLISH` on approval or `EDITING` on revision;
- notifies the assigned production team.

Requests with a stale version or a non-approval state return `409`.

### Notifications, dashboard, and jobs

| Method | Endpoint |
|---|---|
| GET | `/notifications` |
| PATCH | `/notifications/:notificationId/read` |
| POST | `/notifications/read-all` |
| GET | `/organizations/:orgId/dashboard` |

Notifications are always scoped to the authenticated user. The dashboard is scoped to the tenant
and role: managers see organization-wide project/content/task metrics; producers and editors see
assigned projects and their own task views.

The worker polls the transactional outbox for email events. Outbox payloads are encrypted at rest
because invitation and password-reset emails contain credentials. BullMQ retries with exponential
backoff and records failed jobs and outbox errors. A repeatable job creates idempotent task deadline
reminders every 12 hours.

### Invitations

| Method | Endpoint |
|---|---|
| GET | `/invitations/:token` (public preview) |
| POST | `/invitations/accept` (internal or client invitation; authenticated or new account) |

### Health

| Method | Endpoint |
|---|---|
| GET | `/health`, `/api/v1/health` |
| GET | `/health/ready` |

Response shape:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "The request data is invalid.",
    "requestId": "…",
    "details": [{ "path": "email", "message": "Enter a valid email address." }]
  }
}
```

Every response includes an `X-Request-Id` header. Request IDs appear in structured logs.

---

## Security decisions

### Sessions

- Random 256-bit opaque session tokens, never JWTs in the browser.
- Only a keyed HMAC-SHA256 hash of the token is stored. A database leak does not expose usable
  sessions.
- Session token travels in an `HttpOnly`, `SameSite=Lax`, `Secure` (production) cookie.
- Sessions are rotated on login, invitation acceptance, and password reset.
- Deactivated users and memberships lose access on the next request.
- Passwords and session tokens never appear in logs or API responses.

### CSRF

- Double-submit cookie: `studioos_csrf` (readable) must match `X-CSRF-Token`.
- Required for every unsafe method, including login and registration.
- The SPA bootstraps a token before any form submission.

### Passwords

- Argon2id with 19 MiB memory, 2 iterations, 1 lane.
- Minimum 12 characters, maximum 128.
- Login returns a generic `INVALID_CREDENTIALS` error and performs a dummy hash when the email
  does not exist to reduce timing/user-enumeration signals.
- Password reset tokens are random, HMAC-hashed at rest, single-use, and expiring.

### Tenancy and authorization

- The organization ID in a URL is only a selector.
- Every tenant route resolves the session user's **active** membership and organization status
  server-side.
- Inaccessible and nonexistent tenants return `404` to limit resource enumeration.
- Role checks use a centralized permission matrix in `packages/shared`; controllers do not scatter
  role-string comparisons.
- Membership changes are transactional. The last active admin cannot be demoted or deactivated.
- Membership/invitation changes are written to `audit_logs` in the same transaction.
- Cross-tenant relationship writes are rejected by tenant-scoped lookups and 404 semantics.
- `SESSION_SECRET` keys session, invitation, and password-reset token hashes. Rotate it only
  deliberately: rotation invalidates every active session and outstanding link.

### Clients and project access

- Client profiles, portal contacts, and client invitations are restricted to admins and project
  managers. Producers and editors cannot enumerate the client directory.
- `ClientMembership` is a separate boundary from `OrganizationMembership`. A client contact has
  no internal workspace access unless they independently hold an organization membership.
- Client invitations create/reactivate a `ClientMembership` only. They are blocked for archived
  clients, and deactivated client memberships disappear from `/auth/me` immediately.
- Projects reference their client through a composite foreign key
  `(client_id, organization_id) → clients(id, organization_id)`, so a project cannot point at
  another organization's client even through direct database access.
- Project memberships use a composite foreign key to the project and are validated to reference
  active internal members of the same organization.
- Admins and project managers can view every organization project. Producers and editors only see
  projects where they hold a `ProjectMembership`; guessing a project ID returns `404`.
- Project creation/updates/status changes and team assignment require `PROJECTS_MANAGE`.
- Completed projects cannot be reopened, and PostgreSQL enforces `start_date <= deadline` when
  both dates are present.
- Project and client changes are written to the audit log in the same transaction.

### Content workflow and tasks

- The state machine lives in `packages/shared` (`CONTENT_TRANSITIONS`,
  `canPerformContentTransition`) and is enforced again in the API service. It is never trusted to
  the client.
- Every transition validates the current state, requested state, project access, and role policy.
  Invalid state pairs return `409 INVALID_CONTENT_TRANSITION`; role violations return
  `403 CONTENT_TRANSITION_FORBIDDEN`.
- Transitions use a compare-and-swap update (`WHERE id = ? AND status = ? AND version = ?`) inside
  the transaction, then insert the workflow event. Concurrent or stale requests cannot both
  succeed, and a rejected request leaves no event behind.
- PostgreSQL also checks the transition pair in `workflow_events`, so direct writes cannot invent a
  workflow step outside the fixed MVP state machine.
- `content_items.version` increments on each transition and has a database check of `>= 1`.
  Transitions never move an item backwards without a matching event.
- Revisions from `CLIENT_APPROVAL` require a note. Approval moves to `READY_TO_PUBLISH`, which is
  terminal.
- Content is scoped through its project. Producers and editors cannot list, read, transition, or
  update content on projects they are not assigned to; guessed IDs return `404`.
- Content and task assignees must be active internal members. Producers and editors must also hold
  a project membership so assigned work is always visible to them.
- Tasks reference their project through a composite tenant foreign key. An extra composite foreign
  key `(content_item_id, project_id, organization_id)` prevents linking a task to content from a
  different project, even through direct database access.
- Completed projects are read-only: content and task creation, metadata updates, transitions, and
  status changes are rejected with `409 PROJECT_COMPLETED`.
- Content, workflow, and task changes are written to `audit_logs` in the same transaction as the
  change.

### Assets and file access

- Upload intents are random, expiring, single-use, and bound to the creating user, tenant, project,
  content item, filename, MIME type, and byte size.
- The browser uploads directly to object storage; file bytes never pass through Express.
- Completion calls `HeadObject` and compares the stored size and MIME type with the intent before
  creating an asset. A claimed intent is marked complete with a conditional update, so a duplicate
  completion cannot create two assets.
- Storage keys are generated server-side and never accepted from clients for authorization.
- Uploads and downloads require project access. Client downloads require an active membership for
  the content item's client and a client-visible content state.
- Signed URLs are short-lived and are never logged.
- MIME types are allowlisted, filenames are sanitized for storage keys, and sizes are bounded.
- Assets, uploads, reviews, and workflow events use composite tenant foreign keys. A review's asset
  must belong to the reviewed content item, and asset content must belong to the asset's project.
- Asset metadata and review decisions are audited in the same transaction.

### Client portal and approvals

- Client portal routes require an active `ClientMembership`; organization routes remain
  inaccessible to client-only users.
- Portal queries join through `client_memberships` and only return content in `CLIENT_APPROVAL` or
  `READY_TO_PUBLISH`.
- Internal review records are filtered out of every portal response.
- Client decisions compare `expectedVersion` with the current version and use a version/status
  compare-and-swap inside the transaction. Stale or repeated decisions are rejected.
- Approval records the reviewed content version, reviewer, decision, optional asset, and timestamp.
  Revision requires feedback and moves the item back to `EDITING`.
- A revision hides the deliverable from the portal until it is submitted for client approval again.
- Approval and revision events, reviews, audit entries, notifications, and outbox emails commit in
  one transaction.

### Notifications and background jobs

- Notification queries are always filtered by the authenticated `user_id`; a user cannot read or
  mark another user's notification.
- In-app notifications and outbox events are written inside the domain transaction.
- Outbox email payloads are AES-256-GCM encrypted with a key derived from `SESSION_SECRET`; a
  database leak does not expose usable invitation or reset links.
- The worker uses BullMQ with bounded exponential retries. Exhausted jobs update the outbox row to
  `FAILED` with the last error and remain visible in BullMQ's failed set.
- The email adapter never logs message bodies. Console delivery logs only recipient and subject.
- Deadline reminders use a unique dedupe key per task, assignee, and day, making repeat scans
  idempotent.
- Queue failure never rolls back committed business data; the worker dispatcher retries pending
  outbox rows.
- Dashboard counts and lists are filtered by tenant and by project membership for non-managers.

### Invitations

- 256-bit random tokens; only HMAC hashes are stored.
- Single-use and expiring (default 7 days).
- Acceptance claims the invitation and creates/reactivates membership in one transaction.
- An existing account must sign in as the invited email; anonymous acceptance cannot add an
  invitation to an unrelated existing account.
- Reissuing a pending invitation rotates the token (the old link stops working).
- Invitation and password-reset emails are encrypted in the transactional outbox and delivered by
  the worker. Raw links are returned only when `DEV_LINKS_ENABLED=true` in non-production.

### Application hardening

- Helmet security headers, narrow CORS allowlist, 1 MB JSON limit.
- Login, registration, password-reset, and invitation endpoints are rate limited.
- Zod validates every request body and route parameter.
- Prisma parameterizes database queries.
- Error responses never expose stack traces or internal details.
- Structured logs redact cookies, authorization headers, tokens, and hashes.
- OpenAPI/Swagger routes are hidden unless `API_DOCS_ENABLED=true`.
- Invite/reset links are omitted from API responses unless `DEV_LINKS_ENABLED=true` outside
  production.
- Product-facing milestone and roadmap metadata are not shown in the workspace UI.

### Known limitations

- The development S3 mock is in-memory and not suitable for production. Use an S3-compatible
  provider and disable automatic bucket creation outside development.
- The email adapter supports `console` and Resend. Amazon SES can be added behind the same adapter
  without changing domain code.
- Asset version replacement (P1), feedback threads/comments (P1), and asset-level comments (P1) are
  deferred.
- In-app notifications are refreshed on page load; real-time push/websocket updates are not
  implemented.
- Rate limiting uses an in-memory express-rate-limit store. Before running multiple API instances,
  move the limiter to Redis.
- Expired session rows are rejected on use and removed lazily; a scheduled cleanup job should be
  added to the worker.
- Browser smoke coverage is automated for core internal/portal journeys; deeper destructive-flow
  E2E and production-like load tests remain launch activities. A local performance smoke is
  recorded in `docs/performance.md`.
- Task checklists (P1) and task activity timelines beyond audit events are deferred.
- Client, project, content, asset, and task lists are not paginated yet; this is safe for the initial
  team size but should be addressed before large tenants onboard.
- Production project team assignment is limited to admins and project managers. The specification's
  "limited" producer assignment capability is intentionally deferred until content ownership rules
  make the limit meaningful.
- OpenAPI/Swagger docs, production Docker images, and deployment workflows are Milestone 6 items.
- `npm audit` reports advisories in Prisma CLI configuration dependencies (`@prisma/config`,
  `effect`, `deepmerge-ts`). The CLI is included for migration jobs, not request handling, and only
  parses the repository's trusted schema. Revisit on the next Prisma upgrade.

### Deployment notes

- Build the web app with `VITE_API_URL` pointing at the public API, for example:

  ```bash
  VITE_API_URL=https://app.example.com/api/v1 npm run build
  ```

  The Vite config reads only `VITE_*` values from the repository-root `.env` (or process env).
  API-only configuration such as `DATABASE_URL` is never bundled, and the API's
  `NODE_ENV=development` does not leak into production bundle branches.

- Serve the web app and API on the same site. Cookies use `SameSite=Lax`, so
  `app.example.com` + `api.app.example.com` works, while unrelated domains do not. Changing to
  `SameSite=None` is a deliberate security decision that also requires `Secure` and re-reviewing
  CSRF exposure.

- Set `TRUST_PROXY=true` only when a trusted reverse proxy/load balancer terminates TLS and sets
  `X-Forwarded-For`; rate limits and `req.ip` depend on it.

- The web app uses client-side routing. Configure the production static host to serve
  `index.html` for unknown non-API paths.

- Run the API and worker as separate processes (`npm run start -w @studioos/api` and
  `npm run start:worker -w @studioos/api` in the built image). The worker needs Redis and database
  access. Scale workers horizontally; the outbox dispatcher de-duplicates queue jobs by outbox ID.

- Use a real S3-compatible bucket in production, with least-privilege credentials for
  `PutObject`, `GetObject`, and `HeadObject`. Disable `S3_AUTO_CREATE_BUCKET` and configure the
  bucket's CORS policy to allow `PUT` from the web origin with the `Content-Type` header.

- Monitor BullMQ failed jobs and `outbox_events.status = 'FAILED'`. The outbox retains the last
  error for diagnosis. Email bodies are encrypted at rest and never logged.


---

## Data model (Milestones 1–5)

```text
User ──< OrganizationMembership >── Organization
 │                                     │
 ├──< Session                          ├──< Client ──< ClientMembership >── User
 ├──< PasswordResetToken               │        │
 ├──< AuditLog                          │        └──< Project ──< ProjectMembership >── User
 │                                     │                 │
 ├──< ClientMembership                 │                 ├──< ContentItem ──< WorkflowEvent
 │                                     │                 │        │
 ├──< Task ──< ContentItem             │                 │        ├──< Asset ──< UploadIntent
 │                                     │                 │        └──< Review
 ├──< Notification                     │                 └──< Task
 └──< AssetUpload                      └──< Invitation (INTERNAL or CLIENT)

OutboxEvent ── encrypted email payload ──> Redis/BullMQ worker ──> email adapter
```

Key constraints:

- `users.email` is unique and normalized to lowercase.
- `organizations.slug` is unique.
- `organization_memberships` is unique on `(organization_id, user_id)`.
- `client_memberships` is unique on `(client_id, user_id)`.
- `project_memberships` is unique on `(project_id, user_id)`.
- `content_items` is unique on `(id, organization_id)` and indexed on
  `(organization_id, status)`, `(organization_id, project_id)`, assignee, and deadline.
- `workflow_events` reference content with a composite tenant foreign key and store actor, previous
  status, new status, optional note, and timestamp.
- `tasks` use composite foreign keys for both project and content item. A second composite key
  `(content_item_id, project_id, organization_id)` guarantees a linked content item belongs to the
  task's project.
- PostgreSQL rejects workflow event pairs outside the fixed state machine and content versions
  below `1`.
- `assets` and `asset_uploads` reference projects and content with composite tenant keys. Assets
  linked to content must reference content from the same project.
- `reviews` store the decision, reviewed content version, optional asset, reviewer, and feedback.
  A composite key guarantees the selected asset belongs to the reviewed content item.
- `notifications` are indexed by `(user_id, read_at, created_at)`; optional dedupe keys make
  reminder jobs idempotent.
- `outbox_events` store encrypted payloads, status, attempts, availability, dispatch/completion
  timestamps, and the last error for observability.
- `asset_uploads` are unique by storage key and tracked by expiry/completion timestamps.
- `clients` is unique on `(id, organization_id)`, enabling composite tenant foreign keys.
- Projects, client memberships, and client invitations use composite foreign keys to guarantee they
  share the client's organization.
- `invitations` enforces `INTERNAL` (role, no client) or `CLIENT` (client, no role) shapes with a
  PostgreSQL check constraint.
- Tenant-scoped indexes begin with `organization_id` where applicable.
- All child records cascade appropriately; audit actors are set to null if a user is deleted.
- Status/role fields use PostgreSQL enums.

Future tenant-owned tables (comments, asset versions, email delivery tracking) will follow the same
composite tenant-scoping pattern.

---

## Testing

```bash
npm test
```

The current suite covers:

- Atomic registration (user + organization + admin membership + session).
- Argon2id password storage; no plaintext passwords.
- HTTP-only/SameSite session cookie attributes and CSRF enforcement.
- Duplicate email rejection and input validation.
- Login/logout/session invalidation.
- Password reset: hashed token, single use, session revocation, old password rejection.
- Centralized permission matrix.
- Cross-tenant read/list/update denial using guessed IDs.
- Cross-tenant membership update denial.
- Role enforcement for admins, project managers, producers, and editors.
- Immediate access loss when a membership is deactivated; restoration on reactivation.
- Last-active-admin safeguards.
- Multi-organization users selecting workspaces without data leakage.
- Deactivated users and expired sessions.
- Invitation hashing, preview, acceptance, single-use enforcement, reissue, expiry, email matching,
  sign-in requirements, and deactivated-membership reactivation.
- Client CRUD, tenant scoping, archived-client rules, and admin/project-manager-only access.
- Client portal invitations creating `ClientMembership` only, with no internal workspace access.
- Client contact deactivation/reactivation, multiple client memberships, and active-client filtering.
- Project creation against same-tenant active clients, date validation, and cross-tenant denial.
- Producer/editor project visibility scoped to project membership.
- Project team assignment: active-member validation, duplicate idempotency, removal, and rejection of
  client users, deactivated members, and cross-tenant users.
- Project pause/resume/completion, terminal completed state, filters, and manager-only updates.
- Content creation always starting in `BRIEF`, project scoping, metadata updates, filters, and
  tenant/project denial for guessed IDs.
- Every valid workflow path, invalid skips, terminal state, required revision notes, version
  increments, and workflow event actor/from/to history.
- Role policy for content transitions: admin/manager all, producer production stages, editor
  limited to internal-review submission.
- Concurrent transition requests: exactly one succeeds, one returns `409`, and only one event is
  written.
- Content assignee rules for active members, project membership, and client users.
- Task creation, assignment, status changes, filters (status, priority, project, content, assignee,
  overdue), and editor-only-own-task status updates.
- Task tenant boundaries, cross-project content rejection, inactive/cross-tenant assignees, and
  completed-project read-only enforcement.
- Direct-to-storage uploads with signed URLs, object metadata verification, expiry and single-use
  intent handling, MIME/size validation, authorized downloads, and cross-tenant denial.
- Internal review feedback with content-version and asset linkage; client access to internal review
  records is denied.
- Client portal scoping by `ClientMembership`; visibility only from `CLIENT_APPROVAL`; hidden
  internal feedback; asset downloads.
- Version-aware client approval and revision, stale-version rejection, decision records, workflow
  events, and next-cycle review history.
- Notification assignment, review feedback, client submission, approval, mark-read/mark-all, and
  per-user isolation.
- Encrypted invitation/reset outbox emails, worker success, bounded retries, failed-job
  observability, and idempotent deadline reminders.
- Role-aware dashboard scoping for managers, producers, editors, and cross-tenant isolation.
- Database-level tenant integrity: composite project/client/membership/invitation foreign keys,
  task/content project composite keys, asset/content/project keys, review/asset keys, workflow
  transition checks, content version checks, date ordering, and invitation type-shape constraints.
- Client, project, content, workflow, task, asset, review, membership, and settings audit entries.
- Full API journey: account setup → client/project → upload → review → client revision → approval
  → notifications → dashboard → signed download.
- OpenAPI contract availability and Swagger UI.
- Health/readiness endpoints (database and Redis), request IDs, stable error envelopes, secure
  headers, and the CORS allowlist.

Tests require the Docker PostgreSQL, Redis, and S3 mock services (`npm run infra:up`).
Worker retry tests use the test queue namespace and the local Redis instance.

Browser smoke tests use Playwright:

```bash
npm run test:e2e:install   # once per machine or CI run
PLAYWRIGHT_CHANNEL=chrome npm run test:e2e
```

They cover dashboard/navigation, content/assets/notifications, the client portal, and mobile
overflow. CI installs Chromium automatically.

API smoke test against a running API (read-only; expects the seed data):

```bash
SEED_PASSWORD='StudioOS-dev-2026!' npm run api:smoke
```

It logs in through the same CSRF + cookie flow as the web app, then checks health, internal
workspace endpoints, notifications, the client portal, and role separation. For a deployed
environment, point it at the public API:

```bash
API_SMOKE_BASE_URL=https://app.example.com/api/v1 \
API_SMOKE_ADMIN_EMAIL=you@example.com \
API_SMOKE_ADMIN_PASSWORD='...' \
npm run api:smoke
```

Performance smoke against a running API:

```bash
LOAD_CONNECTIONS=100 LOAD_DURATION_SECONDS=10 npm run load:smoke
```

See [`docs/performance.md`](docs/performance.md) for the latest measured result and limitations.

### CI

`.github/workflows/ci.yml` runs on pull requests and `main`:

1. install with `npm ci`
2. Prettier check
3. ESLint
4. Typecheck
5. API tests against PostgreSQL, Redis, and the S3 mock
6. Seed browser-test data and run Playwright smoke tests
7. Production builds

`.github/workflows/release.yml` builds and publishes API/web images to GHCR on version tags, and can
deploy manually to a configured production host.

---

## Migration workflow

```bash
# After editing apps/api/prisma/schema.prisma:
npm run db:migrate -- --name your_migration_name

# Review the generated SQL in apps/api/prisma/migrations/
# Commit schema + migration together.

# In staging/production:
npm run db:deploy
```

Raw PostgreSQL constraints that Prisma cannot express live in their own migration files under
`apps/api/prisma/migrations/` (for example, the invitation type-shape and project date checks).

Never edit an already-applied migration. Add a new one.

---

## Environment variables

See `.env.example` for the full list. Highlights:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection for the API |
| `TEST_DATABASE_URL` | Separate test database (must end in `_test`) |
| `SESSION_SECRET` | At least 32 chars; keys token hashing |
| `SESSION_COOKIE_NAME` / `CSRF_COOKIE_NAME` | Cookie names |
| `WEB_ORIGIN` | Exact CORS origin for the SPA |
| `TRUST_PROXY` | Set `true` only behind a trusted reverse proxy |
| `INVITATION_BASE_URL` / `PASSWORD_RESET_BASE_URL` | Frontend links used in emails and explicit dev responses |
| `REDIS_URL` | BullMQ queue connection |
| `QUEUE_PREFIX` | Queue namespace (default `studioos`) |
| `S3_REGION` / `S3_BUCKET` / `S3_ACCESS_KEY_ID` / `S3_SECRET_ACCESS_KEY` | Object storage credentials |
| `S3_ENDPOINT` | Custom endpoint for S3-compatible storage (dev S3 mock) |
| `S3_AUTO_CREATE_BUCKET` | Development convenience; disable in production |
| `UPLOAD_URL_TTL_MINUTES` / `DOWNLOAD_URL_TTL_MINUTES` | Signed URL lifetimes |
| `ASSET_MAX_BYTES` | Maximum upload size (default 250 MB) |
| `EMAIL_PROVIDER` | `console` or `resend` |
| `EMAIL_API_KEY` / `EMAIL_FROM` | Resend credentials and sender |
| `EMAIL_JOB_ATTEMPTS` / `EMAIL_JOB_BACKOFF_MS` | Worker retry policy |
| `MONITORING_WEBHOOK_URL` | Optional sanitized error-forwarding hook |
| `API_DOCS_ENABLED` | Expose `/api/docs` and the OpenAPI JSON (default off) |
| `DEV_LINKS_ENABLED` | Return invite/reset links for local development only |
| `SEED_PASSWORD` | Development seed only; never set in production |

Required values are validated at startup. The application fails fast with a readable error if
configuration is missing or malformed.

---

## Documentation and operations

API docs are disabled unless `API_DOCS_ENABLED=true`; the production example keeps them off.

- **API docs UI:** `/api/docs` (when enabled)
- **OpenAPI JSON:** `/api/v1/openapi.json` (when enabled)
- **Security review:** [`docs/security-review.md`](docs/security-review.md)
- **Production runbook:** [`docs/production-runbook.md`](docs/production-runbook.md)
- **Figuring Out seed dataset:** [`docs/seed-data.md`](docs/seed-data.md)
- **Performance smoke:** [`docs/performance.md`](docs/performance.md)
- **Backup:** `infra/scripts/backup-postgres.sh`
- **Restore:** `infra/scripts/restore-postgres.sh`
- **Production images:** `infra/docker/api.Dockerfile`, `infra/docker/web.Dockerfile`
- **Production Compose:** `docker-compose.prod.yml`
- **Release/deploy workflow:** `.github/workflows/release.yml`

The production stack expects an external S3-compatible bucket and secrets supplied through
`.env.production`. The one-shot `migrate` service applies committed migrations before API and
worker startup.

---

## Next milestone

No further milestone is required for the MVP scope. Follow the production runbook for launch,
load testing, and operational hardening.

---

## License

Proprietary — internal StudioOS project.
