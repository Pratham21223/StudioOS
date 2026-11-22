import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  addInternalMember,
  createApiClient,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  createTaskRecord,
  inviteClientContact,
  resetDatabase,
  setupOrganization,
  transitionContentRecord,
  uploadAssetRecord,
} from "./helpers.js";

describe("end-to-end production journey", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("runs client intake through upload, review, approval, notifications, and dashboard", async () => {
    const alpha = await setupOrganization("Journey Studio", "journey@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Journey Client",
      contactName: "Jordan Journey",
      email: "hello@journeyclient.test",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Journey Campaign",
      startDate: "2026-12-01",
      deadline: "2026-12-31",
    });
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "journey-producer@example.test",
      "PRODUCER",
      "Journey Producer",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Journey Launch Film",
      type: "VIDEO",
      deadline: "2026-12-20",
      assigneeId: producer.auth.user.id,
    });
    expect(content.status).toBe("BRIEF");

    const task = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      title: "Journey edit task",
      assigneeId: producer.auth.user.id,
      dueDate: "2026-12-15",
      priority: "HIGH",
    });
    const asset = await uploadAssetRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      originalFilename: "journey-cut.txt",
      body: Buffer.from("journey deliverable"),
    });
    expect(asset.contentItem?.id).toBe(content.id);

    const feedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Ready for internal sign-off.", assetId: asset.id },
    );
    expect(feedback.status).toBe(201);

    let version = content.version;
    for (const status of [
      "SCRIPT",
      "SHOOT",
      "EDITING",
      "INTERNAL_REVIEW",
      "CLIENT_APPROVAL",
    ] as const) {
      const transition = await transitionContentRecord(
        alpha.client,
        alpha.organization.id,
        content.id,
        status,
      );
      expect(transition.status).toBe(200);
      version += 1;
    }

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "journey-client@example.test",
    );
    const contact = await createApiClient();
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Journey Client Contact",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);

    const portalProjects = await contact.get("/api/v1/client-portal/projects");
    expect(portalProjects.body.projects[0].id).toBe(project.id);
    expect(portalProjects.body.projects[0].awaitingReviewCount).toBe(1);

    const portalContent = await contact.get(`/api/v1/client-portal/content-items/${content.id}`);
    expect(portalContent.status).toBe(200);
    expect(portalContent.body.content.version).toBe(version);
    expect(portalContent.body.content.assets[0].id).toBe(asset.id);

    const adjustment = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/request-revision`,
      {
        expectedVersion: version,
        feedback: "Please shorten the opening and re-submit.",
      },
    );
    expect(adjustment.status).toBe(200);
    expect(adjustment.body.content.status).toBe("EDITING");

    version += 1;
    for (const status of ["INTERNAL_REVIEW", "CLIENT_APPROVAL"] as const) {
      const transition = await transitionContentRecord(
        alpha.client,
        alpha.organization.id,
        content.id,
        status,
      );
      expect(transition.status).toBe(200);
      version += 1;
    }

    const approval = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/approve`,
      { expectedVersion: version, assetId: asset.id },
    );
    expect(approval.status).toBe(200);
    expect(approval.body.content.status).toBe("READY_TO_PUBLISH");
    expect(approval.body.review.decision).toBe("CLIENT_APPROVED");

    const statusUpdate = await producer.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${task.id}/status`,
      { status: "DONE" },
    );
    expect(statusUpdate.status).toBe(200);

    const dashboard = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/dashboard`,
    );
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.dashboard.counts.awaitingApproval).toBe(0);
    expect(dashboard.body.dashboard.counts.activeProjects).toBe(1);
    expect(
      dashboard.body.dashboard.contentByStatus.find(
        (entry: { status: string }) => entry.status === "READY_TO_PUBLISH",
      ).count,
    ).toBe(1);

    const inbox = await producer.client.get("/api/v1/notifications");
    const types = inbox.body.notifications.map((item: { type: string }) => item.type);
    expect(types).toContain("TASK_ASSIGNED");
    expect(types).toContain("CONTENT_APPROVED");

    const auditActions = await prisma.auditLog.findMany({
      where: { organizationId: alpha.organization.id },
      select: { action: true },
    });
    const actions = auditActions.map((entry) => entry.action);
    expect(actions).toContain("asset.uploaded");
    expect(actions).toContain("review.internal_feedback");
    expect(actions).toContain("content.client_revision_requested");
    expect(actions).toContain("content.client_approved");

    const finalContent = await prisma.contentItem.findUniqueOrThrow({
      where: { id: content.id },
      select: { status: true, version: true },
    });
    expect(finalContent.status).toBe("READY_TO_PUBLISH");
    expect(finalContent.version).toBe(version + 1);

    const download = await contact.post(`/api/v1/client-portal/assets/${asset.id}/download-url`, {
      disposition: "attachment",
    });
    expect(download.status).toBe(200);
    const file = await fetch(download.body.url as string);
    expect(Buffer.from(await file.arrayBuffer()).toString()).toBe("journey deliverable");
  });
});
