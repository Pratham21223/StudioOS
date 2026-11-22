import type { Prisma, ProjectStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const projectInclude = {
  client: {
    select: {
      id: true,
      name: true,
      status: true,
    },
  },
  _count: {
    select: { memberships: true },
  },
} as const;

export const projectRepository = {
  list(
    organizationId: string,
    filters: { status?: ProjectStatus; clientId?: string; search?: string },
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.project.findMany({
      where: {
        organizationId,
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.clientId ? { clientId: filters.clientId } : {}),
        ...(filters.search
          ? { name: { contains: filters.search, mode: "insensitive" as const } }
          : {}),
        ...(scope.viewAll ? {} : { memberships: { some: { userId: scope.userId } } }),
      },
      include: projectInclude,
      orderBy: [{ createdAt: "desc" }],
    });
  },

  findByIdInOrganization(projectId: string, organizationId: string, db: DbClient = prisma) {
    return db.project.findFirst({
      where: { id: projectId, organizationId },
      include: projectInclude,
    });
  },

  findAccessible(
    projectId: string,
    organizationId: string,
    userId: string,
    viewAll: boolean,
    db: DbClient = prisma,
  ) {
    return db.project.findFirst({
      where: {
        id: projectId,
        organizationId,
        ...(viewAll ? {} : { memberships: { some: { userId } } }),
      },
      include: projectInclude,
    });
  },

  create(
    data: {
      organizationId: string;
      clientId: string;
      name: string;
      description?: string | null;
      status?: ProjectStatus;
      startDate?: Date | null;
      deadline?: Date | null;
    },
    db: DbClient = prisma,
  ) {
    return db.project.create({ data, include: projectInclude });
  },

  update(projectId: string, data: Prisma.ProjectUncheckedUpdateInput, db: DbClient = prisma) {
    return db.project.update({
      where: { id: projectId },
      data,
      include: projectInclude,
    });
  },

  listMembers(organizationId: string, projectId: string, db: DbClient = prisma) {
    return db.projectMembership.findMany({
      where: { organizationId, projectId },
      include: { user: true },
      orderBy: { createdAt: "asc" },
    });
  },

  findMember(organizationId: string, projectId: string, userId: string, db: DbClient = prisma) {
    return db.projectMembership.findFirst({
      where: { organizationId, projectId, userId },
    });
  },

  addMembers(organizationId: string, projectId: string, userIds: string[], db: DbClient = prisma) {
    return db.projectMembership.createMany({
      data: userIds.map((userId) => ({
        organizationId,
        projectId,
        userId,
      })),
      skipDuplicates: true,
    });
  },

  removeMember(organizationId: string, projectId: string, userId: string, db: DbClient = prisma) {
    return db.projectMembership.deleteMany({
      where: { organizationId, projectId, userId },
    });
  },
};

export type ProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof projectInclude;
}>;
