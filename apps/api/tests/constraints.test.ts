import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  createClientRecord,
  createProjectRecord,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

describe("database tenant and integrity constraints", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("rejects a project whose client belongs to another organization", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const betaClient = await createClientRecord(beta.client, beta.organization.id, {
      name: "Beta Client",
    });

    await expect(
      prisma.project.create({
        data: {
          organizationId: alpha.organization.id,
          clientId: betaClient.id,
          name: "Cross-Tenant Project",
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces project date ordering in PostgreSQL", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Date Client",
    });

    await expect(
      prisma.project.create({
        data: {
          organizationId: alpha.organization.id,
          clientId: client.id,
          name: "Invalid Dates",
          startDate: new Date("2026-12-20T00:00:00.000Z"),
          deadline: new Date("2026-12-01T00:00:00.000Z"),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects project memberships that mix organizations", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Membership Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Membership Project",
    });

    await expect(
      prisma.projectMembership.create({
        data: {
          organizationId: beta.organization.id,
          projectId: project.id,
          userId: alpha.auth.user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces the invitation type shape at the database level", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Invitation Client",
    });
    await expect(
      prisma.invitation.create({
        data: {
          organizationId: alpha.organization.id,
          clientId: client.id,
          type: "CLIENT",
          email: "invalid@example.test",
          role: "EDITOR",
          tokenHash: "a".repeat(64),
          invitedById: alpha.auth.user.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.invitation.create({
        data: {
          organizationId: alpha.organization.id,
          clientId: client.id,
          type: "INTERNAL",
          email: "invalid@example.test",
          role: "EDITOR",
          tokenHash: "b".repeat(64),
          invitedById: alpha.auth.user.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects client invitations that mix organizations", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const alphaClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Alpha Invite Client",
    });

    await expect(
      prisma.invitation.create({
        data: {
          organizationId: beta.organization.id,
          clientId: alphaClient.id,
          type: "CLIENT",
          email: "cross-org@example.test",
          role: null,
          tokenHash: "c".repeat(64),
          invitedById: beta.auth.user.id,
          expiresAt: new Date(Date.now() + 60_000),
        },
      }),
    ).rejects.toThrow();
  });

  it("rejects content and tasks that cross tenant or project boundaries", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");
    const alphaClient = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Alpha Content Client",
    });
    const betaClient = await createClientRecord(beta.client, beta.organization.id, {
      name: "Beta Content Client",
    });
    const alphaProject = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      alphaClient.id,
      { name: "Alpha Content Project" },
    );
    const secondProject = await createProjectRecord(
      alpha.client,
      alpha.organization.id,
      alphaClient.id,
      { name: "Alpha Second Project" },
    );
    await createProjectRecord(beta.client, beta.organization.id, betaClient.id, {
      name: "Beta Content Project",
    });

    const betaProject = await prisma.project.findFirstOrThrow({
      where: { organizationId: beta.organization.id },
    });

    await expect(
      prisma.contentItem.create({
        data: {
          organizationId: alpha.organization.id,
          projectId: betaProject.id,
          title: "Cross Tenant Content",
          type: "VIDEO",
        },
      }),
    ).rejects.toThrow();

    const firstContent = await prisma.contentItem.create({
      data: {
        organizationId: alpha.organization.id,
        projectId: alphaProject.id,
        title: "First Project Content",
        type: "VIDEO",
      },
    });
    const secondContent = await prisma.contentItem.create({
      data: {
        organizationId: alpha.organization.id,
        projectId: secondProject.id,
        title: "Second Project Content",
        type: "VIDEO",
      },
    });

    await expect(
      prisma.task.create({
        data: {
          organizationId: alpha.organization.id,
          projectId: alphaProject.id,
          contentItemId: secondContent.id,
          title: "Cross Project Task",
          createdById: alpha.auth.user.id,
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.task.create({
        data: {
          organizationId: beta.organization.id,
          projectId: betaProject.id,
          contentItemId: firstContent.id,
          title: "Cross Tenant Task",
          createdById: beta.auth.user.id,
        },
      }),
    ).rejects.toThrow();
  });

  it("enforces the fixed workflow state machine at the database level", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Workflow Constraint Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Workflow Constraint Project",
    });

    const content = await prisma.contentItem.create({
      data: {
        organizationId: alpha.organization.id,
        projectId: project.id,
        title: "Constrained Content",
        type: "PODCAST",
      },
    });

    await expect(
      prisma.workflowEvent.create({
        data: {
          organizationId: alpha.organization.id,
          contentItemId: content.id,
          actorId: alpha.auth.user.id,
          fromStatus: "BRIEF",
          toStatus: "READY_TO_PUBLISH",
        },
      }),
    ).rejects.toThrow();

    await expect(
      prisma.contentItem.create({
        data: {
          organizationId: alpha.organization.id,
          projectId: project.id,
          title: "Invalid Version",
          type: "PODCAST",
          version: 0,
        },
      }),
    ).rejects.toThrow();

    const event = await prisma.workflowEvent.create({
      data: {
        organizationId: alpha.organization.id,
        contentItemId: content.id,
        actorId: alpha.auth.user.id,
        fromStatus: "BRIEF",
        toStatus: "SCRIPT",
        note: "Valid transition",
      },
    });
    expect(event.toStatus).toBe("SCRIPT");
  });
});
