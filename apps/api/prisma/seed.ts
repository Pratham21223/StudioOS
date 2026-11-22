import { env } from "../src/config/env.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { hashPassword } from "../src/shared/password.js";

const DEMO_ORG = {
  name: "Northstar Studio",
  slug: "northstar-studio",
};

const DEMO_USERS = [
  { name: "Avery Admin", email: "admin@northstar.test", role: "ADMIN" as const },
  {
    name: "Priya Manager",
    email: "pm@northstar.test",
    role: "PROJECT_MANAGER" as const,
  },
  { name: "Noah Producer", email: "producer@northstar.test", role: "PRODUCER" as const },
  { name: "Elena Editor", email: "editor@northstar.test", role: "EDITOR" as const },
];

const DEMO_CLIENT_USER = {
  name: "Jordan Lee",
  email: "client@northstar.test",
};

const DEMO_CLIENT = {
  name: "Northstar Audio",
  contactName: "Jordan Lee",
  email: "hello@northstaraudio.test",
  website: "https://northstaraudio.test",
  notes: "Podcast and audio-first brand work.",
};

const DEMO_PROJECT = {
  name: "Podcast Season 2",
  description: "Eight-episode narrative season with client review at each cut.",
  startDate: new Date("2026-11-02T00:00:00.000Z"),
  deadline: new Date("2026-12-18T00:00:00.000Z"),
};

type SeedContentStatus =
  | "BRIEF"
  | "SCRIPT"
  | "SHOOT"
  | "EDITING"
  | "INTERNAL_REVIEW"
  | "CLIENT_APPROVAL"
  | "READY_TO_PUBLISH";

const STATUS_PATHS: Record<SeedContentStatus, SeedContentStatus[]> = {
  BRIEF: [],
  SCRIPT: ["SCRIPT"],
  SHOOT: ["SCRIPT", "SHOOT"],
  EDITING: ["SCRIPT", "SHOOT", "EDITING"],
  INTERNAL_REVIEW: ["SCRIPT", "SHOOT", "EDITING", "INTERNAL_REVIEW"],
  CLIENT_APPROVAL: ["SCRIPT", "SHOOT", "EDITING", "INTERNAL_REVIEW", "CLIENT_APPROVAL"],
  READY_TO_PUBLISH: [
    "SCRIPT",
    "SHOOT",
    "EDITING",
    "INTERNAL_REVIEW",
    "CLIENT_APPROVAL",
    "READY_TO_PUBLISH",
  ],
};

const DEMO_CONTENT = [
  {
    title: "Episode 01 — The Long Game",
    description: "Narrative season opener with the founder interview.",
    type: "PODCAST" as const,
    status: "CLIENT_APPROVAL" as const,
    deadline: new Date("2026-12-04T00:00:00.000Z"),
    assigneeEmail: "producer@northstar.test",
  },
  {
    title: "Episode 02 — Signal and Noise",
    description: "Second episode, currently with the editor.",
    type: "PODCAST" as const,
    status: "EDITING" as const,
    deadline: new Date("2026-12-08T00:00:00.000Z"),
    assigneeEmail: "editor@northstar.test",
  },
  {
    title: "Season 2 Trailer",
    description: "60-second trailer for the season launch.",
    type: "VIDEO" as const,
    status: "SCRIPT" as const,
    deadline: new Date("2026-11-28T00:00:00.000Z"),
    assigneeEmail: "producer@northstar.test",
  },
  {
    title: "Cover Art Refresh",
    description: "Updated podcast artwork for the new season.",
    type: "DESIGN" as const,
    status: "BRIEF" as const,
    deadline: new Date("2026-12-10T00:00:00.000Z"),
    assigneeEmail: "editor@northstar.test",
  },
  {
    title: "Launch Announcement",
    description: "Client-approved launch post for social channels.",
    type: "SOCIAL_POST" as const,
    status: "READY_TO_PUBLISH" as const,
    deadline: new Date("2026-11-29T00:00:00.000Z"),
    assigneeEmail: "pm@northstar.test",
  },
];

function dayOffset(days: number): Date {
  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCDate(date.getUTCDate() + days);
  return date;
}

