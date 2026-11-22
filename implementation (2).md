# StudioOS — Implementation Specification

**Document:** `implementation.md`  
**Version:** 1.0  
**Status:** Approved product direction; implementation-ready baseline  
**Product:** StudioOS — Content Production & Operations Management Platform

---

## 1. Instructions for the coding agent

Build StudioOS as a production-minded, multi-tenant SaaS application for media agencies. Treat this document as the source of truth for the initial MVP.

### Agent operating rules

1. Inspect the existing repository before changing anything. Preserve useful existing code and conventions.
2. If the repository is empty, scaffold the project using the architecture in this document.
3. Implement in milestones. Do not attempt to generate the entire application in one pass.
4. Before each milestone, summarize the intended changes and identify any assumptions. After each milestone, run relevant tests and report results.
5. Do not silently omit requirements. If a requirement cannot be implemented, explain why and propose the smallest safe alternative.
6. Do not use mock data as a substitute for working backend functionality. Seed data may be provided for local development and demos.
7. Never trust organization IDs, roles, client IDs, project IDs, or ownership claims supplied by the browser. Resolve identity and access from authenticated server-side context.
8. Enforce tenant and client isolation in backend services and database constraints where practical. Frontend hiding is not authorization.
9. Use transactions for operations that must remain consistent, especially workflow transitions, approval decisions, invitation acceptance, and membership changes.
10. Add automated tests as features are implemented. Security and tenant-isolation tests are mandatory.
11. Do not introduce microservices for the MVP. Use a modular monolith plus a separately runnable background worker process.
12. Keep secrets out of source control. Provide `.env.example` with placeholders only.
13. Document setup, migrations, seeding, tests, and deployment.
14. Do not implement out-of-scope features such as AI generation, social publishing, billing, or a custom workflow builder unless explicitly requested.

### Definition of done

A feature is complete only when:
- Its backend behavior is implemented.
- Authorization and tenant boundaries are enforced server-side.
- Input validation and error handling exist.
- Database constraints and indexes are considered.
- Relevant unit/integration tests pass.
- The frontend provides a usable flow when the feature requires UI.
- Documentation is updated where needed.

---

## 2. Product overview

StudioOS is a centralized content operations platform for media agencies. It manages the lifecycle of client content production, from project setup and creative brief through production, internal review, client approval, and final delivery.

### Problem

Content teams coordinate clients, projects, producers, editors, tasks, files, feedback, and deadlines across disconnected tools. This creates scattered information, unclear ownership, approval delays, file-version confusion, and poor visibility into production status.

### Product objective

Provide one source of truth for content production operations so that a media agency can manage client work and the full production lifecycle in one workspace.

### Primary product flow

An agency creates a client, creates a project for that client, adds content deliverables to the project, assigns tasks to its team, uploads assets, moves content through a fixed workflow, and requests client approval through a dedicated portal.

---

## 3. Finalized product decisions

| Area | Decision |
|---|---|
| Organization model | Multi-tenant SaaS |
| Tenancy strategy | Shared PostgreSQL database and shared schema, tenant-scoped records |
| Workflow | Fixed production lifecycle |
| Client access | Dedicated client portal |
| Asset management | Direct uploads to object storage using temporary signed URLs |
| Backend | Node.js + TypeScript |
| Backend framework | Express |
| Database | PostgreSQL |
| ORM | Prisma |
| Cache and queue | Redis + BullMQ |
| Storage | S3-compatible object storage; AWS S3 is the initial target |
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| API style | Versioned REST API |
| Architecture | Modular monolith + separate worker process |
| API documentation | OpenAPI / Swagger |
| Testing | Vitest or Jest + Supertest; use one consistent test stack |
| Packaging | Docker |
| CI | GitHub Actions |

### Product boundaries

#### MVP includes
- Organization registration and workspace management.
- Authentication and organization memberships.
- Role-based access control.
- Client profiles and client portal invitations.
- Projects and project memberships.
- Content items and fixed workflow.
- Tasks and assignments.
- Asset uploads and metadata.
- Internal review and client approval.
- Basic dashboards.
- Notifications and email invitations/reminders.
- Audit and workflow history.
- Tests, Docker setup, and deployment documentation.

#### Explicitly out of scope for MVP
- Social media publishing and scheduling.
- AI-generated scripts, captions, or content.
- AI research or podcast intelligence.
- Custom workflow builder.
- Billing and subscription management.
- Advanced video editing.
- Timestamp-based video comments.
- Advanced analytics and experimentation.
- Integrations with external project-management tools.

---

## 4. Users, actors, and permissions

StudioOS has five initial roles.

| Role | Scope | Main capabilities |
|---|---|---|
| Admin | Entire organization | Manage organization, internal members, clients, projects, and settings |
| Project Manager | Organization projects | Manage clients and projects, assign team, monitor work |
| Producer | Assigned/authorized projects | Create content, plan production, manage content workflow and tasks |
| Editor | Assigned/authorized work | Update assigned tasks, upload deliverables, respond to feedback |
| Client | Specific client account | View only their client's projects and deliverables, comment, approve, request revisions |

### Identity and membership model

A `User` is a global identity. A user may belong to multiple organizations, with a different role in each organization. Client access is represented separately from internal organization membership.

Do not make a client a normal internal organization member by default. A client user is associated with one or more `Client` records through `ClientMembership`, and receives only client-facing permissions.

### Initial permission matrix

| Action | Admin | Project Manager | Producer | Editor | Client |
|---|---:|---:|---:|---:|---:|
| Manage organization settings | Yes | No | No | No | No |
| Manage internal members | Yes | No | No | No | No |
| Invite internal members | Yes | No | No | No | No |
| Create/manage clients | Yes | Yes | No | No | No |
| Create projects | Yes | Yes | No | No | No |
| Assign project team | Yes | Yes | Limited | No | No |
| Create content items | Yes | Yes | Yes | No | No |
| Manage content workflow | Yes | Yes | Yes | Limited | No |
| Create tasks | Yes | Yes | Yes | No | No |
| Update assigned tasks | Yes | Yes | Yes | Yes | No |
| Upload assets | Yes | Yes | Yes | Yes | No |
| Internal review | Yes | Yes | Yes | Yes | No |
| Client review/approval | No | No | No | No | Yes |
| View client-facing deliverables | Yes | Yes | Yes | Yes | Yes, own client only |
| View organization dashboard | Yes | Yes | Limited | Personal view | No |
| View own client portal | No | No | No | No | Yes |

