import type { ContentStatus, ContentType, Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";
const contentInclude = {
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { id: true, name: true } },
    },
  },
  assignee: true,
} as const;

export type ContentFilters = {
  status?: ContentStatus;
  type?: ContentType;
  projectId?: string;
  assigneeId?: string;
  search?: string;
};

function contentWhere(
  organizationId: string,
  filters: ContentFilters,
  scope: { viewAll: boolean; userId: string },
): Prisma.ContentItemWhereInput {
  return {
    organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.type ? { type: filters.type } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" as const } }
      : {}),
    ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
  };
}

export const contentRepository = {
  list(
    organizationId: string,
    filters: ContentFilters,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.contentItem.findMany({
      where: contentWhere(organizationId, filters, scope),
      include: contentInclude,
      orderBy: [{ deadline: "asc" }, { createdAt: "desc" }],
    });
  },

  listForProject(
    organizationId: string,
    projectId: string,
    filters: ContentFilters,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return this.list(organizationId, { ...filters, projectId }, scope, db);
  },

  findByIdInOrganization(contentId: string, organizationId: string, db: DbClient = prisma) {
    return db.contentItem.findFirst({
      where: { id: contentId, organizationId },
      include: contentInclude,
    });
  },

  findAccessible(
    contentId: string,
    organizationId: string,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.contentItem.findFirst({
      where: {
        id: contentId,
        organizationId,
        ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
      },
      include: contentInclude,
    });
  },

  create(
    data: {
      organizationId: string;
      projectId: string;
      title: string;
      description?: string | null;
      type: ContentType;
      status?: ContentStatus;
      deadline?: Date | null;
      assigneeId?: string | null;
      version?: number;
    },
    db: DbClient = prisma,
  ) {
    return db.contentItem.create({
      data,
      include: contentInclude,
    });
  },

  update(contentId: string, data: Prisma.ContentItemUncheckedUpdateInput, db: DbClient = prisma) {
    return db.contentItem.update({
      where: { id: contentId },
      data,
      include: contentInclude,
    });
  },

  /**
   * Compare-and-swap transition. Returns 0 when another request already moved
   * the item, which the caller reports as a conflict instead of overwriting.
   */
  applyTransition(
    contentId: string,
    expectedStatus: ContentStatus,
    expectedVersion: number,
    nextStatus: ContentStatus,
    db: DbClient = prisma,
  ) {
    return db.contentItem.updateMany({
      where: { id: contentId, status: expectedStatus, version: expectedVersion },
      data: { status: nextStatus, version: { increment: 1 } },
    });
  },

  listEvents(organizationId: string, contentItemId: string, db: DbClient = prisma) {
    return db.workflowEvent.findMany({
      where: { organizationId, contentItemId },
      include: { actor: true },
      orderBy: [{ createdAt: "asc" }],
    });
  },

  createEvent(
    data: {
      organizationId: string;
      contentItemId: string;
      actorId: string | null;
      fromStatus: ContentStatus;
      toStatus: ContentStatus;
      note?: string | null;
    },
    db: DbClient = prisma,
  ) {
    return db.workflowEvent.create({
      data,
      include: { actor: true },
    });
  },
};

export type ContentWithRelations = Prisma.ContentItemGetPayload<{
  include: typeof contentInclude;
}>;
