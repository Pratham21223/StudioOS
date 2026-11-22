import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  createApiClient,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  createTaskRecord,
  inviteMember,
  resetDatabase,
  setupOrganization,
  transitionContentRecord,
} from "./helpers.js";

describe("audit trail", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("records organization, invitation, membership, and settings changes", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const created = await prisma.auditLog.findMany({
      where: { organizationId: alpha.organization.id, action: "organization.created" },
    });
    expect(created).toHaveLength(1);
    expect(created[0]!.actorId).toBe(alpha.auth.user.id);

    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "audited@example.com",
      "EDITOR",
    );
    expect(invite.response.status).toBe(201);

    const invitee = await createApiClient();
    const accepted = await invitee.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Audited User",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);
    const membershipId = accepted.body.memberships[0].id as string;

    const promotion = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${membershipId}`,
      { role: "PRODUCER" },
    );
    expect(promotion.status).toBe(200);

    const rename = await alpha.client.patch(`/api/v1/organizations/${alpha.organization.id}`, {
      name: "Alpha Studio Renamed",
    });
    expect(rename.status).toBe(200);

    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Audited Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Audited Project",
    });
    const addMember = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [accepted.body.user.id] },
    );
    expect(addMember.status).toBe(200);

    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Audited Content",
    });
    const transition = await transitionContentRecord(
      alpha.client,
      alpha.organization.id,
      content.id,
      "SCRIPT",
    );
    expect(transition.status).toBe(200);

    const task = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      contentItemId: content.id,
      title: "Audited Task",
      assigneeId: accepted.body.user.id as string,
    });
    const taskStatus = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/tasks/${task.id}/status`,
      { status: "IN_PROGRESS" },
    );
    expect(taskStatus.status).toBe(200);

    const actions = await prisma.auditLog.findMany({
      where: { organizationId: alpha.organization.id },
      orderBy: { createdAt: "asc" },
      select: { action: true, actorId: true },
    });
    const actionNames = actions.map((entry) => entry.action);

    expect(actionNames).toContain("invitation.created");
    expect(actionNames).toContain("invitation.accepted");
    expect(actionNames).toContain("membership.role_changed");
    expect(actionNames).toContain("organization.updated");
    expect(actionNames).toContain("client.created");
    expect(actionNames).toContain("project.created");
    expect(actionNames).toContain("project.members_added");
    expect(actionNames).toContain("content.created");
    expect(actionNames).toContain("content.transitioned");
    expect(actionNames).toContain("task.created");
    expect(actionNames).toContain("task.status_changed");

    const acceptedEntry = actions.find((entry) => entry.action === "invitation.accepted");
    expect(acceptedEntry?.actorId).toBe(accepted.body.user.id);
  });
});
