import type { ClientStatus, Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const clientCounts = {
  select: {
    projects: true,
    memberships: true,
  },
} as const;

export const clientRepository = {
  list(
    organizationId: string,
    filters: { status?: ClientStatus; search?: string },
    db: DbClient = prisma,
  ) {
    return db.client.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.search
          ? { name: { contains: filters.search, mode: "insensitive" as const } }
          : {}),
      },
      include: { _count: clientCounts },
      orderBy: [{ name: "asc" }],
    });
  },

  findByIdInOrganization(clientId: string, organizationId: string, db: DbClient = prisma) {
    return db.client.findFirst({
      where: { id: clientId, organizationId },
      include: { _count: clientCounts },
    });
  },

  findById(clientId: string, db: DbClient = prisma) {
    return db.client.findUnique({ where: { id: clientId } });
  },

  create(
    data: {
      organizationId: string;
      name: string;
      contactName?: string | null;
      email?: string | null;
      phone?: string | null;
      website?: string | null;
      notes?: string | null;
      brandGuidelines?: string | null;
      status?: ClientStatus;
    },
    db: DbClient = prisma,
  ) {
    return db.client.create({ data });
  },

  update(clientId: string, data: Prisma.ClientUpdateInput, db: DbClient = prisma) {
    return db.client.update({
      where: { id: clientId },
      data,
      include: { _count: clientCounts },
    });
  },
};

export type ClientWithCounts = Prisma.ClientGetPayload<{
  include: { _count: typeof clientCounts };
}>;
