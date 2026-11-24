import type { OAuthProvider, User } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors.js";
import { createWorkspaceWithAdmin } from "./auth.service.js";

export type OAuthIdentity = {
  provider: OAuthProvider;
  providerAccountId: string;
  email: string;
  name: string;
  emailVerified: boolean;
};

function fallbackName(email: string): string {
  return email.split("@")[0]?.slice(0, 120) || "StudioOS member";
}

function normalizeName(name: string | null | undefined, email: string): string {
  const normalized = name?.trim().replace(/\s+/g, " ").slice(0, 120);
  return normalized || fallbackName(email);
}

/**
 * Resolves a verified third-party identity to a local user.
 *
 * - Existing OAuth links are used first.
 * - A verified provider email is linked to the matching local account.
 * - Unknown emails get a new account and a starter workspace.
 *
 * Unverified local accounts have their untrusted password removed before they
 * are linked, so an account squatted with someone else's email cannot keep a
 * password that the real mailbox owner does not control.
 */
export async function resolveOAuthUser(identity: OAuthIdentity): Promise<User> {
  if (!identity.emailVerified) {
    throw new AppError(
      403,
      "OAUTH_EMAIL_UNVERIFIED",
      "Your provider did not supply a verified email address.",
    );
  }

  const email = identity.email.trim().toLowerCase();
  if (!email) {
    throw new AppError(
      403,
      "OAUTH_EMAIL_UNAVAILABLE",
      "Your provider did not share an email address.",
    );
  }

  const name = normalizeName(identity.name, email);

  return prisma.$transaction(async (tx) => {
    const linked = await tx.oAuthAccount.findUnique({
      where: {
        provider_providerAccountId: {
          provider: identity.provider,
          providerAccountId: identity.providerAccountId,
        },
      },
      include: { user: true },
    });

    if (linked) {
      if (linked.user.status !== "ACTIVE") {
        throw AppError.forbidden(
          "ACCOUNT_DEACTIVATED",
          "This account is not active. Contact your workspace administrator.",
        );
      }

      let user = linked.user;
      if (!user.emailVerifiedAt) {
        user = await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date() },
        });
      }

      await tx.pendingRegistration.deleteMany({
        where: { OR: [{ email }, { email: user.email }] },
      });
      return user;
    }

    let user = await tx.user.findUnique({ where: { email } });

    if (user) {
      if (user.status !== "ACTIVE") {
        throw AppError.forbidden(
          "ACCOUNT_DEACTIVATED",
          "This account is not active. Contact your workspace administrator.",
        );
      }

      if (!user.emailVerifiedAt) {
        // The provider just proved ownership of this mailbox. Discard any
        // password chosen before verification and any stale sessions/codes.
        await tx.session.deleteMany({ where: { userId: user.id } });
        await tx.emailOtpCode.deleteMany({ where: { userId: user.id } });
        user = await tx.user.update({
          where: { id: user.id },
          data: { emailVerifiedAt: new Date(), passwordHash: null },
        });
      }
    } else {
      user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash: null,
          emailVerifiedAt: new Date(),
        },
      });

      await createWorkspaceWithAdmin(tx, user.id, `${name}'s Workspace`);
    }

    await tx.oAuthAccount.create({
      data: {
        userId: user.id,
        provider: identity.provider,
        providerAccountId: identity.providerAccountId,
        email,
      },
    });

    await tx.pendingRegistration.deleteMany({ where: { email } });

    return user;
  });
}