The implementation may refine permissions into named permission constants, but do not scatter role string comparisons throughout controllers. Centralize authorization policy.

---

## 5. Functional requirements

Priority levels:
- **P0:** Required for MVP.
- **P1:** Important; implement after core flows.
- **P2:** Future enhancement.

### FR-01 — Multi-tenant organization management

- FR-01.1 (P0): A user can register an organization.
- FR-01.2 (P0): Each organization has a unique workspace slug.
- FR-01.3 (P0): An organization has one or more administrators.
- FR-01.4 (P0): An organization can manage its own internal users.
- FR-01.5 (P0): Organizations own their clients, projects, content, tasks, assets, reviews, and related operational data.
- FR-01.6 (P0): An organization cannot access another organization's data.
- FR-01.7 (P0): Admins can invite internal users by email.
- FR-01.8 (P0): Admins can deactivate an organization membership.
- FR-01.9 (P1): A user can switch between organizations they belong to.
- FR-01.10 (P1): An organization can be deactivated.

### FR-02 — Authentication and authorization

- FR-02.1 (P0): Users can register and authenticate.
- FR-02.2 (P0): Users can log out.
- FR-02.3 (P0): Users can request password reset.
- FR-02.4 (P0): Passwords are stored only as secure hashes.
- FR-02.5 (P0): Organization roles are enforced on protected backend operations.
- FR-02.6 (P0): Client users have client-specific access restrictions.
- FR-02.7 (P0): Users can access only resources permitted by their active membership and role.
- FR-02.8 (P1): Users can deactivate their account, subject to ownership/admin safeguards.
- FR-02.9 (P1): Sessions can be invalidated after account or membership deactivation.

Browser authentication should use secure, HTTP-only cookies with appropriate SameSite and CSRF protections. Do not store long-lived bearer tokens in localStorage. Choose and document a coherent session strategy.

### FR-03 — Client management and portal

- FR-03.1 (P0): Admins and Project Managers can create client profiles.
- FR-03.2 (P0): Each client belongs to exactly one organization.
- FR-03.3 (P0): Authorized users can invite client contacts by email.
- FR-03.4 (P0): A client user can accept an invitation and access the client portal.
- FR-03.5 (P0): Client users can view projects associated with their client record.
- FR-03.6 (P0): Client users can view deliverables submitted for their review.
- FR-03.7 (P0): Client users can download authorized deliverables.
- FR-03.8 (P0): Client users can approve content or request revisions.
- FR-03.9 (P0): Client users cannot view another client's data or internal-only discussions.
- FR-03.10 (P1): Client profiles can contain contact details and brand guidelines.

### FR-04 — Project management

- FR-04.1 (P0): Authorized users can create projects.
- FR-04.2 (P0): Each project belongs to one organization and one client from that organization.
- FR-04.3 (P0): Projects contain title, description, status, start date, and deadline.
- FR-04.4 (P0): Project Managers can assign internal team members.
- FR-04.5 (P0): Projects can contain multiple content items.
- FR-04.6 (P0): Users can list and view projects they are authorized to access.
- FR-04.7 (P0): Project Managers can update project details.
- FR-04.8 (P0): Project Managers can pause and complete projects.
- FR-04.9 (P1): Important project changes are recorded in audit history.

### FR-05 — Fixed content production workflow

Every content item follows this fixed lifecycle:

1. `BRIEF`
2. `SCRIPT`
3. `SHOOT`
4. `EDITING`
5. `INTERNAL_REVIEW`
6. `CLIENT_APPROVAL`
7. `READY_TO_PUBLISH`

Allowed transitions:

| Current state | Allowed next state |
|---|---|
| BRIEF | SCRIPT |
| SCRIPT | SHOOT |
| SHOOT | EDITING |
| EDITING | INTERNAL_REVIEW |
| INTERNAL_REVIEW | EDITING, CLIENT_APPROVAL |
| CLIENT_APPROVAL | EDITING, READY_TO_PUBLISH |
| READY_TO_PUBLISH | None in MVP |

Requirements:
- FR-05.1 (P0): Authorized users can create content items within a project.
- FR-05.2 (P0): Content items contain title, description, content type, deadline, and status.
- FR-05.3 (P0): New content items start in `BRIEF`.
- FR-05.4 (P0): The backend validates every workflow transition.
- FR-05.5 (P0): Only authorized roles can perform transitions.
- FR-05.6 (P0): Content can be assigned to internal team members.
- FR-05.7 (P0): Users can view content in a Kanban board.
- FR-05.8 (P0): Users can filter by status, project, and assignee.
- FR-05.9 (P0): Every transition records actor, previous state, new state, and timestamp.
- FR-05.10 (P0): A client revision request transitions content from `CLIENT_APPROVAL` back to `EDITING`.
- FR-05.11 (P0): Client approval transitions content from `CLIENT_APPROVAL` to `READY_TO_PUBLISH`.
- FR-05.12 (P1): Content history is viewable in the UI.

The workflow is fixed in the MVP. Do not implement organization-configurable stages.

### FR-06 — Task management

- FR-06.1 (P0): Authorized users can create tasks.
- FR-06.2 (P0): A task belongs to an organization and project, and may optionally reference a content item.
- FR-06.3 (P0): Tasks have title, description, priority, status, due date, and assignee.
- FR-06.4 (P0): Initial task statuses are `TODO`, `IN_PROGRESS`, `BLOCKED`, and `DONE`.
- FR-06.5 (P0): Assignees can update their task status.
- FR-06.6 (P0): Users can filter tasks by status, priority, project, and assignee.
- FR-06.7 (P0): Managers can view overdue tasks.
- FR-06.8 (P1): Tasks support checklists.
- FR-06.9 (P1): Task changes are recorded in activity history.

### FR-07 — Asset and file management

- FR-07.1 (P0): Authorized internal users can upload assets.
- FR-07.2 (P0): Assets belong to an organization and are associated with a project and optionally a content item.
- FR-07.3 (P0): The system supports common image, video, and document formats.
- FR-07.4 (P0): Authorized users can view and download assets.
- FR-07.5 (P0): The backend validates declared file type, size, and upload authorization.
- FR-07.6 (P0): Asset metadata includes original filename, MIME type, byte size, storage key, uploader, and timestamps.
- FR-07.7 (P1): Revised uploads can be represented as asset versions.
- FR-07.8 (P1): Previous asset versions remain accessible to authorized users.
- FR-07.9 (P1): Assets support labels and descriptions.

