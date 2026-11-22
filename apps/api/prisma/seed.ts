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
  });

  console.log("Seed complete.");
  console.log(`Workspace: ${DEMO_ORG.name} (${DEMO_ORG.slug})`);
  for (const demoUser of DEMO_USERS) {
    console.log(`  ${demoUser.role}: ${demoUser.email}`);
  }
  console.log(`  CLIENT: ${DEMO_CLIENT_USER.email} -> ${DEMO_CLIENT.name}`);
  console.log(`  Project: ${DEMO_PROJECT.name}`);
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
