import type { OrgRole, MembershipStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const membershipInclude = {
  organization: {
    select: {
      id: true,
      name: true,
      slug: true,
      status: true,
      createdAt: true,
    },
  },
} as const;

export const membershipRepository = {
  listActiveForUser(userId: string, db: DbClient = prisma) {
    return db.organizationMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        organization: { status: "ACTIVE" },
      },
      include: membershipInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  findForUser(organizationId: string, userId: string, db: DbClient = prisma) {
    return db.organizationMembership.findUnique({
      where: { organizationId_userId: { organizationId, userId } },
    });
  },

  findByIdInOrganization(organizationId: string, membershipId: string, db: DbClient = prisma) {
    return db.organizationMembership.findFirst({
      where: { id: membershipId, organizationId },
      include: { user: true },
    });
  },

  listForOrganization(organizationId: string, db: DbClient = prisma) {
    return db.organizationMembership.findMany({
      where: { organizationId },
      include: { user: true },
      orderBy: [{ createdAt: "asc" }],
    });
  },

  countActiveAdmins(organizationId: string, db: DbClient = prisma) {
    return db.organizationMembership.count({
      where: {
        organizationId,
        role: "ADMIN",
        status: "ACTIVE",
      },
    });
  },

  findActiveForUsers(organizationId: string, userIds: string[], db: DbClient = prisma) {
    return db.organizationMembership.findMany({
      where: {
        organizationId,
        userId: { in: userIds },
        status: "ACTIVE",
      },
      select: { userId: true },
    });
  },

  create(
    data: {
      organizationId: string;
      userId: string;
      role: OrgRole;
      status?: MembershipStatus;
    },
    db: DbClient = prisma,
  ) {
    return db.organizationMembership.create({ data });
  },

  update(id: string, data: { role?: OrgRole; status?: MembershipStatus }, db: DbClient = prisma) {
    return db.organizationMembership.update({
      where: { id },
      data,
      include: { user: true },
    });
  },
};
