# StudioOS

StudioOS is a multi-tenant content production and operations platform for media agencies. It gives
studios one workspace to manage clients, projects, deliverables, tasks, assets, reviews, and client
approvals — with separate internal and client-facing experiences.

## What it does

- **Clients and projects** — client accounts, portal invitations, project teams, and deliverables.
- **Content workflow** — a fixed pipeline from brief to publish, with versioned transitions and
  full event history.
- **Tasks** — assignment, statuses, priorities, deadlines, filters, and overdue views.
- **Assets** — direct-to-storage uploads, verified files, and secure short-lived download links.
- **Reviews and approvals** — internal feedback plus client approval or revision requests through a
  dedicated portal.
- **Teams and roles** — organizations, memberships, invitations, and scoped permissions for admins,
  project managers, producers, editors, and clients.
- **Notifications** — in-app alerts, email delivery, and deadline reminders.
- **Dashboard** — a role-aware overview of projects, content, and workload.

Access is tenant-isolated throughout: client users only see their own projects, and internal users
only see the projects they belong to.

## Stack

- **Runtime:** Node.js + TypeScript
- **API:** Express 5
- **Database:** PostgreSQL + Prisma
- **Web:** React 19 + Vite + Tailwind CSS
- **Jobs:** Redis + BullMQ
- **Storage:** S3-compatible object storage
- **Tooling:** Vitest, Playwright, Docker Compose, GitHub Actions

## Run locally

Requires Node.js 22.12+, npm, and Docker.

```bash
npm install
cp .env.example .env        # set SESSION_SECRET and SEED_PASSWORD
npm run infra:up            # PostgreSQL, Redis, and local S3 mock
npm run db:migrate
npm run db:seed             # optional demo data
npm run dev                 # start API, web app, and worker
```

The web app runs at http://localhost:5174 and the API at http://localhost:4000.

Also available: `npm test`, `npm run test:e2e`, `npm run build`, `npm run lint`, and
`npm run typecheck`.

## Documentation

- [Security review](docs/security-review.md)
- [Production runbook](docs/production-runbook.md)

## License

Proprietary — internal StudioOS project.
