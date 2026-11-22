import type { Invitation, User } from "@prisma/client";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { AuthContext, TenantContext } from "../../shared/context.js";
import { hashToken, randomToken } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import { hashPassword } from "../../shared/password.js";
import { presentOrganization } from "../../shared/presenters.js";
import { recordAudit } from "../audit/audit.service.js";
import type { RequestMeta } from "../../shared/request-meta.js";
import { sessionRepository } from "../auth/session.repository.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { userRepository } from "../users/user.repository.js";
import { invitationRepository } from "./invitation.repository.js";
import type { AcceptInvitationInput, CreateInvitationInput } from "./invitation.validation.js";

const INVITATION_TTL_MS = env.INVITATION_TTL_HOURS * 60 * 60 * 1000;
const SESSION_TTL_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

type InvitationStatus = "PENDING" | "ACCEPTED" | "REVOKED" | "EXPIRED";

function invitationStatus(invitation: Invitation, now = new Date()): InvitationStatus {
  if (invitation.acceptedAt) return "ACCEPTED";
  if (invitation.revokedAt) return "REVOKED";
  if (invitation.expiresAt.getTime() <= now.getTime()) return "EXPIRED";
  return "PENDING";
}

export function presentInvitation(invitation: Invitation) {
  return {
    id: invitation.id,
    email: invitation.email,
    role: invitation.role,
    status: invitationStatus(invitation),
    expiresAt: invitation.expiresAt.toISOString(),
    acceptedAt: invitation.acceptedAt?.toISOString() ?? null,
    createdAt: invitation.createdAt.toISOString(),
  };
}

export async function createInvitation(
  tenant: TenantContext,
  actorId: string,
  input: CreateInvitationInput,
) {
  const targetUser = await userRepository.findByEmail(input.email);
  if (targetUser) {
    const existingMembership = await membershipRepository.findForUser(
      tenant.organizationId,
      targetUser.id,
    );
    if (existingMembership?.status === "ACTIVE") {
      throw AppError.conflict(
        "ALREADY_MEMBER",
        "That person is already an active member of this workspace.",
      );
    }
  }

  const now = new Date();
  const token = randomToken();
  const tokenHash = hashToken(token);
  const expiresAt = new Date(now.getTime() + INVITATION_TTL_MS);

  const invitation = await prisma.$transaction(async (tx) => {
    const pending = await invitationRepository.findPendingByEmail(
      tenant.organizationId,
      input.email,
      now,
      tx,
    );

    const record = pending
      ? await invitationRepository.reissue(
          pending.id,
          {
            role: input.role,
            tokenHash,
            invitedById: actorId,
            expiresAt,
          },
          tx,
        )
      : await invitationRepository.create(
          {
            organizationId: tenant.organizationId,
            email: input.email,
            role: input.role,
            tokenHash,
            invitedById: actorId,
            expiresAt,
          },
          tx,
        );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: pending ? "invitation.reissued" : "invitation.created",
      resourceType: "invitation",
      resourceId: record.id,
      metadata: { email: record.email, role: record.role },
    });

    return record;
  });

  return { invitation, token };
}

export async function listPendingInvitations(tenant: TenantContext) {
  return invitationRepository.listPending(tenant.organizationId, new Date());
}

export async function getInvitationPreview(token: string) {
  const invitation = await invitationRepository.findByTokenHash(hashToken(token));
  if (!invitation) {
    throw AppError.notFound(
      "INVITATION_NOT_FOUND",
      "This invitation link is invalid or no longer available.",
    );
  }

  return {
    organization: presentOrganization(invitation.organization),
    email: invitation.email,
    role: invitation.role,
    expiresAt: invitation.expiresAt.toISOString(),
    status: invitationStatus(invitation),
  };
}

export type AcceptInvitationResult = {
  user: User;
  membership: {
    id: string;
    role: Invitation["role"];
    status: "ACTIVE" | "DEACTIVATED";
    createdAt: Date;
  };
  organization: {
    id: string;
    name: string;
    slug: string;
    status: "ACTIVE" | "DEACTIVATED";
    createdAt: Date;
  };
  sessionToken: string;
};

