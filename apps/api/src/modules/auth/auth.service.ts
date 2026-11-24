import { randomInt } from "node:crypto";
import type { Organization, OrganizationMembership, Prisma, User } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { passwordResetEmail, verificationCodeEmail } from "../../infrastructure/email/templates.js";
import { hashToken, randomToken, safeEqual } from "../../shared/crypto.js";
import { AppError, isUniqueConstraintError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/password.js";
import type { RequestMeta } from "../../shared/request-meta.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
  ResendVerificationInput,
  VerifyEmailInput,
} from "./auth.validation.js";
import { emailOtpRepository } from "./email-otp.repository.js";
import { passwordResetRepository, sessionRepository } from "./session.repository.js";
import { userRepository } from "../users/user.repository.js";
import { clientMembershipRepository } from "../clients/client-membership.repository.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { recordAudit } from "../audit/audit.service.js";
import { queueEmail } from "../notifications/notification.service.js";

const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;
const EMAIL_OTP_TTL_MS = env.EMAIL_OTP_TTL_MINUTES * 60 * 1000;
const EMAIL_OTP_RESEND_MS = env.EMAIL_OTP_RESEND_SECONDS * 1000;
const EMAIL_OTP_PURPOSE = "REGISTRATION" as const;

let dummyHashPromise: Promise<string> | undefined;

/** Equalizes login timing when the email does not exist. */
function getDummyHash(): Promise<string> {
  dummyHashPromise ??= hashPassword(randomToken());
  return dummyHashPromise;
}

function normalizeUserAgent(userAgent: string | null | undefined): string | null {
  return userAgent ? userAgent.slice(0, 512) : null;
}

function sessionExpiry(): Date {
  return new Date(Date.now() + SESSION_TTL_MS);
}

function generateOtpCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, "0");
}

/**
 * OTPs are short numeric codes, so they are keyed with the server secret and
 * scoped to the user. A database leak alone cannot be brute-forced offline.
 */
function hashOtpCode(userId: string, code: string): string {
  return hashToken(`email-otp:${userId}:${code}`);
}

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "workspace";
}