const DEMO_TASKS = [
  {
    title: "Lock the cold open",
    description: "Tighten the first 30 seconds and confirm music cue.",
    status: "IN_PROGRESS" as const,
    priority: "HIGH" as const,
    contentTitle: "Episode 01 — The Long Game",
    assigneeEmail: "editor@northstar.test",
    dueDate: dayOffset(-2),
  },
  {
    title: "Record host intro",
    description: "Studio booked; record pickup lines for the season opener.",
    status: "TODO" as const,
    priority: "URGENT" as const,
    contentTitle: "Episode 02 — Signal and Noise",
    assigneeEmail: "producer@northstar.test",
    dueDate: dayOffset(-1),
  },
  {
    title: "Pull archive clips",
    description: "Collect three archival clips for the trailer.",
    status: "DONE" as const,
    priority: "MEDIUM" as const,
    contentTitle: "Season 2 Trailer",
    assigneeEmail: "editor@northstar.test",
    dueDate: dayOffset(-5),
  },
  {
    title: "Approve cover concepts",
    description: "Review the two artwork directions with the client.",
    status: "TODO" as const,
    priority: "LOW" as const,
    contentTitle: "Cover Art Refresh",
    assigneeEmail: "pm@northstar.test",
    dueDate: dayOffset(4),
  },
  {
    title: "Season launch checklist",
    description: "Confirm copy, links, and publishing schedule.",
    status: "TODO" as const,
    priority: "MEDIUM" as const,
    contentTitle: null,
    assigneeEmail: null,
    dueDate: dayOffset(8),
  },
];

