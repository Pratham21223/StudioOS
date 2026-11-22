# Figuring Out demonstration seed

## Command

```bash
SEED_DEMO_PASSWORD='a-development-password-at-least-12-characters' npm run db:seed
```

The seed refuses to run when `NODE_ENV=production`. It is idempotent: re-running updates the
seeded records in place, restores the demo workflow state, and does not create duplicate
organizations, users, clients, projects, content, tasks, reviews, or notifications.

## Accounts

| Role | Name | Email |
|---|---|---|
| Admin | Demo Admin | `admin@studioos.test` |
| Project Manager | Demo Project Manager | `manager@studioos.test` |
| Producer | Demo Producer | `producer@studioos.test` |
| Editor | Demo Editor | `editor@studioos.test` |
| Client contact | Demo Client | `client@studioos.test` |

All five identities are synthetic. The password is read from `SEED_DEMO_PASSWORD` and hashed with
the same Argon2id implementation used by the application. The Demo Client is connected only through
a `ClientMembership` to **StudioOS Demo Client**; it has no internal organization membership.

## Dataset

- Organization: **Figuring Out Media & Education** (`figuring-out-media`)
- Clients: **StudioOS Demo Client** and the internal **Figuring Out Podcast — Internal Production**
  account. No public partner is inserted as an active client.
- Projects:
  - **Flagship Podcast: Public Episode Archive** — `COMPLETED`, six real public episodes.
  - **Weekly Podcast Production Board [DEMO]** — active synthetic production board.
  - **Cross-platform Content Distribution [DEMO]** — active synthetic distribution board.
- Content: 22 items.
  - Six historical archive items (FO586–FO591), all `READY_TO_PUBLISH`, under the completed archive.
  - Seven weekly-production items in every fixed workflow stage.
  - Nine distribution items across YouTube, Shorts, Reels, audio, LinkedIn, X, Substack, and
    multilingual adaptations.
- Tasks: 96 structured tasks. Assignees are synthetic internal users. Only one task belongs to the
  Demo Admin; work is distributed across the manager, producer, and editor.
- Reviews: internal feedback, two client revision requests, and two client approvals. The demo
  client portal has one pending approval with prior revision history and one completed
  revision-then-approval history.
- Notifications: 10 seeded notifications covering assignment, deadline, internal review, client
  submission, revision, and approval.
- Workflow events: 83 transition records.
- Assets: none. No fake object storage records or download URLs are created.

Counts are also printed by the seed command and can be inspected from PostgreSQL.

## Public reference data

The seed stores the following reference data in the `seed.reference_data` audit entry:

- Company context: industry, Mumbai location, Asia/Kolkata timezone, website, launch date, company
  size snapshot, publishing cadence, brand motto, positioning, and primary host.
- Ten official social-channel snapshots with a snapshot date of **2026-11-22** and profile URLs.
- Audience snapshots: approximately 26.6M combined YouTube subscribers, 14.6M combined Instagram
  followers, 44M across channels, and 2.65B total views.
- Eight public content categories and ten production formats. The mapping to the existing
  `ContentType` enum is stored alongside the reference metadata.
- Eighteen partner references from the official partnership page, each with `REFERENCE_ONLY` status,
  public category, source URL, and an explicit note that active relationship status is not inferred.

No copyrighted logo files are downloaded. The app uses its existing StudioOS mark; the internal
client record documents the text-based branding note.

## Date strategy

Active demo project deadlines and task dates are generated relative to the UTC day the seed runs.
This keeps the workload believable without requiring manual edits. Historical episode publication
dates remain fixed public dates. Re-running the seed shifts active deadlines forward and restores
the seeded pending-approval state.

## Storage note

The asset library intentionally starts empty. Configure an S3-compatible bucket (`S3_*`) and upload
a file from a content detail page to exercise signed upload/download behavior. Never seed fake
asset metadata against a bucket that does not contain the object.

## Scope limitations

The current schema has no organization-profile, social-channel, taxonomy, partner-reference, or
guest fields. This seed keeps those values in the `seed.reference_data` audit metadata, project and
client descriptions, and content descriptions rather than adding unnecessary schema migrations.
