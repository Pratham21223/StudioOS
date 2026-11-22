import type { ClientMembershipStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const clientSelect = {
  id: true,
  name: true,
  status: true,
} as const;

const organizationSelect = {
  id: true,
  name: true,
  slug: true,
  status: true,
  createdAt: true,
} as const;

export const clientMembershipRepository = {
  listActiveForUser(userId: string, db: DbClient = prisma) {
    return db.clientMembership.findMany({
      where: {
        userId,
        status: "ACTIVE",
        client: { status: "ACTIVE" },
        organization: { status: "ACTIVE" },
      },
      include: {
        client: { select: clientSelect },
        organization: { select: organizationSelect },
      },
      orderBy: { createdAt: "asc" },
    });
  },

  listForClient(organizationId: string, clientId: string, db: DbClient = prisma) {
    return db.clientMembership.findMany({
      where: { organizationId, clientId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  },

  findForUser(clientId: string, userId: string, db: DbClient = prisma) {
    return db.clientMembership.findUnique({
      where: { clientId_userId: { clientId, userId } },
    });
  },

  findByIdInClient(
    organizationId: string,
    clientId: string,
    membershipId: string,
    db: DbClient = prisma,
  ) {
    return db.clientMembership.findFirst({
      where: { id: membershipId, organizationId, clientId },
      include: { user: true },
    });
  },

  create(
    data: {
      organizationId: string;
      clientId: string;
      userId: string;
      status?: ClientMembershipStatus;
    },
    db: DbClient = prisma,
  ) {
    return db.clientMembership.create({ data });
  },

  update(membershipId: string, data: { status: ClientMembershipStatus }, db: DbClient = prisma) {
    return db.clientMembership.update({
      where: { id: membershipId },
      data,
      include: { user: true },
    });
  },
};