Files must be stored in object storage, not in PostgreSQL or the application container filesystem. The browser uploads directly to storage using a short-lived signed URL. The backend must verify the object exists and matches the expected metadata before marking an upload complete. Use random storage keys; never expose bucket credentials.

### FR-08 — Review, feedback, and approval

- FR-08.1 (P0): Internal users can submit content for internal review.
- FR-08.2 (P0): Authorized reviewers can leave feedback.
- FR-08.3 (P0): Content can be submitted to the client only after internal review succeeds.
- FR-08.4 (P0): Client users can approve or request revisions.
- FR-08.5 (P0): Revision requests require feedback text.
- FR-08.6 (P0): Approval records include reviewer, decision, timestamp, and submitted asset/content version.
- FR-08.7 (P0): Review history is retained.
- FR-08.8 (P1): Feedback threads can be resolved.
- FR-08.9 (P1): Comments can be associated with a specific asset version.

### FR-09 — Notifications

- FR-09.1 (P1): Users receive notifications when assigned tasks.
- FR-09.2 (P1): Users receive deadline reminders.
- FR-09.3 (P1): Users receive notifications when feedback is submitted.
- FR-09.4 (P1): Users receive notifications when content is approved or sent back for revision.
- FR-09.5 (P1): Users can list and mark notifications as read.
- FR-09.6 (P1): Email delivery is processed asynchronously.

### FR-10 — Dashboard and reporting

- FR-10.1 (P0): Internal users see their assigned tasks.
- FR-10.2 (P0): Admins and Project Managers see active project counts.
- FR-10.3 (P0): Admins and Project Managers see project/content progress.
- FR-10.4 (P0): Admins and Project Managers can identify overdue tasks.
- FR-10.5 (P0): Authorized internal users can see content awaiting approval.
- FR-10.6 (P1): Managers can view completed tasks and project summaries.
- FR-10.7 (P0): Dashboard queries are scoped to the authenticated user's organization and permissions.

---

## 6. Non-functional requirements

These are initial targets and must be validated through testing. Do not claim that targets are achieved without measurements.

| ID | Category | Requirement |
|---|---|---|
| NFR-01 | Performance | 95th percentile for normal API requests should be under 500 ms under expected load, excluding file transfer and explicitly long-running jobs. |
| NFR-02 | Performance | Dashboard data should load within 2 seconds under expected load. |
| NFR-03 | Performance | Large file transfers must not occupy normal API request workers. |
| NFR-04 | Scalability | Initial deployment target is at least 100 concurrent active users. |
| NFR-05 | Scalability | API and worker processes can be scaled horizontally. |
| NFR-06 | Security | Production traffic uses HTTPS. |
| NFR-07 | Security | Passwords use Argon2id or another appropriately configured password hashing algorithm. |
| NFR-08 | Security | All tenant-owned records are tenant-scoped and protected from cross-tenant access. |
| NFR-09 | Security | Client users are restricted to their own client resources. |
| NFR-10 | Security | File upload/download operations require authorization and short-lived signed URLs. |
| NFR-11 | Security | Input validation, output encoding, rate limiting, and secure headers are applied appropriately. |
| NFR-12 | Security | Secrets are supplied through environment/configuration management, never committed. |
| NFR-13 | Reliability | Initial availability target is 99.5% monthly. |
| NFR-14 | Reliability | Background jobs support bounded retries, backoff, and failure visibility. |
| NFR-15 | Reliability | Database backups run at least daily. |
| NFR-16 | Reliability | Target RPO is 24 hours for initial deployment. |
| NFR-17 | Reliability | Target RTO is four hours for initial deployment. |
| NFR-18 | Maintainability | Business logic is separated from HTTP controllers and persistence details. |
| NFR-19 | Maintainability | Modules have unit and integration tests. |
| NFR-20 | Maintainability | API contracts and database migrations are version controlled. |
| NFR-21 | Observability | Application errors, request metadata, and job failures are logged. |
| NFR-22 | Usability | The UI is responsive for desktop and mobile browsers. |
| NFR-23 | Data integrity | Workflow transitions and approval decisions are transactional. |
| NFR-24 | Data integrity | Concurrent updates cannot silently overwrite critical changes. |

Use structured logs. Do not log passwords, session cookies, access tokens, signed URLs, or other secrets.

---

## 7. Use cases

### UC-01 — Register an organization

**Primary actor:** New user / Organization Admin

**Preconditions:** User is not authenticated. Email is valid and not already registered.

**Main flow:**
1. User submits name, email, password, and organization name.
2. API validates all fields.
3. API creates the user.
4. API creates the organization.
5. API creates an Admin organization membership.
6. API establishes an authenticated session.
7. User is redirected to the new workspace.

**Postcondition:** Organization exists with an initial Admin.

**Failure handling:** Account and organization creation must be atomic. If any required step fails, roll back the transaction.

### UC-02 — Invite an internal team member

**Primary actor:** Admin

**Preconditions:** Admin is authenticated and has an active membership in the organization.

**Main flow:**
1. Admin submits invitee email and role.
2. API verifies Admin permission.
3. API creates a single-use, expiring invitation bound to organization and role.
4. API stores only a hash of the invitation token.
5. Email job is queued.
6. Invitee opens the invitation link and authenticates or registers.
7. API validates token, expiry, and invitation state.
8. API creates organization membership and marks invitation accepted.

**Postcondition:** Invitee has the invited role in the intended organization.

### UC-03 — Create and invite a client

**Primary actor:** Admin or Project Manager

**Main flow:**
1. User creates a client profile.
2. API creates the client under the active organization.
3. User invites one or more client contacts.
4. Client accepts invitation and authenticates.
5. API creates a client membership.
6. Client can access the client portal and only the projects associated with that client.

### UC-04 — Create a project

**Primary actor:** Project Manager

**Preconditions:** Client exists in the active organization.

**Main flow:**
1. Project Manager enters title, description, dates, and client.
2. Project Manager selects internal project members.
3. API validates client and member ownership against the active organization.
4. API creates project and project memberships.
5. Project appears in authorized project lists and dashboards.

