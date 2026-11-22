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
  });

  console.log("Seed complete.");
  console.log(`Workspace: ${DEMO_ORG.name} (${DEMO_ORG.slug})`);
  for (const demoUser of DEMO_USERS) {
    console.log(`  ${demoUser.role}: ${demoUser.email}`);
  }
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