export async function acceptInvitation(
  input: AcceptInvitationInput,
  auth: AuthContext | undefined,
  meta: RequestMeta,
): Promise<AcceptInvitationResult> {
  const invitation = await invitationRepository.findByTokenHash(hashToken(input.token));
  if (!invitation) {
    throw AppError.notFound(
      "INVITATION_NOT_FOUND",
      "This invitation link is invalid or no longer available.",
    );
  }

  const now = new Date();
  if (invitation.acceptedAt) {
    throw AppError.conflict(
      "INVITATION_ALREADY_ACCEPTED",
      "This invitation has already been accepted.",
    );
  }
  if (invitation.revokedAt) {
    throw AppError.badRequest("INVITATION_REVOKED", "This invitation has been revoked.");
  }
  if (invitation.expiresAt.getTime() <= now.getTime()) {
    throw new AppError(410, "INVITATION_EXPIRED", "This invitation has expired.");
  }
  if (invitation.organization.status !== "ACTIVE") {
    throw AppError.notFound(
      "INVITATION_NOT_FOUND",
      "This invitation link is invalid or no longer available.",
    );
  }

  const invitationEmail = invitation.email.toLowerCase();
  let existingUser: User | null = null;
  let newPasswordHash: string | null = null;

  if (auth) {
    if (auth.user.email.toLowerCase() !== invitationEmail) {
      throw AppError.forbidden(
        "INVITATION_EMAIL_MISMATCH",
        `This invitation was sent to ${invitation.email}. Sign in with that address to accept it.`,
      );
    }
  } else {
    existingUser = await userRepository.findByEmail(invitationEmail);

    if (existingUser) {
      if (existingUser.status !== "ACTIVE") {
        throw AppError.forbidden(
          "ACCOUNT_DEACTIVATED",
          "This account is not active. Contact your workspace administrator.",
        );
      }
      throw AppError.conflict(
        "SIGN_IN_REQUIRED",
        "An account already exists for this email. Sign in to accept the invitation.",
      );
    }

    if (!input.name || !input.password) {
      throw AppError.unauthorized(
        "AUTHENTICATION_REQUIRED",
        "Sign in or create an account to accept this invitation.",
      );
    }

    newPasswordHash = await hashPassword(input.password);
  }

  const sessionToken = randomToken();
  const sessionTokenHash = hashToken(sessionToken);
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);

  const result = await prisma.$transaction(async (tx) => {
    let user: User;

    if (auth) {
      const currentUser = await userRepository.findById(auth.userId, tx);
      if (!currentUser || currentUser.status !== "ACTIVE") {
        throw AppError.unauthorized("SESSION_EXPIRED", "Your session has expired. Sign in again.");
      }
      user = currentUser;
    } else if (existingUser) {
      user = existingUser;
    } else {
      if (!input.name || !newPasswordHash) {
        throw AppError.unauthorized(
          "AUTHENTICATION_REQUIRED",
          "Sign in or create an account to accept this invitation.",
        );
      }
      user = await userRepository.create(
        {
          name: input.name,
          email: invitation.email,
          passwordHash: newPasswordHash,
        },
        tx,
      );
    }

    const claimed = await invitationRepository.claim(invitation.id, invitation.tokenHash, now, tx);
    if (claimed.count !== 1) {
      throw AppError.conflict(
        "INVITATION_ALREADY_ACCEPTED",
        "This invitation has already been accepted.",
      );
    }

    let membership = await membershipRepository.findForUser(invitation.organizationId, user.id, tx);

    if (membership) {
      if (membership.status === "ACTIVE") {
        throw AppError.conflict("ALREADY_MEMBER", "You are already a member of this workspace.");
      }
      membership = await membershipRepository.update(
        membership.id,
        { role: invitation.role, status: "ACTIVE" },
        tx,
      );
    } else {
      membership = await membershipRepository.create(
        {
          organizationId: invitation.organizationId,
          userId: user.id,
          role: invitation.role,
          status: "ACTIVE",
        },
        tx,
      );
    }

    if (auth) {
      await sessionRepository.deleteById(auth.sessionId, tx);
    }

    await sessionRepository.create(
      {
        userId: user.id,
        tokenHash: sessionTokenHash,
        expiresAt,
        ipAddress: meta.ipAddress ?? null,
        userAgent: meta.userAgent?.slice(0, 512) ?? null,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: invitation.organizationId,
      actorId: user.id,
      action: "invitation.accepted",
      resourceType: "invitation",
      resourceId: invitation.id,
      metadata: { email: invitation.email, role: invitation.role },
    });

    return { user, membership };
  });

  return {
    user: result.user,
    membership: {
      id: result.membership.id,
      role: result.membership.role,
      status: result.membership.status,
      createdAt: result.membership.createdAt,
    },
    organization: invitation.organization,
    sessionToken,
  };
}
