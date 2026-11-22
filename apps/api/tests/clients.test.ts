import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  addInternalMember,
  app,
  createApiClient,
  createClientRecord,
  inviteClientContact,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

describe("client management and client portal access", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates, lists, reads, and updates client profiles inside the tenant", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");

    const created = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Acme Audio",
      contactName: "Jamie Contact",
      email: "hello@acme.test",
      phone: "+1 555 0100",
      website: "https://acme.test",
      notes: "Long-form audio.",
      brandGuidelines: "Warm tones, low saturation.",
    });

    expect(created.name).toBe("Acme Audio");
    expect(created.contactName).toBe("Jamie Contact");
    expect(created.status).toBe("ACTIVE");
    expect(created.projectCount).toBe(0);
    expect(created.memberCount).toBe(0);

    const list = await alpha.client.get(
      "/api/v1/organizations/" + alpha.organization.id + "/clients",
    );
    expect(list.status).toBe(200);
    expect(list.body.clients).toHaveLength(1);

    const detail = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/clients/${created.id}`,
    );
    expect(detail.status).toBe(200);
    expect(detail.body.client.brandGuidelines).toBe("Warm tones, low saturation.");

    const updated = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${created.id}`,
      { name: "Acme Audio Group", status: "ARCHIVED", phone: "" },
    );
    expect(updated.status).toBe(200);
    expect(updated.body.client.name).toBe("Acme Audio Group");
    expect(updated.body.client.status).toBe("ARCHIVED");
    expect(updated.body.client.phone).toBeNull();

    const betaList = await beta.client.get(`/api/v1/organizations/${beta.organization.id}/clients`);
    expect(betaList.body.clients).toHaveLength(0);

    const crossTenantRead = await beta.client.get(
      `/api/v1/organizations/${beta.organization.id}/clients/${created.id}`,
    );
    expect(crossTenantRead.status).toBe(404);

    const crossTenantUpdate = await beta.client.patch(
      `/api/v1/organizations/${beta.organization.id}/clients/${created.id}`,
      { name: "Hijacked" },
    );
    expect(crossTenantUpdate.status).toBe(404);

    const archivedList = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/clients?status=ARCHIVED`,
    );
    expect(archivedList.status).toBe(200);
    expect(archivedList.body.clients).toHaveLength(1);
  });

  it("restricts client management to admins and project managers", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const pm = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "pm@alpha.test",
      "PROJECT_MANAGER",
      "Priya Manager",
    );
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const editor = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
      "Elena Editor",
    );

    const pmClient = await createClientRecord(pm.client, alpha.organization.id, {
      name: "PM Client",
    });
    expect(pmClient.name).toBe("PM Client");

    const pmList = await pm.client.get(`/api/v1/organizations/${alpha.organization.id}/clients`);
    expect(pmList.status).toBe(200);

    for (const member of [producer, editor]) {
      const list = await member.client.get(
        `/api/v1/organizations/${alpha.organization.id}/clients`,
      );
      expect(list.status).toBe(403);

      const create = await member.client.post(
        `/api/v1/organizations/${alpha.organization.id}/clients`,
        { name: "Forbidden Client" },
      );
      expect(create.status).toBe(403);
    }
  });

  it("creates client portal memberships without granting internal organization access", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Northstar Audio",
    });

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "contact@northstar.test",
    );
    expect(invite.response.status).toBe(201);
    expect(invite.invitation.type).toBe("CLIENT");
    expect(invite.invitation.role).toBeNull();
    expect(invite.invitation.clientId).toBe(client.id);

    const preview = await request(app).get(`/api/v1/invitations/${invite.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invitation.type).toBe("CLIENT");
    expect(preview.body.invitation.client.name).toBe("Northstar Audio");
    expect(preview.body.invitation.role).toBeNull();

    const contact = await createApiClient();
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Jordan Contact",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.memberships).toHaveLength(0);
    expect(accepted.body.clientMemberships).toHaveLength(1);
    expect(accepted.body.clientMemberships[0].client.id).toBe(client.id);

    const me = await contact.get("/api/v1/auth/me").expect(200);
    expect(me.body.memberships).toHaveLength(0);
    expect(me.body.clientMemberships).toHaveLength(1);

    const user = await prisma.user.findUnique({
      where: { email: "contact@northstar.test" },
    });
    expect(user).not.toBeNull();
    const orgMembership = await prisma.organizationMembership.findFirst({
      where: { userId: user!.id },
    });
    expect(orgMembership).toBeNull();
    const clientMembership = await prisma.clientMembership.findFirst({
      where: { userId: user!.id },
    });
    expect(clientMembership?.status).toBe("ACTIVE");

    // Client users have no internal workspace access, including guessed routes.
    expect((await contact.get(`/api/v1/organizations/${alpha.organization.id}`)).status).toBe(404);
    expect(
      (await contact.get(`/api/v1/organizations/${alpha.organization.id}/clients`)).status,
    ).toBe(404);
    expect(
      (await contact.get(`/api/v1/organizations/${alpha.organization.id}/projects`)).status,
    ).toBe(404);

    const duplicateInvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "contact@northstar.test",
    );
    expect(duplicateInvite.response.status).toBe(409);
    expect(duplicateInvite.response.body.error.code).toBe("ALREADY_CLIENT_MEMBER");
  });

  it("deactivates and reactivates client portal memberships", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Portal Client",
    });
    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "portal@example.test",
    );
    const contact = await createApiClient();
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Portal User",
      password: PASSWORD,
    });
    const membershipId = accepted.body.clientMemberships[0].id as string;

    const members = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/clients/${client.id}/members`,
    );
    expect(members.status).toBe(200);
    expect(members.body.members).toHaveLength(1);
    expect(members.body.members[0].user.email).toBe("portal@example.test");

    const deactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${client.id}/members/${membershipId}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);
    expect(deactivate.body.member.status).toBe("DEACTIVATED");

    const meAfterDeactivation = await contact.get("/api/v1/auth/me").expect(200);
    expect(meAfterDeactivation.body.clientMemberships).toHaveLength(0);

    const reinvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "portal@example.test",
    );
    expect(reinvite.response.status).toBe(201);
    const reactivated = await contact.post("/api/v1/invitations/accept", {
      token: reinvite.token,
    });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.clientMemberships[0].status).toBe("ACTIVE");

    const meAfterReactivation = await contact.get("/api/v1/auth/me").expect(200);
    expect(meAfterReactivation.body.clientMemberships).toHaveLength(1);

    const archive = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${client.id}`,
      { status: "ARCHIVED" },
    );
    expect(archive.status).toBe(200);
    const meAfterArchive = await contact.get("/api/v1/auth/me").expect(200);
    expect(meAfterArchive.body.clientMemberships).toHaveLength(0);

    const restore = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${client.id}`,
      { status: "ACTIVE" },
    );
    expect(restore.status).toBe(200);
    const meAfterRestore = await contact.get("/api/v1/auth/me").expect(200);
    expect(meAfterRestore.body.clientMemberships).toHaveLength(1);
  });

  it("allows one client user to hold memberships in multiple client accounts", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const first = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "First Client",
    });
    const second = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Second Client",
    });

    const firstInvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      first.id,
      "shared-contact@example.test",
    );
    const contact = await createApiClient();
    await contact.post("/api/v1/invitations/accept", {
      token: firstInvite.token,
      name: "Shared Contact",
      password: PASSWORD,
    });

    const secondInvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      second.id,
      "shared-contact@example.test",
    );
    const accepted = await contact.post("/api/v1/invitations/accept", {
      token: secondInvite.token,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.clientMemberships).toHaveLength(1);
    expect(accepted.body.clientMemberships[0].client.id).toBe(second.id);

    const me = await contact.get("/api/v1/auth/me").expect(200);
    const clientIds = me.body.clientMemberships.map(
      (membership: { client: { id: string } }) => membership.client.id,
    );
    expect(clientIds).toContain(first.id);
    expect(clientIds).toContain(second.id);
    expect(me.body.memberships).toHaveLength(0);
  });

  it("blocks client invitations for archived clients and permission-restricted roles", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Archived Client",
    });

    const producerInvite = await inviteClientContact(
      producer.client,
      alpha.organization.id,
      client.id,
      "blocked@example.test",
    );
    expect(producerInvite.response.status).toBe(403);

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "archived-late@example.test",
    );
    expect(invite.response.status).toBe(201);

    const archive = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/clients/${client.id}`,
      { status: "ARCHIVED" },
    );
    expect(archive.status).toBe(200);

    const archivedInvite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "archived@example.test",
    );
    expect(archivedInvite.response.status).toBe(400);
    expect(archivedInvite.response.body.error.code).toBe("CLIENT_ARCHIVED");

    const lateContact = await createApiClient();
    const lateAccept = await lateContact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Late Client Contact",
      password: PASSWORD,
    });
    expect(lateAccept.status).toBe(410);
    expect(lateAccept.body.error.code).toBe("CLIENT_INVITATION_UNAVAILABLE");
  });
});
