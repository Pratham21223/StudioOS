import type { ContentStatus, Prisma } from "@prisma/client";
import { CONTENT_STATUSES, PERMISSIONS, hasPermission } from "@studioos/shared";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

function projectScope(tenant: TenantContext): Prisma.ProjectWhereInput {
  return hasPermission(tenant.role, PERMISSIONS.PROJECTS_MANAGE)
    ? { organizationId: tenant.organizationId }
    : {
        organizationId: tenant.organizationId,
        memberships: { some: { userId: tenant.userId } },
      };
}

function contentScope(tenant: TenantContext): Prisma.ContentItemWhereInput {
  return hasPermission(tenant.role, PERMISSIONS.PROJECTS_MANAGE)
    ? { organizationId: tenant.organizationId }
    : {
        organizationId: tenant.organizationId,
        project: { memberships: { some: { userId: tenant.userId } } },
      };
}

export async function getDashboard(tenant: TenantContext) {
  const manager = hasPermission(tenant.role, PERMISSIONS.PROJECTS_MANAGE);
  const projectWhere = projectScope(tenant);
  const contentWhere = contentScope(tenant);
  const today = startOfTodayUtc();

  const [
    activeProjectCount,
    contentGroups,
    awaitingApproval,
    awaitingApprovalCount,
    myTasks,
    myOpenTaskCount,
    overdueTasks,
    overdueTaskCount,
    projects,
    unreadNotifications,
  ] = await Promise.all([
    prisma.project.count({
      where: { ...projectWhere, status: "ACTIVE" },
    }),
    prisma.contentItem.groupBy({
      by: ["status"],
      where: contentWhere,
      _count: { _all: true },
    }),
    prisma.contentItem.findMany({
      where: { ...contentWhere, status: "CLIENT_APPROVAL" },
      select: {
        id: true,
        title: true,
        deadline: true,
        version: true,
        updatedAt: true,
        project: { select: { id: true, name: true } },
      },
      orderBy: { updatedAt: "asc" },
      take: 8,
    }),
    prisma.contentItem.count({
      where: { ...contentWhere, status: "CLIENT_APPROVAL" },
    }),
    prisma.task.findMany({
      where: {
        organizationId: tenant.organizationId,
        assigneeId: tenant.userId,
        status: { not: "DONE" },
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        project: { select: { id: true, name: true } },
        contentItem: { select: { id: true, title: true } },
      },
      orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.task.count({
      where: {
        organizationId: tenant.organizationId,
        assigneeId: tenant.userId,
        status: { not: "DONE" },
      },
    }),
    prisma.task.findMany({
      where: {
        organizationId: tenant.organizationId,
        status: { not: "DONE" },
        dueDate: { lt: today },
        ...(manager ? {} : { assigneeId: tenant.userId }),
      },
      select: {
        id: true,
        title: true,
        status: true,
        priority: true,
        dueDate: true,
        assignee: { select: { id: true, name: true } },
        project: { select: { id: true, name: true } },
      },
      orderBy: { dueDate: "asc" },
      take: 10,
    }),
    prisma.task.count({
      where: {
        organizationId: tenant.organizationId,
        status: { not: "DONE" },
        dueDate: { lt: today },
        ...(manager ? {} : { assigneeId: tenant.userId }),
      },
    }),
    prisma.project.findMany({
      where: projectWhere,
      select: {
        id: true,
        name: true,
        status: true,
        deadline: true,
        client: { select: { id: true, name: true } },
        contentItems: { select: { status: true } },
        _count: { select: { tasks: true } },
      },
      orderBy: [{ status: "asc" }, { deadline: { sort: "asc", nulls: "last" } }],
      take: 12,
    }),
    prisma.notification.count({
      where: {
        userId: tenant.userId,
        readAt: null,
        OR: [{ organizationId: tenant.organizationId }, { organizationId: null }],
      },
    }),
  ]);

  const byStatus = new Map<ContentStatus, number>();
  for (const group of contentGroups) {
    byStatus.set(group.status, group._count._all);
  }
  const contentByStatus = CONTENT_STATUSES.map((status) => ({
    status,
    count: byStatus.get(status) ?? 0,
  }));
  const activeContent = contentByStatus
    .filter((entry) => entry.status !== "READY_TO_PUBLISH")
    .reduce((total, entry) => total + entry.count, 0);

  return {
    scope: manager ? "ORGANIZATION" : "PROJECTS",
    counts: {
      activeProjects: activeProjectCount,
      activeContent,
      awaitingApproval: awaitingApprovalCount,
      myOpenTasks: myOpenTaskCount,
      overdueTasks: overdueTaskCount,
      unreadNotifications,
    },
    contentByStatus,
    awaitingApproval: awaitingApproval.map((item) => ({
      id: item.id,
      title: item.title,
      deadline: dateOnly(item.deadline),
      version: item.version,
      updatedAt: item.updatedAt.toISOString(),
      project: item.project,
    })),
    myTasks: myTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: dateOnly(task.dueDate),
      project: task.project,
      contentItem: task.contentItem,
    })),
    overdueTasks: overdueTasks.map((task) => ({
      id: task.id,
      title: task.title,
      status: task.status,
      priority: task.priority,
      dueDate: dateOnly(task.dueDate),
      assignee: task.assignee,
      project: task.project,
    })),
    projects: projects.map((project) => ({
      id: project.id,
      name: project.name,
      status: project.status,
      deadline: dateOnly(project.deadline),
      client: project.client,
      taskCount: project._count.tasks,
      contentByStatus: CONTENT_STATUSES.map((status) => ({
        status,
        count: project.contentItems.filter((item) => item.status === status).length,
      })),
    })),
  };
}