### UC-05 — Manage content production

**Primary actor:** Producer

**Preconditions:** Project exists and Producer is authorized for it.

**Main flow:**
1. Producer creates content item.
2. API sets initial status to `BRIEF`.
3. Producer creates tasks and assigns team members.
4. Team completes tasks.
5. Authorized users transition content through the fixed workflow.
6. Each transition creates a workflow event in the same transaction as the status update.
7. Relevant notifications are queued.

### UC-06 — Upload a deliverable

**Primary actor:** Editor

**Main flow:**
1. Editor requests an upload intent for a project/content item.
2. API checks role, project access, file size, and allowed MIME types.
3. API creates a random storage key and short-lived signed upload URL.
4. Browser uploads directly to object storage.
5. Browser calls upload-completion endpoint.
6. API verifies object existence and metadata.
7. API creates asset metadata record.
8. Asset is available to authorized users.

### UC-07 — Client reviews and approves content

**Primary actor:** Client

**Preconditions:** Content is in `CLIENT_APPROVAL`; client user belongs to the associated client.

**Main flow:**
1. Client logs in and opens their project.
2. Client views the submitted deliverable and review information.
3. Client approves the deliverable.
4. API verifies client-to-project/content relationship and submitted version.
5. API records approval and transitions content to `READY_TO_PUBLISH` transactionally.
6. Internal team notification is queued.

**Alternative — Revision requested:**
1. Client submits revision feedback.
2. API records the decision and feedback.
3. API transitions content back to `EDITING`.
4. Relevant internal users are notified.

### UC-08 — View dashboard

**Primary actor:** Internal user

**Main flow:**
1. User opens dashboard.
2. API resolves user identity, active organization, membership, and role.
3. API queries only authorized tenant data.
4. Dashboard displays role-appropriate projects, tasks, overdue items, and pending approvals.

---

## 8. System architecture

### 8.1 Architectural style

Use a **modular monolith** for the MVP, plus a separately runnable background worker. The API and worker share the same codebase and domain modules but run as separate processes.

Do not create microservices at this stage. The modular monolith reduces operational overhead and allows transactions across core domain operations.

### 8.2 Logical architecture

```text
                 +-----------------------------+
                 |       React Web App         |
                 |                             |
                 |  Internal Workspace         |
                 |  Client Portal              |
                 +--------------+--------------+
                                |
                           HTTPS / REST
                                |
                 +--------------v--------------+
                 |       Node.js API            |
                 |    Express + TypeScript      |
                 |                              |
                 | Authentication / Sessions   |
                 | Tenant Context               |
                 | Authorization                |
                 | Request Validation          |
                 +--------------+---------------+
                                |
        +-----------------------+-----------------------+
        |                       |                       |
+-------v--------+     +--------v--------+     +--------v--------+
| Domain Modules |     | Infrastructure   |     | Background Jobs|
|                |     |                  |     |                |
| Organizations  |     | Prisma           |     | BullMQ Worker  |
| Memberships    |     | Redis            |     | Email delivery |
| Clients        |     | Object Storage   |     | Reminders      |
| Projects       |     | Email Provider   |     | Asset jobs     |
| Content        |     |                  |     |                |
| Tasks          |     +------------------+     +----------------+
| Assets         |
| Reviews        |
| Notifications  |
| Dashboard      |
| Audit          |
+-------+--------+
        |
+-------v--------+
|  PostgreSQL    |
|  Shared schema |
|  Tenant scoped |
+----------------+
```

### 8.3 Technology choices

| Layer | Technology |
|---|---|
| Frontend | React + TypeScript |
| Styling | Tailwind CSS |
| Backend runtime | Node.js |
| Backend framework | Express |
| Language | TypeScript |
| Database | PostgreSQL |
| ORM/migrations | Prisma |
| Queue | BullMQ |
| Queue/cache store | Redis |
| File storage | AWS S3 (or S3-compatible adapter) |
| Email | Resend or Amazon SES behind an adapter |
| API documentation | OpenAPI / Swagger |
| Testing | Vitest or Jest + Supertest |
| Containerization | Docker |
| CI | GitHub Actions |

Use a supported Node.js LTS release and pin package versions. The agent should select compatible versions at implementation time and record them in the package manifests.

### 8.4 Suggested repository structure

A monorepo is recommended:

```text
studio-os/
├── apps/
│   ├── web/
│   │   ├── src/
│   │   │   ├── app/
│   │   │   ├── components/
│   │   │   ├── features/
│   │   │   │   ├── auth/
│   │   │   │   ├── organizations/
│   │   │   │   ├── clients/
│   │   │   │   ├── projects/
│   │   │   │   ├── content/
│   │   │   │   ├── tasks/
│   │   │   │   ├── assets/
│   │   │   │   ├── reviews/
│   │   │   │   └── dashboard/
│   │   │   ├── hooks/
│   │   │   └── lib/
│   │   └── ...
│   │
│   └── api/
│       ├── src/
│       │   ├── config/
│       │   ├── modules/
│       │   │   ├── auth/
│       │   │   ├── organizations/
│       │   │   ├── memberships/
│       │   │   ├── clients/
│       │   │   ├── projects/
│       │   │   ├── content/
│       │   │   ├── tasks/
│       │   │   ├── assets/
│       │   │   ├── reviews/
│       │   │   ├── notifications/
│       │   │   ├── dashboard/
│       │   │   └── audit/
│       │   ├── middleware/
│       │   ├── infrastructure/
│       │   │   ├── database/
│       │   │   ├── storage/
│       │   │   ├── queue/
│       │   │   └── email/
│       │   ├── shared/
│       │   ├── app.ts
│       │   └── server.ts
│       ├── worker/
│       │   └── src/
│       └── prisma/
│           ├── schema.prisma
│           └── migrations/
│
├── packages/
│   └── shared/
├── infra/
├── docker-compose.yml
├── .env.example
├── package.json
└── README.md
```

Each backend module should use a consistent separation of responsibilities:

```text
module-name/
├── module.routes.ts
├── module.controller.ts
├── module.service.ts
├── module.repository.ts
├── module.validation.ts
├── module.types.ts
└── module.test.ts
```

Responsibilities:
- **Routes:** HTTP method/path and middleware composition.
- **Controllers:** Translate HTTP request/response; no business rules.
- **Services:** Business logic and transaction orchestration.
- **Repositories:** Persistence queries.
- **Validation:** Request schemas and input validation.
- **Types:** Domain and module-specific types.

