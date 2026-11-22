# StudioOS

StudioOS is a multi-tenant content production and operations platform for media agencies. It
brings clients, projects, deliverables, tasks, assets, reviews, and approvals into one workspace.

This repository currently implements **Milestone 0 (foundation)**, **Milestone 1 (database,
authentication, and tenancy)**, **Milestone 2 (clients and projects)**, and **Milestone 3 (content
and task workflows)** from the product specification. Later milestones build on this secure
foundation rather than replacing it.

---

## Current status

| Area | Status |
|---|---|
| Monorepo, TypeScript, linting, CI, Docker Compose | Complete (M0) |
| PostgreSQL schema and migrations | Complete (M1, M2, M3) |
| Registration, login, logout, sessions | Complete (M1) |
| Password reset with hashed single-use tokens | Complete (M1) |
| Organizations, memberships, centralized RBAC | Complete (M1) |
| Internal invitations with hashed single-use tokens | Complete (M1) |
| Tenant-isolation and authorization tests | Complete (M1, M2, M3) |
| React workspace: auth, overview, members, settings | Complete (M1) |
| Clients, client portal invitations, project CRUD, project teams | Complete (M2) |
| Client/project UI: directory, client detail, project workspace | Complete (M2) |
| Content items, fixed workflow, workflow event history | Complete (M3) |
| Task CRUD, assignment, statuses, filters, overdue views | Complete (M3) |
| Content Kanban and task board UI | Complete (M3) |
| Email delivery, assets, client review, notifications | Not started (M4–M5) |

The backend tests enforce tenant isolation, client and project boundaries, workflow validity, task
assignment rules, and server-side role authorization for each feature module.

---

## Stack

- **Runtime:** Node.js 24 LTS (minimum 22.12)
- **API:** Express 5 + TypeScript
- **Database:** PostgreSQL 17 + Prisma 6
- **Sessions:** opaque server-side sessions with HTTP-only cookies
- **Passwords:** Argon2id via `@node-rs/argon2`
- **Validation:** Zod
- **Logging:** Pino (structured JSON)
- **Web:** React 19 + Vite + React Router + Tailwind CSS 4
- **Tests:** Vitest + Supertest + a real PostgreSQL test database
- **Local infrastructure:** Docker Compose (PostgreSQL, Redis)
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
│   │   │   ├── infrastructure/  # Prisma client
│   │   │   ├── middleware/      # auth, tenant, CSRF, rate limits, errors
│   │   │   ├── modules/         # auth, orgs, clients, projects, content, tasks, invitations, audit
│   │   │   ├── shared/          # errors, validation, crypto, presenters
│   │   │   ├── app.ts
│   │   │   └── server.ts
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
│   └── postgres/init.sql
├── .github/workflows/ci.yml
├── docker-compose.yml
├── .env.example
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

3. **Start PostgreSQL and Redis**

   ```bash
   npm run infra:up
   ```

   Postgres is exposed on `5432`; the containerised Redis is exposed on `6380` to avoid clashing
   with a typical host Redis on `6379`. Both are development defaults only. Wait for both health
   checks to pass:

   ```bash
   docker compose ps
   ```

4. **Apply migrations**

   ```bash
   npm run db:migrate
   ```

   The Prisma CLI loads the repository-root `.env` when run through the root scripts.

5. **Seed development data (optional)**

   ```bash
   npm run db:seed
   ```

   The seed is idempotent and refused when `NODE_ENV=production`. It creates the
   **Northstar Studio** workspace, four internal users, one client contact, and a demo project.
   All use the password stored in `SEED_PASSWORD`:

   | Access | Email |
   |---|---|
   | Admin | `admin@northstar.test` |
   | Project Manager | `pm@northstar.test` |
   | Producer | `producer@northstar.test` |
   | Editor | `editor@northstar.test` |
   | Client contact | `client@northstar.test` |

   The client contact belongs to **Northstar Audio** through `ClientMembership` only; they are not
   an internal organization member. The seed also creates the **Podcast Season 2** project with the
   PM, Producer, and Editor assigned.

   Five content items span the workflow from `BRIEF` through `READY_TO_PUBLISH`, with matching
   workflow history. Five tasks include overdue, in-progress, and completed examples.

6. **Run the API and web app**

   ```bash
   npm run dev
   ```

   - Web: <http://localhost:5174>
   - API: <http://localhost:4000>
   - Liveness: <http://localhost:4000/health>
   - Readiness (checks PostgreSQL): <http://localhost:4000/health/ready>

   Port `5174` is used for the web app. If you change it, update `WEB_ORIGIN` and the
   invitation/reset base URLs in `.env` as well.

---

## Commands

| Command | Purpose |
|---|---|
| `npm run dev` | Run API and web concurrently |
| `npm run dev:api` | Run only the API with hot reload |
| `npm run dev:web` | Run only the web app |
| `npm run lint` | ESLint across all workspaces |
| `npm run typecheck` | TypeScript checks for shared, API, and web |
| `npm test` | API unit + integration tests against the test database |
| `npm run build` | Build shared package, API, and web |
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

## API implemented in Milestones 1–3

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
| POST | `/auth/password/forgot` | Always returns success semantics; dev response includes `resetUrl` |
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
Client users have no access to internal organization routes. The client portal UI itself is
Milestone 4.

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

