import { beforeEach, describe, expect, it } from "vitest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { hashPassword } from "../src/shared/password.js";
import { resolveOAuthUser } from "../src/modules/auth/oauth.service.js";
import {
  PASSWORD,
  createApiClient,
  registerPendingUser,
  registerUser,
  resetDatabase,
} from "./helpers.js";

describe("oauth", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a verified user, starter workspace, and provider link", async () => {
    const user = await resolveOAuthUser({
      provider: "GOOGLE",
      providerAccountId: "google-123",
      email: "OAuth.User@Example.com",
      name: "OAuth User",
      emailVerified: true,
    });

    expect(user.email).toBe("oauth.user@example.com");
    expect(user.emailVerifiedAt).not.toBeNull();
    expect(user.passwordHash).toBeNull();

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: user.id },
      include: { organization: true },
    });
    expect(membership?.role).toBe("ADMIN");
    expect(membership?.organization.name).toBe("OAuth User's Workspace");

    const link = await prisma.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: "GOOGLE",
          providerAccountId: "google-123",
        },
      },
    });
    expect(link?.userId).toBe(user.id);
    expect(link?.email).toBe("oauth.user@example.com");
  });

  it("returns the linked user without creating a second workspace", async () => {
    const first = await resolveOAuthUser({
      provider: "GITHUB",
      providerAccountId: "github-42",
      email: "octocat@example.com",
      name: "Octo Cat",
      emailVerified: true,
    });
    const second = await resolveOAuthUser({
      provider: "GITHUB",
      providerAccountId: "github-42",
      email: "octocat@example.com",
      name: "Octo Cat",
      emailVerified: true,
    });

    expect(second.id).toBe(first.id);
    expect(await prisma.oAuthAccount.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });

  it("links a verified provider email to an existing verified account", async () => {
    const client = await createApiClient();
    const { body } = await registerUser(client, {
      email: "existing@example.com",
      organizationName: "Existing Studio",
    });

    const linked = await resolveOAuthUser({
      provider: "GOOGLE",
      providerAccountId: "google-existing",
      email: "existing@example.com",
      name: "Existing User",
      emailVerified: true,
    });

    expect(linked.id).toBe(body.user.id);
    expect(await prisma.oAuthAccount.count()).toBe(1);
    expect(await prisma.organization.count()).toBe(1);
  });

  it("takes over an unverified password account only after provider verification", async () => {
    const passwordHash = await hashPassword(PASSWORD);
    const squatted = await prisma.user.create({
      data: {
        name: "Squatter",
        email: "victim@example.com",
        passwordHash,
      },
    });
    await prisma.organization.create({
      data: {
        name: "Squatted Studio",
        slug: "squatted-studio",
        memberships: {
          create: { userId: squatted.id, role: "ADMIN", status: "ACTIVE" },
        },
      },
    });

    const linked = await resolveOAuthUser({
      provider: "GOOGLE",
      providerAccountId: "google-victim",
      email: "victim@example.com",
      name: "Real Owner",
      emailVerified: true,
    });

    expect(linked.id).toBe(squatted.id);
    expect(linked.emailVerifiedAt).not.toBeNull();
    expect(linked.passwordHash).toBeNull();
    expect(await prisma.organization.count()).toBe(1);
  });

  it("discards a pending signup when OAuth verifies the same email", async () => {
    const client = await createApiClient();
    await registerPendingUser(client, {
      email: "oauth-pending@example.com",
      organizationName: "Pending OAuth Studio",
    });

    const user = await resolveOAuthUser({
      provider: "GOOGLE",
      providerAccountId: "google-pending",
      email: "oauth-pending@example.com",
      name: "OAuth Pending",
      emailVerified: true,
    });

    expect(user.emailVerifiedAt).not.toBeNull();
    expect(
      await prisma.pendingRegistration.count({ where: { email: "oauth-pending@example.com" } }),
    ).toBe(0);
    expect(await prisma.organization.count()).toBe(1);
  });

  it("rejects unverified provider emails", async () => {
    await expect(
      resolveOAuthUser({
        provider: "GITHUB",
        providerAccountId: "github-unverified",
        email: "unverified@example.com",
        name: "Unverified",
        emailVerified: false,
      }),
    ).rejects.toMatchObject({ code: "OAUTH_EMAIL_UNVERIFIED" });

    expect(await prisma.user.count()).toBe(0);
    expect(await prisma.oAuthAccount.count()).toBe(0);
  });

  it("reports no providers and rejects unconfigured starts", async () => {
    const client = await createApiClient();

    const providers = await client.get("/api/v1/auth/oauth/providers");
    expect(providers.status).toBe(200);
    expect(providers.body.providers).toEqual([]);

    const start = await client.get("/api/v1/auth/oauth/google");
    expect(start.status).toBe(404);
    expect(start.body.error.code).toBe("OAUTH_PROVIDER_UNAVAILABLE");
  });
});