Avoid unnecessary abstractions. Keep module interfaces explicit and prevent circular dependencies.

---

## 9. Multi-tenancy and authorization design

This is a critical system property and must be implemented before feature modules are expanded.

### 9.1 Selected strategy

Use a shared PostgreSQL database and shared schema. Every tenant-owned table contains an `organizationId`/`organization_id` field.

Example:

| id | organization_id | client_id | name |
|---|---|---|---|
| 101 | ORG_A | CLIENT_A1 | Podcast Campaign |
| 102 | ORG_A | CLIENT_A2 | Brand Launch |
| 103 | ORG_B | CLIENT_B1 | Product Videos |
| 104 | ORG_C | CLIENT_C1 | Founder Series |

### 9.2 Tenant context

For every protected organization request:

1. Authenticate the user.
2. Resolve the requested active organization.
3. Verify the user has an active membership in that organization.
4. Resolve the membership role and permissions server-side.
5. Attach trusted tenant context to the request/service context.
6. Execute tenant-scoped service and repository operations.
7. Verify resource ownership and relationship constraints.

An organization ID in the URL is a selector, not proof of authorization. The server must verify membership.

### 9.3 Client authorization

Client access requires a second boundary:

1. Resolve authenticated user.
2. Resolve active `ClientMembership`.
3. Resolve the client record.
4. Verify the requested project belongs to that client.
5. Verify content belongs to that project and is visible to the client.
6. Permit only client-facing operations.

Client users must never access internal-only notes, internal task assignments, internal audit information, or another client's data.

### 9.4 Database-level safeguards

- Use composite unique constraints and composite foreign keys where needed to ensure related records share the same organization.
- Add indexes beginning with `organization_id` for common tenant-scoped queries.
- Consider PostgreSQL Row-Level Security as defense in depth. If used, set tenant context transaction-locally and ensure connection pooling cannot leak tenant context between requests.
- Do not rely solely on RLS or solely on application checks. Use layered controls.
- Never accept a tenant ID from the request body as the authority for data ownership.

### 9.5 Mandatory tenant-isolation tests

Create at least two organizations, two clients, and users belonging to different organizations. Test that:
- Org A cannot list Org B projects.
- Org A cannot fetch Org B project by guessing its ID.
- Org A cannot update or delete Org B resources.
- Org A cannot attach its task to Org B's project.
- A client user cannot view another client's project.
- A client user cannot download another client's asset.
- A deactivated member loses access.
- A user belonging to two organizations sees only the selected organization's resources.

---

## 10. Domain model and initial database design

The following entities form the initial model. Refine field types and constraints during schema implementation, but preserve the relationships and security boundaries.

### Core entities

| Entity | Key fields |
|---|---|
| Organization | id, name, slug, status, createdAt |
| User | id, name, email, passwordHash, status, createdAt |
| OrganizationMembership | id, organizationId, userId, role, status |
| Client | id, organizationId, name, email, status |
| ClientMembership | id, clientId, userId, status |
| Project | id, organizationId, clientId, name, description, status, startDate, deadline |
| ProjectMembership | id, organizationId, projectId, userId |
| ContentItem | id, organizationId, projectId, title, description, type, status, deadline, version |
| Task | id, organizationId, projectId, contentItemId nullable, title, description, status, priority, assigneeId, dueDate |
| Asset | id, organizationId, projectId, contentItemId nullable, uploadedById, originalFilename, mimeType, sizeBytes, storageKey |
| AssetVersion | id, organizationId, assetId, versionNumber, storageKey, uploadedById, createdAt |
| Review | id, organizationId, contentItemId, reviewerId, decision, assetVersionId nullable, feedback, createdAt |
| Comment | id, organizationId, reviewId, authorId, body, createdAt |
| WorkflowEvent | id, organizationId, contentItemId, actorId, fromStatus, toStatus, createdAt |
| Invitation | id, organizationId, email, role, tokenHash, expiresAt, acceptedAt |
| Notification | id, organizationId nullable, userId, type, payload, readAt, createdAt |
| AuditLog | id, organizationId, actorId, action, resourceType, resourceId, metadata, createdAt |

Additional supporting tables may be introduced for sessions, password reset tokens, idempotency keys, outbox events, and email delivery tracking.

### Relationships

- Organization has many OrganizationMemberships.
- User has many OrganizationMemberships.
- Organization has many Clients.
- Client has many ClientMemberships.
- User has many ClientMemberships.
- Organization has many Projects.
- Client has many Projects.
- Project has many ProjectMemberships.
- Project has many ContentItems and Tasks.
- ContentItem has many Tasks, Assets, Reviews, and WorkflowEvents.
- Asset has many AssetVersions.
- Review has many Comments.
- User receives Notifications.
- Organization has AuditLogs.

### Database design constraints

- `users.email` must be unique after normalization.
- `organizations.slug` must be unique.
- `organization_memberships` must be unique on `(organization_id, user_id)`.
- `client_memberships` must be unique on `(client_id, user_id)`.
- Project must reference a client from the same organization.
- Project memberships must reference users with valid active organization memberships.
- Tasks, assets, reviews, and workflow events must reference resources from the same organization.
- Content item status must use a constrained enum or validated database representation.
- `asset_versions` must be unique on `(asset_id, version_number)`.
- Invitation tokens must be single-use, hashed at rest, and expire.
- Use soft deletion only where product requirements justify it; do not let soft-deleted resources bypass authorization or uniqueness rules.

### Important modeling note

A content item is a deliverable, not a task. For example, a podcast episode is a content item, while research, scripting, recording, editing, and thumbnail creation are separate tasks associated with that content item or project.

---

## 11. Workflow state machine

Implement the fixed lifecycle in a dedicated domain service, not in frontend-only logic.

### States

```text
BRIEF
SCRIPT
SHOOT
EDITING
INTERNAL_REVIEW
CLIENT_APPROVAL
READY_TO_PUBLISH
```

### Transition rules

```text
BRIEF -> SCRIPT
SCRIPT -> SHOOT
SHOOT -> EDITING
EDITING -> INTERNAL_REVIEW
INTERNAL_REVIEW -> EDITING
INTERNAL_REVIEW -> CLIENT_APPROVAL
CLIENT_APPROVAL -> EDITING
CLIENT_APPROVAL -> READY_TO_PUBLISH
READY_TO_PUBLISH -> terminal
```

