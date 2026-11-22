# StudioOS

StudioOS is a multi-tenant content production and operations platform for media agencies. It
brings clients, projects, deliverables, tasks, assets, reviews, and approvals into one workspace.

This repository currently implements **Milestone 0 (foundation)** and **Milestone 1 (database,
authentication, and tenancy)** from the product specification. Later milestones build on this
secure foundation rather than replacing it.

---

## Current status

| Area | Status |
|---|---|
| Monorepo, TypeScript, linting, CI, Docker Compose | Complete (M0) |
| PostgreSQL schema and migrations | Complete (M1) |
| Registration, login, logout, sessions | Complete (M1) |
| Password reset with hashed single-use tokens | Complete (M1) |
| Organizations, memberships, centralized RBAC | Complete (M1) |
| Internal invitations with hashed single-use tokens | Complete (M1) |
| Tenant-isolation and authorization tests | Complete (M1) |
| React workspace: auth, overview, members, settings | Complete (M1) |
| Email delivery, clients, projects, content workflow, assets, approvals | Not started (M2–M5) |

The backend tests enforce tenant isolation and server-side role authorization before feature
modules are added.

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
│   │   │   ├── modules/         # auth, users, organizations, memberships, invitations, audit
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
   **Northstar Studio** workspace and four internal users. All use the password stored in
   `SEED_PASSWORD`:

   | Role | Email |
   |---|---|
   | Admin | `admin@northstar.test` |
   | Project Manager | `pm@northstar.test` |
   | Producer | `producer@northstar.test` |
   | Editor | `editor@northstar.test` |

   Clients, projects, content items, and tasks will join the seed as those modules land in later
   milestones.

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

## API implemented in Milestone 1

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
| GET | `/auth/me` | Current user plus active memberships |
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

### Invitations

| Method | Endpoint |
|---|---|
| GET | `/invitations/:token` (public preview) |
| POST | `/invitations/accept` (authenticated or new account) |

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
- Browser end-to-end tests are not automated yet (Milestone 6); the Milestone 1 flows were exercised
  manually with headless Chrome in addition to the API integration suite.
- Client users, client memberships, and the client portal arrive in Milestones 2 and 4.
- Clients, projects, content, tasks, assets, reviews, and notification modules are not yet built.
- OpenAPI/Swagger docs, production Docker images, and deployment workflows are Milestone 6 items.
- The dashboard is a foundation overview; role-aware operational metrics arrive in Milestone 5.
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

## Data model (Milestone 1)

```text
User ──< OrganizationMembership >── Organization
 │                                     │
 ├──< Session                          ├──< Invitation
 ├──< PasswordResetToken               └──< AuditLog
 └──< AuditLog
```

Key constraints:

- `users.email` is unique and normalized to lowercase.
- `organizations.slug` is unique.
- `organization_memberships` is unique on `(organization_id, user_id)`.
- Tenant-scoped indexes begin with `organization_id` where applicable.
- All child records cascade appropriately; audit actors are set to null if a user is deleted.
- Status/role fields use PostgreSQL enums.

Future tenant-owned tables (clients, projects, content, tasks, assets, reviews) will carry
`organization_id` and composite foreign keys/indexes. Cross-organization relationships must be
rejected in the database where practical, in addition to service checks.

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
npm run db:migrate -- --name add_clients_and_projects

# Review the generated SQL in apps/api/prisma/migrations/
# Commit schema + migration together.

# In staging/production:
npm run db:deploy
```

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

**Milestone 2 — Clients and projects.** It adds client profiles, client invitations/memberships,
project CRUD, project team memberships, client/project authorization, and the internal client and
project UI. It will extend the schema with tenant-composite constraints and add isolation tests for
client users before the content workflow is built.

---

## License

Proprietary — internal StudioOS project.
