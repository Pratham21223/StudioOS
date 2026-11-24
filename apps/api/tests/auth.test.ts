import { beforeEach, describe, expect, it } from "vitest";
import request from "supertest";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { decryptPayload, hashToken } from "../src/shared/crypto.js";
import {
  NEW_PASSWORD,
  PASSWORD,
  app,
  createApiClient,
  extractResetToken,
  registerPendingUser,
  registerUser,
  resetDatabase,
  setupOrganization,
} from "./helpers.js";

function incorrectCode(code: string): string {
  return code === "000000" ? "000001" : "000000";
}

describe("authentication", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates a pending account, then verifies the OTP and opens a session", async () => {
    const client = await createApiClient();
    const pending = await registerPendingUser(client, {
      name: "Ada Admin",
      email: "Ada@Example.com",
      organizationName: "Ada Studio",
    });

    expect(pending.response.status).toBe(202);
    expect(pending.response.body.email).toBe("ada@example.com");
    expect(pending.response.body.devCode).toMatch(/^\d{6}$/);
    expect(pending.response.body.csrfToken).toBeUndefined();

    // No session exists until the emailed code is verified.
    expect((await client.get("/api/v1/auth/me")).status).toBe(401);

    const dbUser = await prisma.user.findUnique({
      where: { email: "ada@example.com" },
    });
    expect(dbUser).not.toBeNull();
    expect(dbUser!.passwordHash).not.toBe(PASSWORD);
    expect(dbUser!.passwordHash).toMatch(/^\$argon2id\$/);
    expect(dbUser!.emailVerifiedAt).toBeNull();

    const otp = await prisma.emailOtpCode.findFirst({ where: { userId: dbUser!.id } });
    expect(otp).not.toBeNull();
    expect(otp!.codeHash).toMatch(/^[a-f0-9]{64}$/);
    expect(otp!.codeHash).not.toBe(pending.devCode);
    expect(otp!.consumedAt).toBeNull();

    const queuedEmail = await prisma.outboxEvent.findFirst({ where: { type: "EMAIL" } });
    expect(queuedEmail).not.toBeNull();
    const emailPayload = decryptPayload<{ html?: string; text: string }>(
      queuedEmail!.payloadCiphertext,
    );
    expect(emailPayload.text).toContain(pending.devCode);
    expect(emailPayload.html).toContain("Your verification code");
    expect(emailPayload.html).toContain(pending.devCode);

    const verifyResponse = await client.post("/api/v1/auth/register/verify", {
      email: "ada@example.com",
      code: pending.devCode,
    });
    expect(verifyResponse.status).toBe(200);
    expect(verifyResponse.body.user.email).toBe("ada@example.com");
    expect(verifyResponse.body.user.emailVerified).toBe(true);
    expect(verifyResponse.body.memberships).toHaveLength(1);
    expect(verifyResponse.body.memberships[0]!.role).toBe("ADMIN");
    expect(verifyResponse.body.memberships[0]!.organization.name).toBe("Ada Studio");
    expect(verifyResponse.body.memberships[0]!.organization.slug).toBe("ada-studio");
    expect(verifyResponse.body.csrfToken).toBeTruthy();

    const verifiedUser = await prisma.user.findUnique({
      where: { email: "ada@example.com" },
    });
    expect(verifiedUser!.emailVerifiedAt).not.toBeNull();

    const organizations = await prisma.organization.findMany();
    expect(organizations).toHaveLength(1);

    const membership = await prisma.organizationMembership.findFirst({
      where: { userId: dbUser!.id },
    });
    expect(membership?.role).toBe("ADMIN");

    const sessions = await prisma.session.findMany({ where: { userId: dbUser!.id } });
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!.tokenHash).toMatch(/^[a-f0-9]{64}$/);

    const meResponse = await client.get("/api/v1/auth/me").expect(200);
    expect(meResponse.body.user.email).toBe("ada@example.com");
    expect(meResponse.body.memberships[0].organization.slug).toBe("ada-studio");
  });

  it("rejects unverified logins and invalid or reused OTP codes", async () => {
    const client = await createApiClient();
    const pending = await registerPendingUser(client, {
      email: "verify@example.com",
      organizationName: "Verify Studio",
    });

    const unverifiedLogin = await client.post("/api/v1/auth/login", {
      email: "verify@example.com",
      password: PASSWORD,
    });
    expect(unverifiedLogin.status).toBe(403);
    expect(unverifiedLogin.body.error.code).toBe("EMAIL_NOT_VERIFIED");

    const wrongCode = await client.post("/api/v1/auth/register/verify", {
      email: "verify@example.com",
      code: incorrectCode(pending.devCode),
    });
    expect(wrongCode.status).toBe(400);
    expect(wrongCode.body.error.code).toBe("OTP_INVALID");

    const dbUser = await prisma.user.findUnique({ where: { email: "verify@example.com" } });
    expect(dbUser!.emailVerifiedAt).toBeNull();
    const attempts = await prisma.emailOtpCode.findFirst({ where: { userId: dbUser!.id } });
    expect(attempts!.attempts).toBe(1);

    const verified = await client.post("/api/v1/auth/register/verify", {
      email: "verify@example.com",
      code: pending.devCode,
    });
    expect(verified.status).toBe(200);

    const secondClient = await createApiClient();
    const reused = await secondClient.post("/api/v1/auth/register/verify", {
      email: "verify@example.com",
      code: pending.devCode,
    });
    expect(reused.status).toBe(409);
    expect(reused.body.error.code).toBe("EMAIL_ALREADY_VERIFIED");
  });

  it("resends a fresh OTP and invalidates the previous code", async () => {
    const client = await createApiClient();
    const pending = await registerPendingUser(client, {
      email: "resend@example.com",
      organizationName: "Resend Studio",
    });

    // Cooldown suppresses immediate resends, so expire the stored record first.
    await prisma.emailOtpCode.updateMany({
      where: { consumedAt: null },
      data: { createdAt: new Date(Date.now() - 5 * 60 * 1000) },
    });

    const resent = await client.post("/api/v1/auth/register/resend", {
      email: "resend@example.com",
    });
    expect(resent.status).toBe(200);
    expect(resent.body.devCode).toMatch(/^\d{6}$/);
    expect(resent.body.devCode).not.toBe(pending.devCode);

    const oldCode = await client.post("/api/v1/auth/register/verify", {
      email: "resend@example.com",
      code: pending.devCode,
    });
    expect(oldCode.status).toBe(400);
    expect(oldCode.body.error.code).toBe("OTP_INVALID");

    const verified = await client.post("/api/v1/auth/register/verify", {
      email: "resend@example.com",
      code: resent.body.devCode,
    });
    expect(verified.status).toBe(200);
  });

  it("locks an OTP after too many incorrect attempts", async () => {
    const client = await createApiClient();
    const pending = await registerPendingUser(client, {
      email: "attempts@example.com",
      organizationName: "Attempts Studio",
    });

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await client.post("/api/v1/auth/register/verify", {
        email: "attempts@example.com",
        code: incorrectCode(pending.devCode),
      });
      expect(wrong.status).toBe(400);
    }

    const blocked = await client.post("/api/v1/auth/register/verify", {
      email: "attempts@example.com",
      code: pending.devCode,
    });
    expect(blocked.status).toBe(429);
    expect(blocked.body.error.code).toBe("OTP_ATTEMPTS_EXCEEDED");
  });

  it("sets a HTTP-only, SameSite session cookie", async () => {
    const client = await createApiClient();
    const { response } = await registerUser(client, {
      email: "cookies@example.com",
      organizationName: "Cookie Studio",
    });

    const setCookie = response.headers["set-cookie"] as unknown as string[];
    const sessionCookie = setCookie.find((value) => value.startsWith("studioos_session="));
    expect(sessionCookie).toBeDefined();
    expect(sessionCookie).toContain("HttpOnly");
    expect(sessionCookie).toContain("SameSite=Lax");
    expect(sessionCookie).toContain("Path=/");

    const csrfCookie = setCookie.find((value) => value.startsWith("studioos_csrf="));
    expect(csrfCookie).toBeDefined();
    expect(csrfCookie).not.toContain("HttpOnly");

    const rawSessionToken = sessionCookie!.split(";")[0]!.split("=")[1]!;
    const storedSession = await prisma.session.findFirst();
    expect(storedSession).not.toBeNull();
    expect(storedSession!.tokenHash).not.toBe(rawSessionToken);
    expect(storedSession!.tokenHash).toBe(hashToken(rawSessionToken));
  });

  it("rejects duplicate emails without creating a second organization", async () => {
    const first = await createApiClient();
    await registerUser(first, {
      email: "duplicate@example.com",
      organizationName: "First Studio",
    });

    const second = await createApiClient();
    const { response } = await registerUser(second, {
      email: "DUPLICATE@example.com",
      organizationName: "Second Studio",
    });

    expect(response.status).toBe(409);
    expect(response.body.error.code).toBe("EMAIL_ALREADY_REGISTERED");
    expect(await prisma.organization.count()).toBe(1);
    expect(await prisma.user.count()).toBe(1);
  });

  it("validates registration input", async () => {
    const client = await createApiClient();
    const response = await client.post("/api/v1/auth/register", {
      name: "A",
      email: "not-an-email",
      password: "short",
      organizationName: "X",
    });

    expect(response.status).toBe(400);
    expect(response.body.error.code).toBe("VALIDATION_ERROR");
    expect(response.body.error.details.length).toBeGreaterThan(0);
    expect(await prisma.user.count()).toBe(0);
  });

  it("requires a matching CSRF cookie and header for unsafe methods", async () => {
    const anonymous = request(app);
    const register = await anonymous.post("/api/v1/auth/register").send({
      name: "No CSRF",
      email: "csrf@example.com",
      password: PASSWORD,
      organizationName: "CSRF Studio",
    });
    expect(register.status).toBe(403);
    expect(register.body.error.code).toBe("CSRF_INVALID");

    const client = await createApiClient();
    const mismatch = await client.agent
      .post("/api/v1/auth/login")
      .set("x-csrf-token", "not-the-cookie-token")
      .send({ email: "nobody@example.com", password: PASSWORD });
    expect(mismatch.status).toBe(403);
    expect(mismatch.body.error.code).toBe("CSRF_INVALID");
  });

  it("logs in, rejects bad passwords, and invalidates the session on logout", async () => {
    const client = await createApiClient();
    await registerUser(client, {
      email: "login@example.com",
      organizationName: "Login Studio",
    });

    const logout = await client.post("/api/v1/auth/logout");
    expect(logout.status).toBe(204);
    expect(await prisma.session.count()).toBe(0);
    expect((await client.get("/api/v1/auth/me")).status).toBe(401);

    await client.init();

    const wrongPassword = await client.post("/api/v1/auth/login", {
      email: "login@example.com",
      password: "wrong-password-2026",
    });
    expect(wrongPassword.status).toBe(401);
    expect(wrongPassword.body.error.code).toBe("INVALID_CREDENTIALS");

    const login = await client.post("/api/v1/auth/login", {
      email: "LOGIN@example.com",
      password: PASSWORD,
    });
    expect(login.status).toBe(200);
    expect(login.body.memberships[0].organization.name).toBe("Login Studio");
    expect(login.body.csrfToken).toBeTruthy();

    const me = await client.get("/api/v1/auth/me").expect(200);
    expect(me.body.user.email).toBe("login@example.com");
  });

  it("does not reveal unknown emails through password reset", async () => {
    const client = await createApiClient();
    const response = await client.post("/api/v1/auth/password/forgot", {
      email: "nobody@example.com",
    });

    expect(response.status).toBe(200);
    expect(response.body.resetUrl).toBeUndefined();
    expect(await prisma.passwordResetToken.count()).toBe(0);
  });

  it("resets a password with a single-use hashed token and revokes sessions", async () => {
    const client = await createApiClient();
    await registerUser(client, {
      email: "reset@example.com",
      organizationName: "Reset Studio",
    });

    const forgot = await client.post("/api/v1/auth/password/forgot", {
      email: "reset@example.com",
    });
    expect(forgot.status).toBe(200);
    const resetToken = extractResetToken(forgot.body.resetUrl as string);

    const storedToken = await prisma.passwordResetToken.findFirst();
    expect(storedToken).not.toBeNull();
    expect(storedToken!.tokenHash).toBe(hashToken(resetToken));
    expect(storedToken!.tokenHash).not.toBe(resetToken);
    expect(storedToken!.usedAt).toBeNull();

    const resetClient = await createApiClient();
    const reset = await resetClient.post("/api/v1/auth/password/reset", {
      token: resetToken,
      password: NEW_PASSWORD,
    });
    expect(reset.status).toBe(200);

    // All sessions, including the one that requested the reset, are revoked.
    expect((await client.get("/api/v1/auth/me")).status).toBe(401);

    const reuse = await resetClient.init();
    const reuseResponse = await reuse.post("/api/v1/auth/password/reset", {
      token: resetToken,
      password: "Another-password-2026!",
    });
    expect(reuseResponse.status).toBe(400);
    expect(reuseResponse.body.error.code).toBe("PASSWORD_RESET_INVALID");

    await client.init();
    const oldLogin = await client.post("/api/v1/auth/login", {
      email: "reset@example.com",
      password: PASSWORD,
    });
    expect(oldLogin.status).toBe(401);

    const newLogin = await client.post("/api/v1/auth/login", {
      email: "reset@example.com",
      password: NEW_PASSWORD,
    });
    expect(newLogin.status).toBe(200);
  });

  it("requires an active membership for tenant routes", async () => {
    const source = await setupOrganization("Source Studio", "source@example.com");
    const outsider = await setupOrganization("Outsider Studio", "outsider@example.com");

    const response = await outsider.client.get(
      `/api/v1/organizations/${source.organization.id}/members`,
    );
    expect(response.status).toBe(404);
    expect(response.body.error.code).toBe("ORGANIZATION_NOT_FOUND");
  });
});