### Transition requirements

- Validate current state and requested next state.
- Validate actor role and resource access.
- Validate required information for the transition.
- Update content state and insert workflow event in one database transaction.
- Use row locking or optimistic concurrency control to prevent conflicting concurrent transitions.
- Make approval/revision actions idempotent where practical.
- A client revision request must include feedback.
- A client approval must reference the deliverable/version that was submitted for approval.
- Do not permit approval of a stale version if a newer version has replaced the submitted deliverable.

The exact permission policy should be centralized. Suggested baseline:
- Admin and Project Manager: all permitted transitions.
- Producer: production transitions and internal-review submission, subject to project access.
- Editor: task updates and upload; may submit for internal review only if explicitly granted that permission.
- Client: only approve or request revision while the item is in `CLIENT_APPROVAL`.

---

## 12. API design

Use REST APIs under:

```text
/api/v1
```

Use consistent JSON response shapes, validation errors, pagination, and HTTP status codes. Document all endpoints using OpenAPI.

### Authentication

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/auth/register` | Register user and organization |
| POST | `/auth/login` | Authenticate |
| POST | `/auth/logout` | End session |
| GET | `/auth/me` | Current user and memberships |
| POST | `/auth/password/forgot` | Request reset |
| POST | `/auth/password/reset` | Reset password |

### Organizations and memberships

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/organizations` | List user's organizations |
| GET | `/organizations/:orgId` | Get organization |
| PATCH | `/organizations/:orgId` | Update organization |
| GET | `/organizations/:orgId/members` | List members |
| POST | `/organizations/:orgId/invitations` | Invite member |
| POST | `/invitations/accept` | Accept invitation |
| PATCH | `/organizations/:orgId/members/:membershipId` | Change role/status |

### Clients

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/clients` | Create client |
| GET | `/organizations/:orgId/clients` | List clients |
| GET | `/organizations/:orgId/clients/:clientId` | Get client |
| PATCH | `/organizations/:orgId/clients/:clientId` | Update client |
| POST | `/organizations/:orgId/clients/:clientId/invitations` | Invite client contact |

### Projects

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/projects` | Create project |
| GET | `/organizations/:orgId/projects` | List projects |
| GET | `/organizations/:orgId/projects/:projectId` | Get project |
| PATCH | `/organizations/:orgId/projects/:projectId` | Update project |
| POST | `/organizations/:orgId/projects/:projectId/members` | Assign team members |

### Content

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/projects/:projectId/content-items` | Create content item |
| GET | `/organizations/:orgId/projects/:projectId/content-items` | List content |
| GET | `/organizations/:orgId/content-items/:contentId` | Get content |
| PATCH | `/organizations/:orgId/content-items/:contentId` | Update content details |
| POST | `/organizations/:orgId/content-items/:contentId/transitions` | Request workflow transition |

### Tasks

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/tasks` | Create task |
| GET | `/organizations/:orgId/tasks` | List/filter tasks |
| GET | `/organizations/:orgId/tasks/:taskId` | Get task |
| PATCH | `/organizations/:orgId/tasks/:taskId` | Update task |
| PATCH | `/organizations/:orgId/tasks/:taskId/status` | Update task status |

### Assets

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/assets/upload-intents` | Request signed upload URL |
| POST | `/organizations/:orgId/assets/complete` | Verify upload and register asset |
| GET | `/organizations/:orgId/assets/:assetId` | Get asset metadata |
| POST | `/organizations/:orgId/assets/:assetId/download-url` | Request authorized download URL |
| GET | `/organizations/:orgId/content-items/:contentId/assets` | List content assets |

### Reviews and client portal

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/organizations/:orgId/content-items/:contentId/reviews` | Submit for review |
| GET | `/organizations/:orgId/reviews` | List internal reviews |
| POST | `/organizations/:orgId/reviews/:reviewId/comments` | Add review comment |
| GET | `/client-portal/projects` | List client's projects |
| GET | `/client-portal/projects/:projectId/content-items` | List client-visible content |
| GET | `/client-portal/content-items/:contentId` | View submitted content |
| POST | `/client-portal/content-items/:contentId/approve` | Approve submitted version |
| POST | `/client-portal/content-items/:contentId/request-revision` | Request revision |

### Dashboard and notifications

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/organizations/:orgId/dashboard` | Organization dashboard |
| GET | `/notifications` | List current user's notifications |
| PATCH | `/notifications/:notificationId/read` | Mark notification as read |

Do not treat this table as permission to expose every endpoint to every role. Each route must declare and enforce its policy.

---

## 13. Key request flows

### 13.1 Authentication and tenant resolution

```text
Browser
  -> POST /auth/login
  -> API validates credentials
  -> API creates secure session
  -> Browser stores HTTP-only session cookie

Browser
  -> GET /organizations/:orgId/projects
  -> Authentication middleware resolves user
  -> Tenant middleware verifies active organization membership
  -> Authorization middleware checks permission
  -> Service performs tenant-scoped query
  -> API returns authorized data
```

The organization ID in the URL selects a workspace but never establishes access by itself.

### 13.2 Workflow transition

```text
Editor/Producer
  -> POST content transition
  -> Authenticate and resolve tenant
  -> Authorize actor and project access
  -> Load content item and current state
  -> Validate state transition
  -> Begin database transaction
       -> Update content status/version
       -> Insert workflow event
       -> Insert outbox/notification event if implemented
  -> Commit transaction
  -> Return updated content
  -> Worker sends notifications asynchronously
