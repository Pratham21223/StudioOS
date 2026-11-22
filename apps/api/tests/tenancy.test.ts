import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import {
  PASSWORD,
  app,
  createApiClient,
  inviteMember,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

describe("tenant isolation and membership authorization", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("denies cross-tenant reads, listings, and updates with 404 semantics", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");

    const orgRead = await alpha.client.get(`/api/v1/organizations/${beta.organization.id}`);
    expect(orgRead.status).toBe(404);
    expect(orgRead.body.error.code).toBe("ORGANIZATION_NOT_FOUND");

    const membersRead = await alpha.client.get(
      `/api/v1/organizations/${beta.organization.id}/members`,
    );
    expect(membersRead.status).toBe(404);

    const update = await alpha.client.patch(`/api/v1/organizations/${beta.organization.id}`, {
      name: "Hijacked Studio",
    });
    expect(update.status).toBe(404);

    const betaOrganization = await prisma.organization.findUnique({
      where: { id: beta.organization.id },
    });
    expect(betaOrganization?.name).toBe("Beta Studio");

    const alphaList = await alpha.client.get("/api/v1/organizations").expect(200);
    expect(alphaList.body.organizations).toHaveLength(1);
    expect(alphaList.body.organizations[0].organization.id).toBe(alpha.organization.id);
  });

  it("rejects cross-tenant relationship updates even with a guessed membership id", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "beta@example.com");

    const response = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${beta.membership.id}`,
      { role: "EDITOR" },
    );
    expect(response.status).toBe(404);

    const betaMembership = await prisma.organizationMembership.findUnique({
      where: { id: beta.membership.id },
    });
    expect(betaMembership?.role).toBe("ADMIN");

    const otherOrgAttempt = await alpha.client.patch(
      `/api/v1/organizations/${beta.organization.id}/members/${beta.membership.id}`,
      { status: "DEACTIVATED" },
    );
    expect(otherOrgAttempt.status).toBe(404);
  });

  it("enforces permissions for project managers and editors", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const pmInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "pm@alpha.test",
      "PROJECT_MANAGER",
    );
    expect(pmInvite.response.status).toBe(201);
    const pmClient = await createApiClient();
    const pmAccept = await pmClient.post("/api/v1/invitations/accept", {
      token: pmInvite.token,
      name: "Priya Manager",
      password: PASSWORD,
    });
    expect(pmAccept.status).toBe(200);

    const editorInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
    );
    const editorClient = await createApiClient();
    const editorAccept = await editorClient.post("/api/v1/invitations/accept", {
      token: editorInvite.token,
      name: "Elena Editor",
      password: PASSWORD,
    });
    expect(editorAccept.status).toBe(200);
    const editorMembershipId = editorAccept.body.memberships[0].id as string;

    const pmMembers = await pmClient.get(`/api/v1/organizations/${alpha.organization.id}/members`);
    expect(pmMembers.status).toBe(200);

    const pmInviteAttempt = await pmClient.post(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
      { email: "new@alpha.test", role: "EDITOR" },
    );
    expect(pmInviteAttempt.status).toBe(403);
    expect(pmInviteAttempt.body.error.code).toBe("FORBIDDEN");

    const pmUpdateAttempt = await pmClient.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${editorMembershipId}`,
      { role: "PRODUCER" },
    );
    expect(pmUpdateAttempt.status).toBe(403);

    const editorMembers = await editorClient.get(
      `/api/v1/organizations/${alpha.organization.id}/members`,
    );
    expect(editorMembers.status).toBe(403);

    const editorInviteAttempt = await editorClient.post(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
      { email: "other@alpha.test", role: "EDITOR" },
    );
    expect(editorInviteAttempt.status).toBe(403);

    const editorUpdateAttempt = await editorClient.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${editorMembershipId}`,
      { status: "DEACTIVATED" },
    );
    expect(editorUpdateAttempt.status).toBe(403);
  });

  it("revokes access immediately when a membership is deactivated and restores it on reactivation", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
    );

    const editorClient = await createApiClient();
    const accept = await editorClient.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Elena Editor",
      password: PASSWORD,
    });
    const membershipId = accept.body.memberships[0].id as string;

    const deactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${membershipId}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);

    expect((await editorClient.get(`/api/v1/organizations/${alpha.organization.id}`)).status).toBe(
      404,
    );
    const editorMe = await editorClient.get("/api/v1/auth/me").expect(200);
    expect(editorMe.body.memberships).toHaveLength(0);

    const reactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${membershipId}`,
      { status: "ACTIVE" },
    );
    expect(reactivate.status).toBe(200);
    expect((await editorClient.get(`/api/v1/organizations/${alpha.organization.id}`)).status).toBe(
      200,
    );
  });

  it("prevents removing or demoting the last active admin", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const deactivateSelf = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${alpha.membership.id}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivateSelf.status).toBe(409);
    expect(deactivateSelf.body.error.code).toBe("LAST_ADMIN_REQUIRED");

    const demoteSelf = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${alpha.membership.id}`,
      { role: "PROJECT_MANAGER" },
    );
    expect(demoteSelf.status).toBe(409);

    const stored = await prisma.organizationMembership.findUnique({
      where: { id: alpha.membership.id },
    });
    expect(stored?.role).toBe("ADMIN");
    expect(stored?.status).toBe("ACTIVE");
  });

  it("lets a user switch organizations without leaking the other tenant's resources", async () => {
    const alpha = await setupOrganization("Alpha Studio", "shared@example.com", "Sam Shared");
    const beta = await setupOrganization("Beta Studio", "beta-admin@example.com", "Bea Admin");

    const invite = await inviteMember(
      beta.client,
      beta.organization.id,
      "shared@example.com",
      "PROJECT_MANAGER",
    );
    const accept = await alpha.client.post("/api/v1/invitations/accept", {
      token: invite.token,
    });
    expect(accept.status).toBe(200);

    const me = await alpha.client.get("/api/v1/auth/me").expect(200);
    expect(me.body.memberships).toHaveLength(2);
    const organizationIds = me.body.memberships.map(
      (membership: { organization: { id: string } }) => membership.organization.id,
    );
    expect(organizationIds).toContain(alpha.organization.id);
    expect(organizationIds).toContain(beta.organization.id);

    const alphaMembers = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/members`,
    );
    expect(alphaMembers.status).toBe(200);
    expect(alphaMembers.body.members).toHaveLength(1);
    expect(alphaMembers.body.members[0].user.email).toBe("shared@example.com");

    const betaMembers = await alpha.client.get(
      `/api/v1/organizations/${beta.organization.id}/members`,
    );
    expect(betaMembers.status).toBe(200);
    expect(betaMembers.body.members).toHaveLength(2);
    const betaEmails = betaMembers.body.members.map(
      (member: { user: { email: string } }) => member.user.email,
    );
    expect(betaEmails).toContain("beta-admin@example.com");
    expect(betaEmails).toContain("shared@example.com");

    // Removing the membership in Beta must not affect Alpha access.
    const betaMembership = betaMembers.body.members.find(
      (member: { user: { email: string } }) => member.user.email === "shared@example.com",
    );
    const deactivate = await beta.client.patch(
      `/api/v1/organizations/${beta.organization.id}/members/${betaMembership.id}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);

    expect((await alpha.client.get(`/api/v1/organizations/${beta.organization.id}`)).status).toBe(
      404,
    );
    expect((await alpha.client.get(`/api/v1/organizations/${alpha.organization.id}`)).status).toBe(
      200,
    );
  });

  it("keeps at least one active admin under concurrent demotions", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "second-admin@alpha.test",
      "ADMIN",
    );

    const secondAdmin = await createApiClient();
    const accepted = await secondAdmin.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Second Admin",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);
    const secondMembershipId = accepted.body.memberships[0].id as string;

    const [firstResult, secondResult] = await Promise.all([
      alpha.client.patch(
        `/api/v1/organizations/${alpha.organization.id}/members/${alpha.membership.id}`,
        { role: "PROJECT_MANAGER" },
      ),
      secondAdmin.patch(
        `/api/v1/organizations/${alpha.organization.id}/members/${secondMembershipId}`,
        { role: "PROJECT_MANAGER" },
      ),
    ]);

    const statuses = [firstResult.status, secondResult.status].sort();
    expect(statuses).toEqual([200, 409]);

    const activeAdmins = await prisma.organizationMembership.count({
      where: {
        organizationId: alpha.organization.id,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
    expect(activeAdmins).toBe(1);
  });

  it("rejects unauthenticated, deactivated-user, and expired-session access", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const anonymous = await request(app).get(`/api/v1/organizations/${alpha.organization.id}`);
    expect(anonymous.status).toBe(401);

    const session = await prisma.session.findFirst({
      where: { userId: alpha.auth.user.id },
    });
    expect(session).not.toBeNull();
    await prisma.session.update({
      where: { id: session!.id },
      data: { expiresAt: new Date(Date.now() - 1000) },
    });
    expect((await alpha.client.get(`/api/v1/organizations/${alpha.organization.id}`)).status).toBe(
      401,
    );

    // Re-authenticate, then deactivate the global user.
    await alpha.client.init();
    await alpha.client.post("/api/v1/auth/login", {
      email: "alpha@example.com",
      password: PASSWORD,
    });
    expect((await alpha.client.get("/api/v1/auth/me")).status).toBe(200);

    await prisma.user.update({
      where: { id: alpha.auth.user.id },
      data: { status: "DEACTIVATED" },
    });
    expect((await alpha.client.get("/api/v1/auth/me")).status).toBe(401);
  });
});
