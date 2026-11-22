import type { InvitationType, OrgRole, Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const organizationPreview = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
} as const;

const clientPreview = {
  id: true,
  name: true,
  status: true,
} as const;

export const invitationRepository = {
  findPendingByEmail(organizationId: string, email: string, now: Date, db: DbClient = prisma) {
    return db.invitation.findFirst({
      where: {
        organizationId,
        email,
        type: "INTERNAL",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findPendingClientInvitation(
    organizationId: string,
    clientId: string,
    email: string,
    now: Date,
    db: DbClient = prisma,
  ) {
    return db.invitation.findFirst({
      where: {
        organizationId,
        clientId,
        email,
        type: "CLIENT",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  findByTokenHash(tokenHash: string, db: DbClient = prisma) {
    return db.invitation.findUnique({
      where: { tokenHash },
      include: {
        organization: { select: organizationPreview },
        client: { select: clientPreview },
      },
    });
  },

  listPending(organizationId: string, now: Date, db: DbClient = prisma) {
    return db.invitation.findMany({
      where: {
        organizationId,
        type: "INTERNAL",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  listPendingForClient(organizationId: string, clientId: string, now: Date, db: DbClient = prisma) {
    return db.invitation.findMany({
      where: {
        organizationId,
        clientId,
        type: "CLIENT",
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      orderBy: { createdAt: "desc" },
    });
  },

  create(
    data: {
      organizationId: string;
      clientId?: string | null;
      type: InvitationType;
      email: string;
      role?: OrgRole | null;
      tokenHash: string;
      invitedById: string;
      expiresAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.invitation.create({ data });
  },

  reissue(
    id: string,
    data: {
      role?: OrgRole | null;
      tokenHash: string;
      invitedById: string;
      expiresAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.invitation.update({ where: { id }, data });
  },

  claim(id: string, tokenHash: string, now: Date, db: DbClient = prisma) {
    return db.invitation.updateMany({
      where: {
        id,
        tokenHash,
        acceptedAt: null,
        revokedAt: null,
        expiresAt: { gt: now },
      },
      data: { acceptedAt: now },
    });
  },
};

export type InvitationWithRelations = Prisma.InvitationGetPayload<{
  include: {
    organization: { select: typeof organizationPreview };
    client: { select: typeof clientPreview };
  };
}>;