```

### 13.3 Direct asset upload

```text
Browser -> API: Request upload intent
API: Verify tenant, project access, file size and MIME type
API -> Storage: Create short-lived signed upload URL
API -> Browser: Return URL and upload metadata
Browser -> Storage: Upload file directly
Browser -> API: Confirm upload
API -> Storage: Verify object exists and metadata
API -> Database: Create asset record
API -> Browser: Return asset
```

For large files, consider multipart upload and resumable transfer. Do not proxy large file bytes through Express.

---

## 14. Background jobs and event handling

Use BullMQ with Redis for operations that should not block HTTP requests.

Initial job types:
- `SEND_ORGANIZATION_INVITATION`
- `SEND_CLIENT_INVITATION`
- `SEND_TASK_ASSIGNED_NOTIFICATION`
- `SEND_REVIEW_NOTIFICATION`
- `SEND_APPROVAL_NOTIFICATION`
- `SEND_DEADLINE_REMINDER`
- `PROCESS_ASSET_METADATA` (future, if needed)

Requirements:
- Jobs must be idempotent where practical.
- Use bounded retries with exponential backoff.
- Record failed jobs and make them observable.
- Do not put secrets or unnecessary personal data into job payloads.
- A queue failure must not silently roll back an already committed business operation.

For reliable event delivery, consider a transactional outbox table. Write the domain change and outbox event in one PostgreSQL transaction, then have a worker publish/process pending events. This avoids losing notifications when the database commits but Redis is unavailable.

---

## 15. Security requirements and implementation checklist

Security is a core requirement, especially because the product stores client content and private media assets.

### Authentication
- Secure password hashing (Argon2id recommended).
- Secure, HTTP-only, SameSite cookies.
- CSRF protection for cookie-authenticated state-changing requests.
- Session rotation after login and privilege changes.
- Password reset tokens are random, single-use, hashed at rest, and expiring.
- Rate limit login, registration, invitation, and password reset endpoints.

### Authorization
- Centralized permission policy.
- Tenant membership verification on every tenant route.
- Client membership and client-resource verification on every portal route.
- Resource ownership checks in services/repositories.
- Do not rely on hidden UI controls.
- Deactivated users/memberships lose access.

### File security
- Allowlist MIME types and extensions.
- Enforce maximum file size.
- Generate random object storage keys.
- Use short-lived signed URLs.
- Verify object metadata on upload completion.
- Prevent public bucket access by default.
- Never accept arbitrary storage keys from users as authorization.
- Consider malware scanning before broader production use.

### Application security
- Validate all request bodies, params, and query strings.
- Use secure HTTP headers.
- Configure CORS narrowly.
- Use parameterized database operations through Prisma.
- Avoid leaking stack traces or internal errors to clients.
- Protect against brute force and abuse.
- Keep secrets in environment variables/secret manager.
- Log security-relevant events without logging credentials or tokens.

### Audit
Record important events such as:
- Membership and role changes.
- Invitations created/accepted/revoked.
- Project ownership or status changes.
- Content workflow transitions.
- Review decisions.
- Asset uploads and deletions.
- Organization settings changes.

---

## 16. Frontend requirements

The frontend contains two experiences in one application:

### Internal workspace
- Login and registration.
- Organization/workspace switcher.
- Dashboard.
- Client directory and client details.
- Project list and project detail.
- Project team management.
- Content Kanban board.
- Content detail and workflow history.
- Task list and task detail.
- Asset library and uploads.
- Internal review interface.
- Notifications.
- Organization settings and member management.

### Client portal
- Client login and invitation acceptance.
- Client dashboard.
- Client's project list.
- Project detail with client-visible content only.
- Deliverable preview/download.
- Review feedback.
- Approve and request-revision actions.
- Review history.

### UI behavior
- Responsive desktop/mobile layouts.
- Loading, empty, success, and error states.
- Confirmation for destructive or irreversible actions.
- Clear display of workflow status and due dates.
- Forms with client-side validation, backed by server-side validation.
- Role-aware navigation, while still enforcing all permissions on the backend.

Do not expose internal task boards, internal comments, or internal audit logs in the client portal.

---

## 17. Testing strategy

Testing must be implemented throughout development, not postponed until the end.

### Unit tests
- Workflow transition rules.
- Permission policy.
- Tenant context resolution.
- Input validation.
- Service business rules.
- Invitation token validation.
- Approval and revision decision rules.

### Integration tests
- Registration creates user, organization, and Admin membership atomically.
- Invitation acceptance creates correct membership.
- Project creation validates organization/client consistency.
- Content transition updates state and workflow history atomically.
- Client approval updates review and content state atomically.
- Upload completion verifies storage object before asset registration.
- Background jobs retry and report failure correctly.

### Security and tenant-isolation tests
- Cross-tenant read denied.
- Cross-tenant update/delete denied.
- Cross-tenant relationship creation rejected.
- Client A cannot access Client B data.
- Client cannot access internal-only information.
- Deactivated membership cannot access workspace.
- Guessed IDs do not bypass authorization.
- Signed download URL cannot be generated for unauthorized assets.

### End-to-end tests
At minimum, automate these user journeys:
1. Register organization and log in.
2. Invite internal team member and accept invitation.
3. Create client and invite client user.
4. Create project and assign team.
5. Create content item and tasks.
6. Move content through workflow.
7. Upload deliverable.
8. Submit for client approval.
9. Client requests revision.
10. Editor uploads revised deliverable.
11. Client approves latest version.
12. Verify the other tenant cannot access any of the above resources.

---

## 18. Development roadmap and milestone acceptance criteria

Implement in this order. Do not move to the next milestone until the acceptance criteria for the current milestone pass.

### Milestone 0 — Repository and development foundation

Deliver:
- Monorepo structure.
- TypeScript configuration.
- Linting and formatting.
- Environment configuration validation.
- Docker Compose for PostgreSQL and Redis.
- Health endpoint.
- CI workflow running lint, typecheck, and tests.
- README with local setup.

Acceptance:
- A developer can clone the repository, configure environment, start dependencies, and run the application.
- No secrets are committed.
- CI passes on a clean checkout.

### Milestone 1 — Database, authentication, and tenancy

Deliver:
- Initial Prisma schema and migrations.
- User, Organization, OrganizationMembership, Session, Invitation models.
- Registration and login/logout.
- Secure password hashing.
- Organization creation and membership.
- Tenant context middleware.
- Centralized RBAC policy.
- Tenant-isolation integration tests.

Acceptance:
- User can register an organization and become its Admin.
- User can log in and access their workspace.
- A user without membership cannot access an organization.
- Cross-tenant tests pass.
- Role checks are performed server-side.

**This is the first major engineering gate. Do not build the remaining modules on an insecure tenancy foundation.**

### Milestone 2 — Clients and projects

Deliver:
- Client CRUD.
- Client invitations and memberships.
- Project CRUD.
- Project memberships.
- Client and project authorization.
- Basic internal UI for clients and projects.

Acceptance:
- Project Manager can create a client and project.
- Project can only reference a client in the same organization.
- Project members must be valid organization members.
- Client users cannot access unrelated clients/projects.

### Milestone 3 — Content and task workflows

Deliver:
- Content item CRUD.
- Fixed workflow state machine.
- Workflow event history.
- Task CRUD and assignment.
- Kanban board.
- Task filters and overdue views.

Acceptance:
- Content starts in `BRIEF`.
- Only permitted transitions succeed.
- Invalid transitions are rejected by backend.
- Workflow state and history are committed atomically.
- Tasks cannot reference resources from another tenant.

### Milestone 4 — Assets and client approval

Deliver:
- S3-compatible storage adapter.
- Signed upload intents.
- Upload completion verification.
- Asset metadata and downloads.
- Client portal.
- Review and feedback records.
- Client approval and revision requests.
- Version-aware approval checks.

Acceptance:
- Files upload directly to storage.
- Unauthorized users cannot generate upload/download URLs.
- Client can see only their own submitted deliverables.
- Client can approve or request revision.
- Approval references the submitted version.
- Revision returns content to `EDITING`.
- Approval moves content to `READY_TO_PUBLISH`.

### Milestone 5 — Notifications and dashboards

Deliver:
- Redis and BullMQ worker.
- Invitation emails.
- Assignment and review notifications.
- Deadline reminders.
- In-app notifications.
- Role-aware dashboard.

Acceptance:
- Email and notification work is asynchronous.
- Retry behavior is tested.
- Failed jobs are observable.
- Dashboard data is permission- and tenant-scoped.

### Milestone 6 — Hardening and deployment

Deliver:
- Full integration and end-to-end test suite.
- Security review.
- Structured logs.
- Error monitoring hooks.
- Database backup procedure.
- Production Docker configuration.
- CI/CD deployment workflow.
- OpenAPI documentation.
- Production setup and recovery runbook.

Acceptance:
- All required tests pass.
- No known critical tenant-isolation issue remains.
- Production secrets are configured securely.
- Backup and recovery procedures are documented.
- Performance targets are measured under a representative test load.

---

## 19. Initial environment variables

Create `.env.example` with placeholders. Validate required values at application startup.

```dotenv
NODE_ENV=development
PORT=4000
WEB_ORIGIN=http://localhost:5173
API_BASE_URL=http://localhost:4000/api/v1

