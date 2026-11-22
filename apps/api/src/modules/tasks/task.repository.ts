import type { Prisma, TaskPriority, TaskStatus } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const taskInclude = {
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { id: true, name: true } },
    },
  },
  contentItem: {
    select: { id: true, title: true, status: true },
  },
  assignee: true,
  createdBy: true,
} as const;

export type TaskFilters = {
  status?: TaskStatus;
  priority?: TaskPriority;
  projectId?: string;
  contentItemId?: string;
  assigneeId?: string;
  overdue?: boolean;
  search?: string;
};

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function taskWhere(
  organizationId: string,
  filters: TaskFilters,
  scope: { viewAll: boolean; userId: string },
): Prisma.TaskWhereInput {
  return {
    organizationId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.projectId ? { projectId: filters.projectId } : {}),
    ...(filters.contentItemId ? { contentItemId: filters.contentItemId } : {}),
    ...(filters.assigneeId ? { assigneeId: filters.assigneeId } : {}),
    ...(filters.overdue ? { dueDate: { lt: startOfTodayUtc() }, status: { not: "DONE" } } : {}),
    ...(filters.search
      ? { title: { contains: filters.search, mode: "insensitive" as const } }
      : {}),
    ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
  };
}

export const taskRepository = {
  list(
    organizationId: string,
    filters: TaskFilters,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.task.findMany({
      where: taskWhere(organizationId, filters, scope),
      include: taskInclude,
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
  },

  findAccessible(
    taskId: string,
    organizationId: string,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.task.findFirst({
      where: {
        id: taskId,
        organizationId,
        ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
      },
      include: taskInclude,
    });
  },

  findByIdInOrganization(taskId: string, organizationId: string, db: DbClient = prisma) {
    return db.task.findFirst({
      where: { id: taskId, organizationId },
      include: taskInclude,
    });
  },

  findContentInProject(
    contentItemId: string,
    organizationId: string,
    projectId: string,
    db: DbClient = prisma,
  ) {
    return db.contentItem.findFirst({
      where: { id: contentItemId, organizationId, projectId },
      select: { id: true, title: true },
    });
  },

  create(
    data: {
      organizationId: string;
      projectId: string;
      contentItemId?: string | null;
      title: string;
      description?: string | null;
      status?: TaskStatus;
      priority?: TaskPriority;
      assigneeId?: string | null;
      createdById: string;
      dueDate?: Date | null;
    },
    db: DbClient = prisma,
  ) {
    return db.task.create({ data, include: taskInclude });
  },

  update(taskId: string, data: Prisma.TaskUncheckedUpdateInput, db: DbClient = prisma) {
    return db.task.update({
      where: { id: taskId },
      data,
      include: taskInclude,
    });
  },
};

export type TaskWithRelations = Prisma.TaskGetPayload<{
  include: typeof taskInclude;
}>;