export async function generateUniqueSlug(
  name: string,
  tx: Prisma.TransactionClient,
): Promise<string> {
  const base = slugify(name);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base.slice(0, 64)}-${suffix + 1}`.slice(0, 80);
    const existing = await organizationRepository.findBySlug(candidate, tx);
    if (!existing) return candidate;
  }
  return `${base.slice(0, 64)}-${Date.now().toString(36)}`;
}

export async function createWorkspaceWithAdmin(
  tx: Prisma.TransactionClient,
  userId: string,
  organizationName: string,
): Promise<{ organization: Organization; membership: OrganizationMembership }> {
  const slug = await generateUniqueSlug(organizationName, tx);
  const organization = await tx.organization.create({
    data: { name: organizationName, slug },
  });

  const membership = await tx.organizationMembership.create({
    data: {
      organizationId: organization.id,
      userId,
      role: "ADMIN",
      status: "ACTIVE",
    },
  });

  await recordAudit(tx, {
    organizationId: organization.id,
    actorId: userId,
    action: "organization.created",
    resourceType: "organization",
    resourceId: organization.id,
    metadata: { name: organization.name, slug: organization.slug },
  });

  return { organization, membership };
}

async function queueVerificationCode(
  tx: Prisma.TransactionClient,
  user: Pick<User, "id" | "name" | "email">,
  code: string,
  expiresAt: Date,
): Promise<void> {
  await emailOtpRepository.create(
    {
      userId: user.id,
      purpose: EMAIL_OTP_PURPOSE,
      codeHash: hashOtpCode(user.id, code),
      expiresAt,
    },
    tx,
  );

  await queueEmail(tx, {
    to: user.email,
    ...verificationCodeEmail({
      name: user.name,
      code,
      expiresInMinutes: env.EMAIL_OTP_TTL_MINUTES,
    }),
  });
}

export type RegisterResult = {
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
  verificationCode: string;
};

export async function register(input: RegisterInput): Promise<RegisterResult> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw AppError.conflict(
      "EMAIL_ALREADY_REGISTERED",
      "An account with that email already exists. Sign in or verify your email instead.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const verificationCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  try {
    return await prisma.$transaction(async (tx) => {
      const user = await userRepository.create(
        {
          name: input.name,
          email: input.email,
          passwordHash,
        },
        tx,
      );

      const { organization, membership } = await createWorkspaceWithAdmin(
        tx,
        user.id,
        input.organizationName,
      );

      await queueVerificationCode(tx, user, verificationCode, expiresAt);

      return { user, organization, membership, verificationCode };
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      throw AppError.conflict(
        "REGISTRATION_CONFLICT",
        "That email or workspace URL is already in use.",
      );
    }
    throw error;
  }
}

export type AuthSessionResult = {
  user: User;
  memberships: Awaited<ReturnType<typeof membershipRepository.listActiveForUser>>;
  clientMemberships: Awaited<ReturnType<typeof clientMembershipRepository.listActiveForUser>>;
  sessionToken: string;
};

export async function establishSession(
  userId: string,
  meta: RequestMeta,
  previousSessionToken?: string | null,
): Promise<string> {
  const sessionToken = randomToken();

  await prisma.$transaction(async (tx) => {
    if (previousSessionToken) {
      await sessionRepository.deleteByTokenHash(hashToken(previousSessionToken), tx);
    }
    await sessionRepository.create(
      {
        userId,
        tokenHash: hashToken(sessionToken),
        expiresAt: sessionExpiry(),
        ipAddress: meta.ipAddress ?? null,
        userAgent: normalizeUserAgent(meta.userAgent),
      },
      tx,
    );
  });

  return sessionToken;
}

async function sessionResult(user: User, sessionToken: string): Promise<AuthSessionResult> {
  const [memberships, clientMemberships] = await Promise.all([
    membershipRepository.listActiveForUser(user.id),
    clientMembershipRepository.listActiveForUser(user.id),
  ]);
  return { user, memberships, clientMemberships, sessionToken };
}

export async function verifyRegistrationEmail(
  input: VerifyEmailInput,
  meta: RequestMeta,
): Promise<AuthSessionResult> {
  const now = new Date();
  const user = await userRepository.findByEmail(input.email);

  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest(
      "OTP_INVALID",
      "That verification code is invalid or has expired. Request a new code.",
    );
  }

  if (user.emailVerifiedAt) {
    throw AppError.conflict(
      "EMAIL_ALREADY_VERIFIED",
      "This email is already verified. Sign in instead.",
    );
  }

  const otp = await emailOtpRepository.findLatestActive(user.id, EMAIL_OTP_PURPOSE);
  if (!otp || otp.expiresAt.getTime() <= now.getTime()) {
    throw AppError.badRequest(
      "OTP_EXPIRED",
      "That verification code has expired. Request a new code.",
    );
  }

  if (otp.attempts >= env.EMAIL_OTP_MAX_ATTEMPTS) {
    throw new AppError(
      429,
      "OTP_ATTEMPTS_EXCEEDED",
      "Too many incorrect attempts. Request a new verification code.",
    );
  }

  if (!safeEqual(otp.codeHash, hashOtpCode(user.id, input.code))) {
    await emailOtpRepository.incrementAttempts(otp.id);
    throw AppError.badRequest("OTP_INVALID", "That verification code is not correct.");
  }

  const sessionToken = randomToken();
  const verifiedUser = await prisma.$transaction(async (tx) => {
    const claimed = await emailOtpRepository.claim(otp.id, now, tx);
    if (claimed.count !== 1) {
      throw AppError.badRequest(
        "OTP_INVALID",
        "That verification code is invalid or has expired. Request a new code.",
      );
    }

    const updated = await userRepository.markEmailVerified(user.id, now, tx);
    await emailOtpRepository.deleteActiveForUser(user.id, EMAIL_OTP_PURPOSE, tx);

    await sessionRepository.create(
      {
        userId: user.id,
        tokenHash: hashToken(sessionToken),
        expiresAt: sessionExpiry(),
        ipAddress: meta.ipAddress ?? null,
        userAgent: normalizeUserAgent(meta.userAgent),
      },
      tx,
    );

    return updated;
  });

  return sessionResult(verifiedUser, sessionToken);
}

export async function resendRegistrationCode(
  input: ResendVerificationInput,
): Promise<{ user: User; verificationCode: string } | null> {
  const user = await userRepository.findByEmail(input.email);
  if (!user || user.status !== "ACTIVE" || user.emailVerifiedAt) return null;

  const latest = await emailOtpRepository.findLatest(user.id, EMAIL_OTP_PURPOSE);
  if (latest && Date.now() - latest.createdAt.getTime() < EMAIL_OTP_RESEND_MS) {
    return null;
  }

  const verificationCode = generateOtpCode();
  const expiresAt = new Date(Date.now() + EMAIL_OTP_TTL_MS);

  await prisma.$transaction(async (tx) => {
    await emailOtpRepository.deleteActiveForUser(user.id, EMAIL_OTP_PURPOSE, tx);
    await queueVerificationCode(tx, user, verificationCode, expiresAt);
  });

  return { user, verificationCode };
}

export async function login(
  input: LoginInput,
  meta: RequestMeta,
  previousSessionToken?: string | null,
): Promise<AuthSessionResult> {
  const user = await userRepository.findByEmail(input.email);

  if (!user || !user.passwordHash) {
    await verifyPassword(await getDummyHash(), input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);
  if (!passwordValid || user.status !== "ACTIVE") {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  if (!user.emailVerifiedAt) {
    throw new AppError(
      403,
      "EMAIL_NOT_VERIFIED",
      "Verify your email address before signing in. We can send you a new code.",
    );
  }

  const sessionToken = await establishSession(user.id, meta, previousSessionToken);
  return sessionResult(user, sessionToken);
}

export async function logout(sessionToken: string | null): Promise<void> {
  if (!sessionToken) return;
  await sessionRepository.deleteByTokenHash(hashToken(sessionToken));
}

export async function getMe(userId: string) {
  const user = await userRepository.findById(userId);
  if (!user || user.status !== "ACTIVE") {
    throw new AppError(401, "SESSION_EXPIRED", "Your session has expired. Sign in again.");
  }
  if (!user.emailVerifiedAt) {
    throw AppError.unauthorized(
      "EMAIL_NOT_VERIFIED",
      "Verify your email address before continuing.",
    );
  }

  const [memberships, clientMemberships] = await Promise.all([
    membershipRepository.listActiveForUser(userId),
    clientMembershipRepository.listActiveForUser(userId),
  ]);
  return { user, memberships, clientMemberships };
}

export async function requestPasswordReset(
  input: ForgotPasswordInput,
): Promise<{ token: string } | null> {
  const user = await userRepository.findByEmail(input.email);

  // Always return success semantics to avoid account enumeration.
  if (!user || user.status !== "ACTIVE") return null;

  const token = randomToken();
  const now = new Date();

  await prisma.$transaction(async (tx) => {
    await passwordResetRepository.deleteUnusedForUser(user.id, tx);
    await passwordResetRepository.create(
      {
        userId: user.id,
        tokenHash: hashToken(token),
        expiresAt: new Date(now.getTime() + PASSWORD_RESET_TTL_MS),
      },
      tx,
    );

    await queueEmail(tx, {
      to: user.email,
      ...passwordResetEmail({
        name: user.name,
        resetUrl: `${env.PASSWORD_RESET_BASE_URL}?token=${encodeURIComponent(token)}`,
        expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES,
      }),
    });
  });

  return { token };
}

export async function resetPassword(input: ResetPasswordInput): Promise<void> {
  const tokenHash = hashToken(input.token);
  const record = await passwordResetRepository.findByTokenHash(tokenHash);
  const now = new Date();

  if (!record || record.usedAt || record.expiresAt.getTime() <= now.getTime()) {
    throw AppError.badRequest(
      "PASSWORD_RESET_INVALID",
      "This password reset link is invalid or has expired.",
    );
  }

  const user = await userRepository.findById(record.userId);
  if (!user || user.status !== "ACTIVE") {
    throw AppError.badRequest(
      "PASSWORD_RESET_INVALID",
      "This password reset link is invalid or has expired.",
    );
  }

  const passwordHash = await hashPassword(input.password);

  await prisma.$transaction(async (tx) => {
    const claimed = await passwordResetRepository.claim(record.id, now, tx);
    if (claimed.count !== 1) {
      throw AppError.badRequest(
        "PASSWORD_RESET_INVALID",
        "This password reset link is invalid or has expired.",
      );
    }

    await userRepository.updatePassword(record.userId, passwordHash, tx);
    // Receiving the reset link proves control of the mailbox, so an account
    // that never completed OTP verification can be considered verified.
    if (!user.emailVerifiedAt) {
      await userRepository.markEmailVerified(record.userId, now, tx);
    }
    await sessionRepository.deleteAllForUser(record.userId, tx);
    await passwordResetRepository.deleteUnusedForUser(record.userId, tx);
  });
}
