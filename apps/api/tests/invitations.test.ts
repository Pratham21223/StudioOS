import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { hashToken } from "../src/shared/crypto.js";
import {
  PASSWORD,
  app,
  createApiClient,
  inviteMember,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

describe("organization invitations", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a hashed single-use invitation and lets a new user accept it", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "invitee@example.com",
      "PROJECT_MANAGER",
    );

    expect(invite.response.status).toBe(201);
    expect(invite.invitation.status).toBe("PENDING");
    expect(invite.invitation.role).toBe("PROJECT_MANAGER");
    expect(invite.token.length).toBeGreaterThan(20);

    const stored = await prisma.invitation.findFirst();
    expect(stored).not.toBeNull();
    expect(stored!.tokenHash).toBe(hashToken(invite.token));
    expect(stored!.tokenHash).not.toBe(invite.token);
    expect(stored!.tokenHash).toHaveLength(64);
    expect(stored!.acceptedAt).toBeNull();

    const preview = await request(app).get(`/api/v1/invitations/${invite.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invitation.organization.name).toBe("Alpha Studio");
    expect(preview.body.invitation.email).toBe("invitee@example.com");
    expect(preview.body.invitation.role).toBe("PROJECT_MANAGER");
    expect(preview.body.invitation.status).toBe("PENDING");

    const missingCredentials = await createApiClient();
    const missing = await missingCredentials.post("/api/v1/invitations/accept", {
      token: invite.token,
    });
    expect(missing.status).toBe(401);
    expect(missing.body.error.code).toBe("AUTHENTICATION_REQUIRED");

    const invitee = await createApiClient();
    const accepted = await invitee.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Priya Invitee",
      password: PASSWORD,
    });

    expect(accepted.status).toBe(200);
    expect(accepted.body.user.email).toBe("invitee@example.com");
    expect(accepted.body.memberships).toHaveLength(1);
    expect(accepted.body.memberships[0].role).toBe("PROJECT_MANAGER");
    expect(accepted.body.memberships[0].organization.id).toBe(alpha.organization.id);

    const me = await invitee.get("/api/v1/auth/me").expect(200);
    expect(me.body.user.email).toBe("invitee@example.com");
    expect(me.body.memberships[0].organization.id).toBe(alpha.organization.id);

    const acceptedRecord = await prisma.invitation.findUnique({
      where: { id: stored!.id },
    });
    expect(acceptedRecord!.acceptedAt).not.toBeNull();

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: accepted.body.user.id, organizationId: alpha.organization.id },
    });
    expect(membership?.role).toBe("PROJECT_MANAGER");
    expect(membership?.status).toBe("ACTIVE");

    const reuse = await createApiClient();
    const secondAccept = await reuse.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Another Person",
      password: PASSWORD,
    });
    expect(secondAccept.status).toBe(409);
    expect(secondAccept.body.error.code).toBe("INVITATION_ALREADY_ACCEPTED");
    expect(await prisma.user.count()).toBe(2);
  });

  it("reissues a pending invitation with a fresh token instead of duplicating it", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const first = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "reissue@example.com",
      "EDITOR",
    );

    const second = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "reissue@example.com",
      "PRODUCER",
    );
    expect(second.response.status).toBe(201);
    expect(second.invitation.id).toBe(first.invitation.id);
    expect(second.invitation.role).toBe("PRODUCER");
    expect(second.token).not.toBe(first.token);
    expect(await prisma.invitation.count()).toBe(1);

    const oldPreview = await request(app).get(`/api/v1/invitations/${first.token}`);
    expect(oldPreview.status).toBe(404);

    const newPreview = await request(app).get(`/api/v1/invitations/${second.token}`);
    expect(newPreview.status).toBe(200);
    expect(newPreview.body.invitation.role).toBe("PRODUCER");

    const pending = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
    );
    expect(pending.status).toBe(200);
    expect(pending.body.invitations).toHaveLength(1);
    expect(pending.body.invitations[0].id).toBe(first.invitation.id);
  });

  it("requires existing accounts to sign in and rejects email mismatches", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const beta = await setupOrganization("Beta Studio", "shared@example.com", "Sam Shared");

    const sharedInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "shared@example.com",
      "EDITOR",
    );

    const anonymousAttempt = await createApiClient();
    const signInRequired = await anonymousAttempt.post("/api/v1/invitations/accept", {
      token: sharedInvite.token,
      name: "Fake Sam",
      password: PASSWORD,
    });
    expect(signInRequired.status).toBe(409);
    expect(signInRequired.body.error.code).toBe("SIGN_IN_REQUIRED");
    expect((await prisma.invitation.findFirst())!.acceptedAt).toBeNull();

    const accepted = await beta.client.post("/api/v1/invitations/accept", {
      token: sharedInvite.token,
    });
    expect(accepted.status).toBe(200);
    expect(accepted.body.memberships[0].organization.id).toBe(alpha.organization.id);

    const otherInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "other@example.com",
      "EDITOR",
    );
    const mismatch = await beta.client.post("/api/v1/invitations/accept", {
      token: otherInvite.token,
    });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe("INVITATION_EMAIL_MISMATCH");

    const mismatchStored = await prisma.invitation.findUnique({
      where: { id: otherInvite.invitation.id },
    });
    expect(mismatchStored?.acceptedAt).toBeNull();
  });

  it("restricts invitation creation to admins and invitation listing to members.view roles", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const pmInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "pm@alpha.test",
      "PROJECT_MANAGER",
    );
    const pmClient = await createApiClient();
    await pmClient.post("/api/v1/invitations/accept", {
      token: pmInvite.token,
      name: "Priya Manager",
      password: PASSWORD,
    });

    const editorInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
    );
    const editorClient = await createApiClient();
    await editorClient.post("/api/v1/invitations/accept", {
      token: editorInvite.token,
      name: "Elena Editor",
      password: PASSWORD,
    });

    const pmCreate = await pmClient.post(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
      { email: "blocked@alpha.test", role: "EDITOR" },
    );
    expect(pmCreate.status).toBe(403);

    const pmList = await pmClient.get(`/api/v1/organizations/${alpha.organization.id}/invitations`);
    expect(pmList.status).toBe(200);

    const editorList = await editorClient.get(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
    );
    expect(editorList.status).toBe(403);

    const adminList = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/invitations`,
    );
    expect(adminList.status).toBe(200);
    expect(adminList.body.invitations).toHaveLength(0);
  });

  it("rejects expired invitations and creates a replacement when reissuing", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "expired@example.com",
      "EDITOR",
    );

    await prisma.invitation.update({
      where: { id: invite.invitation.id },
      data: { expiresAt: new Date(Date.now() - 60_000) },
    });

    const preview = await request(app).get(`/api/v1/invitations/${invite.token}`);
    expect(preview.status).toBe(200);
    expect(preview.body.invitation.status).toBe("EXPIRED");

    const invitee = await createApiClient();
    const expiredAccept = await invitee.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Late Person",
      password: PASSWORD,
    });
    expect(expiredAccept.status).toBe(410);
    expect(expiredAccept.body.error.code).toBe("INVITATION_EXPIRED");

    const replacement = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "expired@example.com",
      "EDITOR",
    );
    expect(replacement.response.status).toBe(201);
    expect(replacement.invitation.id).not.toBe(invite.invitation.id);
    expect(await prisma.invitation.count()).toBe(2);
  });

  it("reactivates a deactivated membership through a new invitation", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "returning@example.com",
      "EDITOR",
    );

    const returning = await createApiClient();
    const accepted = await returning.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Returning Editor",
      password: PASSWORD,
    });
    expect(accepted.status).toBe(200);
    const membershipId = accepted.body.memberships[0].id as string;

    const deactivate = await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/members/${membershipId}`,
      { status: "DEACTIVATED" },
    );
    expect(deactivate.status).toBe(200);

    const reInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "returning@example.com",
      "PRODUCER",
    );
    expect(reInvite.response.status).toBe(201);

    const reactivated = await returning.post("/api/v1/invitations/accept", {
      token: reInvite.token,
    });
    expect(reactivated.status).toBe(200);
    expect(reactivated.body.memberships[0].role).toBe("PRODUCER");
    expect(reactivated.body.memberships[0].status).toBe("ACTIVE");

    const me = await returning.get("/api/v1/auth/me").expect(200);
    expect(me.body.memberships).toHaveLength(1);
    expect(me.body.memberships[0].status).toBe("ACTIVE");
  });

  it("refuses to invite an active member and protects against invalid tokens", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");

    const selfInvite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "alpha@example.com",
      "EDITOR",
    );
    expect(selfInvite.response.status).toBe(409);
    expect(selfInvite.response.body.error.code).toBe("ALREADY_MEMBER");

    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "accepted@example.com",
      "EDITOR",
    );
    const invitee = await createApiClient();
    await invitee.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Accepted User",
      password: PASSWORD,
    });

    const afterAccept = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "accepted@example.com",
      "EDITOR",
    );
    expect(afterAccept.response.status).toBe(409);

    const invalidPreview = await request(app).get(
      "/api/v1/invitations/this-token-does-not-exist-anywhere",
    );
    expect(invalidPreview.status).toBe(404);

    const invalidAccept = await createApiClient();
    const invalid = await invalidAccept.post("/api/v1/invitations/accept", {
      token: "this-token-does-not-exist-anywhere",
      name: "Nobody",
      password: PASSWORD,
    });
    expect(invalid.status).toBe(404);
  });
});
