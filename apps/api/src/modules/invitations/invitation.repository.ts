import type { Prisma, OrgRole } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const organizationPreview = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
} as const;

export const invitationRepository = {
  findPendingByEmail(organizationId: string, email: string, now: Date, db: DbClient = prisma) {
    return db.invitation.findFirst({
      where: {
        organizationId,
        email,
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
      include: { organization: { select: organizationPreview } },
    });
  },

  listPending(organizationId: string, now: Date, db: DbClient = prisma) {
    return db.invitation.findMany({
      where: {
        organizationId,
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
      email: string;
      role: OrgRole;
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
    data: { role: OrgRole; tokenHash: string; invitedById: string; expiresAt: Date },
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

export type InvitationWithOrganization = Prisma.InvitationGetPayload<{
  include: { organization: { select: typeof organizationPreview } };
}>;