DATABASE_URL=postgresql://postgres:postgres@localhost:5432/studio_os
REDIS_URL=redis://localhost:6379

SESSION_SECRET=replace-with-a-long-random-secret
SESSION_COOKIE_NAME=studioos_session

S3_REGION=ap-south-1
S3_BUCKET=studioos-development
S3_ACCESS_KEY_ID=
S3_SECRET_ACCESS_KEY=
S3_ENDPOINT=

EMAIL_PROVIDER=resend
EMAIL_API_KEY=
EMAIL_FROM=

INVITATION_BASE_URL=http://localhost:5173/invitations/accept
PASSWORD_RESET_BASE_URL=http://localhost:5173/password/reset

LOG_LEVEL=debug
```

Adapt this list to the actual session and storage implementation. Never use the sample values in production.

---

## 20. Seed data and local demo

Provide a development-only seed script that creates:
- One demo organization.
- One Admin.
- One Project Manager.
- One Producer.
- One Editor.
- One client and one client portal user.
- One active project.
- A few content items at different workflow stages.
- Example tasks.

Seed credentials must be clearly documented as development-only and must not be enabled in production.

The seed should be repeatable or should fail safely when records already exist.

---

## 21. Observability and operations

Initial operational requirements:
- Structured application logs with request IDs.
- Health endpoint for API liveness/readiness.
- Worker health and queue failure visibility.
- Database connection and migration status checks.
- Error responses with stable error codes.
- No sensitive values in logs.
- Metrics or instrumentation for request latency, error rate, job failures, and queue depth as deployment matures.

Suggested error response:

```json
{
  "error": {
    "code": "RESOURCE_NOT_FOUND",
    "message": "The requested resource was not found.",
    "requestId": "request-id"
  }
}
```

Do not reveal whether an inaccessible cross-tenant resource exists. Return a not-found style response where appropriate to reduce resource enumeration.

---

## 22. Product acceptance scenarios

The MVP is demonstrable when this end-to-end scenario works:

1. A person registers a new StudioOS organization.
2. They become the organization's Admin.
3. Admin invites a Project Manager, Producer, and Editor.
4. Project Manager creates a client and invites a client contact.
5. Project Manager creates a project for that client.
6. Project Manager assigns internal team members.
7. Producer creates a podcast content item in `BRIEF`.
8. Producer creates research, scripting, recording, and editing tasks.
9. Team members update their assigned tasks.
10. Authorized users move the content through the fixed lifecycle.
11. Editor uploads a deliverable directly to object storage.
12. Internal reviewer sends it to client approval.
13. Client logs into the portal and reviews the deliverable.
14. Client requests a revision with feedback.
15. Content returns to `EDITING`.
16. Editor uploads the revised version.
17. Content is internally reviewed and resubmitted.
18. Client approves the latest submitted version.
19. Content reaches `READY_TO_PUBLISH`.
20. Notifications and history show the relevant actions.
21. A user from a second organization cannot access any first-organization data, even with guessed resource IDs.

This scenario is the primary MVP acceptance test.

---

## 23. Implementation priorities

The order of importance is:

1. Correct tenant isolation.
2. Correct authentication and authorization.
3. Correct relational data model and constraints.
4. Correct content workflow and approval transactions.
5. Reliable asset access.
6. Usable internal and client-facing interfaces.
7. Background jobs and notifications.
8. Dashboards, polish, and advanced reporting.

Do not optimize prematurely. Build measurable, testable functionality first.

## 24. Final instruction to the coding agent

Start by inspecting the repository and reporting:
- Existing stack and folder structure.
- Existing implemented features, if any.
- Missing infrastructure.
- Conflicts with this specification.

Then propose a concise execution plan for **Milestone 0 and Milestone 1 only**. Once approved or once operating in an autonomous coding workflow, implement those milestones, run tests, and report:
- Files created/changed.
- Database migrations.
- Commands to run locally.
- Tests executed and results.
- Security decisions made.
- Known limitations and next steps.

Do not jump ahead to the full product before the multi-tenant foundation is implemented and tested.

---

**End of specification.**
