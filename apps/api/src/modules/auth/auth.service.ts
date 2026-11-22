import type { Organization, OrganizationMembership, Prisma, User } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { hashToken, randomToken } from "../../shared/crypto.js";
import { AppError, isUniqueConstraintError } from "../../shared/errors.js";
import { hashPassword, verifyPassword } from "../../shared/password.js";
import type { RequestMeta } from "../../shared/request-meta.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.validation.js";
import { passwordResetRepository, sessionRepository } from "./session.repository.js";
import { userRepository } from "../users/user.repository.js";
import { clientMembershipRepository } from "../clients/client-membership.repository.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { organizationRepository } from "../organizations/organization.repository.js";
import { recordAudit } from "../audit/audit.service.js";
import { queueEmail } from "../notifications/notification.service.js";

const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;
const PASSWORD_RESET_TTL_MS = env.PASSWORD_RESET_TTL_MINUTES * 60 * 1000;

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

function slugify(value: string): string {
  const slug = value
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
  return slug || "workspace";
}

async function generateUniqueSlug(name: string, tx: Prisma.TransactionClient): Promise<string> {
  const base = slugify(name);
  for (let suffix = 0; suffix < 50; suffix += 1) {
    const candidate = suffix === 0 ? base : `${base.slice(0, 64)}-${suffix + 1}`.slice(0, 80);
    const existing = await organizationRepository.findBySlug(candidate, tx);
    if (!existing) return candidate;
  }
  return `${base.slice(0, 64)}-${Date.now().toString(36)}`;
}

export type RegisterResult = {
  user: User;
  organization: Organization;
  membership: OrganizationMembership;
  sessionToken: string;
};

export async function register(input: RegisterInput, meta: RequestMeta): Promise<RegisterResult> {
  const existing = await userRepository.findByEmail(input.email);
  if (existing) {
    throw AppError.conflict(
      "EMAIL_ALREADY_REGISTERED",
      "An account with that email already exists. Sign in instead.",
    );
  }

  const passwordHash = await hashPassword(input.password);
  const sessionToken = randomToken();
  const tokenHash = hashToken(sessionToken);
  const expiresAt = sessionExpiry();

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

      const slug = await generateUniqueSlug(input.organizationName, tx);
      const organization = await tx.organization.create({
        data: { name: input.organizationName, slug },
      });

      const membership = await tx.organizationMembership.create({
        data: {
          organizationId: organization.id,
          userId: user.id,
          role: "ADMIN",
          status: "ACTIVE",
        },
      });

      await sessionRepository.create(
        {
          userId: user.id,
          tokenHash,
          expiresAt,
          ipAddress: meta.ipAddress ?? null,
          userAgent: normalizeUserAgent(meta.userAgent),
        },
        tx,
      );

      await recordAudit(tx, {
        organizationId: organization.id,
        actorId: user.id,
        action: "organization.created",
        resourceType: "organization",
        resourceId: organization.id,
        metadata: { name: organization.name, slug: organization.slug },
      });

      return { user, organization, membership, sessionToken };
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

export type LoginResult = {
  user: User;
  memberships: Awaited<ReturnType<typeof membershipRepository.listActiveForUser>>;
  clientMemberships: Awaited<ReturnType<typeof clientMembershipRepository.listActiveForUser>>;
  sessionToken: string;
};

export async function login(
  input: LoginInput,
  meta: RequestMeta,
  previousSessionToken?: string | null,
): Promise<LoginResult> {
  const user = await userRepository.findByEmail(input.email);

  if (!user) {
    await verifyPassword(await getDummyHash(), input.password);
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password);
  if (!passwordValid || user.status !== "ACTIVE") {
    throw new AppError(401, "INVALID_CREDENTIALS", "Email or password is incorrect.");
  }

  const sessionToken = randomToken();
  await prisma.$transaction(async (tx) => {
    if (previousSessionToken) {
      await sessionRepository.deleteByTokenHash(hashToken(previousSessionToken), tx);
    }
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
  });

  const [memberships, clientMemberships] = await Promise.all([
    membershipRepository.listActiveForUser(user.id),
    clientMembershipRepository.listActiveForUser(user.id),
  ]);
  return { user, memberships, clientMemberships, sessionToken };
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
      subject: "Reset your StudioOS password",
      text: `Hi ${user.name},\n\nReset your StudioOS password: ${env.PASSWORD_RESET_BASE_URL}?token=${encodeURIComponent(token)}\n\nThis link expires in ${env.PASSWORD_RESET_TTL_MINUTES} minutes. If you did not request this, you can ignore this email.`,
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
    await sessionRepository.deleteAllForUser(record.userId, tx);
    await passwordResetRepository.deleteUnusedForUser(record.userId, tx);
  });
}