async function main(): Promise<void> {
  if (env.isProduction) {
    throw new Error("Refusing to seed demo data in production.");
  }

  if (!env.SEED_PASSWORD || env.SEED_PASSWORD.length < 12) {
    throw new Error("Set SEED_PASSWORD to a development password of at least 12 characters.");
  }

  const passwordHash = await hashPassword(env.SEED_PASSWORD);

  await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.upsert({
      where: { slug: DEMO_ORG.slug },
      update: { name: DEMO_ORG.name },
      create: { name: DEMO_ORG.name, slug: DEMO_ORG.slug },
    });

    const internalUsers = new Map<string, string>();

    for (const demoUser of DEMO_USERS) {
      const user = await tx.user.upsert({
        where: { email: demoUser.email },
        update: { name: demoUser.name, passwordHash },
        create: {
          name: demoUser.name,
          email: demoUser.email,
          passwordHash,
        },
      });
      internalUsers.set(demoUser.email, user.id);

      await tx.organizationMembership.upsert({
        where: {
          organizationId_userId: {
            organizationId: organization.id,
            userId: user.id,
          },
        },
        update: { role: demoUser.role, status: "ACTIVE" },
        create: {
          organizationId: organization.id,
          userId: user.id,
          role: demoUser.role,
          status: "ACTIVE",
        },
      });
    }

    const clientUser = await tx.user.upsert({
      where: { email: DEMO_CLIENT_USER.email },
      update: { name: DEMO_CLIENT_USER.name, passwordHash },
      create: {
        name: DEMO_CLIENT_USER.name,
        email: DEMO_CLIENT_USER.email,
        passwordHash,
      },
    });

    const existingClient = await tx.client.findFirst({
      where: { organizationId: organization.id, name: DEMO_CLIENT.name },
    });
    const client = existingClient
      ? await tx.client.update({
          where: { id: existingClient.id },
          data: {
            contactName: DEMO_CLIENT.contactName,
            email: DEMO_CLIENT.email,
            website: DEMO_CLIENT.website,
            notes: DEMO_CLIENT.notes,
            status: "ACTIVE",
          },
        })
      : await tx.client.create({
          data: {
            organizationId: organization.id,
            name: DEMO_CLIENT.name,
            contactName: DEMO_CLIENT.contactName,
            email: DEMO_CLIENT.email,
            website: DEMO_CLIENT.website,
            notes: DEMO_CLIENT.notes,
            status: "ACTIVE",
          },
        });

    await tx.clientMembership.upsert({
      where: {
        clientId_userId: { clientId: client.id, userId: clientUser.id },
      },
      update: { organizationId: organization.id, status: "ACTIVE" },
      create: {
        organizationId: organization.id,
        clientId: client.id,
        userId: clientUser.id,
        status: "ACTIVE",
      },
    });

    const existingProject = await tx.project.findFirst({
      where: { organizationId: organization.id, name: DEMO_PROJECT.name },
    });
    const project = existingProject
      ? await tx.project.update({
          where: { id: existingProject.id },
          data: {
            clientId: client.id,
            description: DEMO_PROJECT.description,
            startDate: DEMO_PROJECT.startDate,
            deadline: DEMO_PROJECT.deadline,
            status: "ACTIVE",
          },
        })
      : await tx.project.create({
          data: {
            organizationId: organization.id,
            clientId: client.id,
            name: DEMO_PROJECT.name,
            description: DEMO_PROJECT.description,
            startDate: DEMO_PROJECT.startDate,
            deadline: DEMO_PROJECT.deadline,
            status: "ACTIVE",
          },
        });

    for (const email of ["pm@northstar.test", "producer@northstar.test", "editor@northstar.test"]) {
      const userId = internalUsers.get(email);
      if (!userId) continue;
      await tx.projectMembership.upsert({
        where: { projectId_userId: { projectId: project.id, userId } },
        update: { organizationId: organization.id },
        create: {
          organizationId: organization.id,
          projectId: project.id,
          userId,
        },
      });
    }

    const contentIds = new Map<string, string>();
    const workflowActorId = internalUsers.get("pm@northstar.test") ?? null;

    for (const demoContent of DEMO_CONTENT) {
      const assigneeId = internalUsers.get(demoContent.assigneeEmail) ?? null;
      const existingContent = await tx.contentItem.findFirst({
        where: { organizationId: organization.id, projectId: project.id, title: demoContent.title },
      });

      if (existingContent) {
        const updated = await tx.contentItem.update({
          where: { id: existingContent.id },
          data: {
            description: demoContent.description,
            type: demoContent.type,
            deadline: demoContent.deadline,
            assigneeId,
          },
        });
        contentIds.set(demoContent.title, updated.id);

        if (demoContent.status === "READY_TO_PUBLISH") {
          const existingReview = await tx.review.findFirst({
            where: { contentItemId: updated.id, decision: "CLIENT_APPROVED" },
          });
          if (!existingReview) {
            await tx.review.create({
              data: {
                organizationId: organization.id,
                contentItemId: updated.id,
                reviewerId: clientUser.id,
                decision: "CLIENT_APPROVED",
                contentVersion: updated.version,
                feedback: "Approved for launch.",
              },
            });
          }
        }
        continue;
      }

      const path = STATUS_PATHS[demoContent.status];
      const content = await tx.contentItem.create({
        data: {
          organizationId: organization.id,
          projectId: project.id,
          title: demoContent.title,
          description: demoContent.description,
          type: demoContent.type,
          status: demoContent.status,
          deadline: demoContent.deadline,
          assigneeId,
          version: path.length + 1,
        },
      });
      contentIds.set(demoContent.title, content.id);

      if (path.length > 0) {
        let fromStatus: SeedContentStatus = "BRIEF";
        const base = Date.now() - path.length * 60 * 60 * 1000;
        await tx.workflowEvent.createMany({
          data: path.map((toStatus, index) => {
            const event = {
              organizationId: organization.id,
              contentItemId: content.id,
              actorId: workflowActorId,
              fromStatus,
              toStatus,
              note: null,
              createdAt: new Date(base + index * 60 * 60 * 1000),
            };
            fromStatus = toStatus;
            return event;
          }),
        });
      }

      if (demoContent.status === "READY_TO_PUBLISH") {
        await tx.review.create({
          data: {
            organizationId: organization.id,
            contentItemId: content.id,
            reviewerId: clientUser.id,
            decision: "CLIENT_APPROVED",
            contentVersion: content.version,
            feedback: "Approved for launch.",
            createdAt: new Date(Date.now() - 30 * 60 * 1000),
          },
        });
      }
    }

    const createdById = internalUsers.get("admin@northstar.test") ?? null;
    for (const demotask of DEMO_TASKS) {
      const assigneeId = demotask.assigneeEmail
        ? (internalUsers.get(demotask.assigneeEmail) ?? null)
        : null;
      const contentItemId = demotask.contentTitle
        ? (contentIds.get(demotask.contentTitle) ?? null)
        : null;

      const existingTask = await tx.task.findFirst({
        where: { organizationId: organization.id, projectId: project.id, title: demotask.title },
      });

      if (existingTask) {
        await tx.task.update({
          where: { id: existingTask.id },
          data: {
            description: demotask.description,
            status: demotask.status,
            priority: demotask.priority,
            contentItemId,
            assigneeId,
            dueDate: demotask.dueDate,
          },
        });
      } else {
        await tx.task.create({
          data: {
            organizationId: organization.id,
            projectId: project.id,
            contentItemId,
            title: demotask.title,
            description: demotask.description,
            status: demotask.status,
            priority: demotask.priority,
            assigneeId,
            createdById,
            dueDate: demotask.dueDate,
          },
        });
      }
    }
  });

  console.log("Seed complete.");
  console.log(`Workspace: ${DEMO_ORG.name} (${DEMO_ORG.slug})`);
  for (const demoUser of DEMO_USERS) {
    console.log(`  ${demoUser.role}: ${demoUser.email}`);
  }
  console.log(`  CLIENT: ${DEMO_CLIENT_USER.email} -> ${DEMO_CLIENT.name}`);
  console.log(`  Project: ${DEMO_PROJECT.name}`);
  console.log(`  Content: ${DEMO_CONTENT.length} items across the workflow`);
  console.log(`  Tasks: ${DEMO_TASKS.length} items with overdue examples`);
  console.log("Sign in with the password from SEED_PASSWORD. Development only.");
}

main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
