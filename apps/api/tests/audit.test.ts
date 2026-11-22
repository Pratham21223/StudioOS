import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  createApiClient,
  inviteMember,
  resetDatabase,
  setupOrganization,
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

    const acceptedEntry = actions.find((entry) => entry.action === "invitation.accepted");
    expect(acceptedEntry?.actorId).toBe(accepted.body.user.id);
  });
});