### Invitations

- 256-bit random tokens; only HMAC hashes are stored.
- Single-use and expiring (default 7 days).
- Acceptance claims the invitation and creates/reactivates membership in one transaction.
- An existing account must sign in as the invited email; anonymous acceptance cannot add an
  invitation to an unrelated existing account.
- Reissuing a pending invitation rotates the token (the old link stops working).
- The raw invite URL is only returned in non-production responses until asynchronous email
  delivery is implemented in Milestone 5.

### Application hardening

- Helmet security headers, narrow CORS allowlist, 1 MB JSON limit.
- Login, registration, password-reset, and invitation endpoints are rate limited.
- Zod validates every request body and route parameter.
- Prisma parameterizes database queries.
- Error responses never expose stack traces or internal details.
- Structured logs redact cookies, authorization headers, tokens, and hashes.

### Known limitations

- Email sending and BullMQ workers are not implemented yet (Milestone 5). In development,
  invitation and reset links are returned in API responses and shown in the UI.
- Rate limiting uses an in-memory express-rate-limit store. Before running multiple API instances,
  move the limiter to Redis.
- Expired session rows are rejected on use and removed lazily; a scheduled cleanup job should be
  added with the Milestone 5 worker.
- Browser end-to-end tests are not automated yet (Milestone 6); the Milestone 1–3 flows were
  exercised manually with headless Chrome in addition to the API integration suite.
- The client portal UI and client-visible project/deliverable APIs arrive in Milestone 4. Client
  accounts created now see an access notice listing their client memberships.
- Assets, file uploads, reviews, comments, notification delivery, and approval records are not yet
  built. The workflow approval transition is internal in M3; client approval is M4.
- Task checklists (P1) and task activity timelines beyond audit events are deferred.
- Client, project, content, and task lists are not paginated yet; this is safe for the initial team
  size but should be addressed before large tenants onboard.
- The dashboard is a foundation overview; role-aware operational metrics arrive in Milestone 5.
- Production project team assignment is limited to admins and project managers. The specification's
  "limited" producer assignment capability is intentionally deferred until content ownership rules
  make the limit meaningful.
- OpenAPI/Swagger docs, production Docker images, and deployment workflows are Milestone 6 items.
- `npm audit` reports advisories inside Prisma's development CLI (`@prisma/config`, `effect`).
  They are build-tool dependencies, not part of the running API. Revisit when upgrading Prisma.

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


---

## Data model (Milestones 1–3)

```text
User ──< OrganizationMembership >── Organization
 │                                     │
 ├──< Session                          ├──< Client ──< ClientMembership >── User
 ├──< PasswordResetToken               │        │
 ├──< AuditLog                          │        └──< Project ──< ProjectMembership >── User
 │                                     │                 │
 ├──< ClientMembership                 │                 ├──< ContentItem ──< WorkflowEvent
 │                                     │                 │        │
 ├──< Task ──< ContentItem             │                 │        └──< Task
 │                                     └──< Invitation (INTERNAL or CLIENT)
 └──< WorkflowEvent
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
- `clients` is unique on `(id, organization_id)`, enabling composite tenant foreign keys.
- Projects, client memberships, and client invitations use composite foreign keys to guarantee they
  share the client's organization.
- `invitations` enforces `INTERNAL` (role, no client) or `CLIENT` (client, no role) shapes with a
  PostgreSQL check constraint.
- Tenant-scoped indexes begin with `organization_id` where applicable.
- All child records cascade appropriately; audit actors are set to null if a user is deleted.
- Status/role fields use PostgreSQL enums.

Future tenant-owned tables (assets, reviews, comments, notifications) will follow the same composite
tenant-scoping pattern.

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
- Database-level tenant integrity: composite project/client/membership/invitation foreign keys,
  task/content project composite keys, workflow transition checks, content version checks, date
  ordering, and invitation type-shape constraints.
- Client, project, content, workflow, task, membership, and settings audit entries.
- Health/readiness endpoints, request IDs, stable error envelopes, secure headers, and the CORS
  allowlist.

Tests require the Docker Postgres service. They do not require Redis.

### CI

`.github/workflows/ci.yml` runs on pull requests and `main`:

1. install with `npm ci`
2. Prettier check
3. ESLint
4. Typecheck
5. Tests against a PostgreSQL service
6. Production builds

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
| `INVITATION_BASE_URL` / `PASSWORD_RESET_BASE_URL` | Frontend links in dev responses |
| `REDIS_URL` | Reserved for the Milestone 5 worker; not used yet |
| `S3_*` | Reserved for Milestone 4 asset storage |
| `EMAIL_*` | Reserved for Milestone 5 email delivery |
| `SEED_PASSWORD` | Development seed only; never set in production |

Required values are validated at startup. The application fails fast with a readable error if
configuration is missing or malformed.

---

## Next milestone

**Milestone 4 — Assets and client approval.** It adds S3-compatible storage, signed upload intents,
upload completion verification, asset metadata and authorized downloads, the client portal, review
feedback, client approval and revision requests, and version-aware approval checks.

---

## License

Proprietary — internal StudioOS project.
