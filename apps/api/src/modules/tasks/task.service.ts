import type { Prisma } from "@prisma/client";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import {
  assertProjectOpen,
  canViewAllProjects,
  requireAccessibleProject,
} from "../projects/project-access.js";
import { resolveProjectAssignee } from "../projects/project-assignee.js";
import { taskRepository } from "./task.repository.js";
import { presentTask } from "./task.presenter.js";
import type {
  CreateTaskInput,
  TaskListQuery,
  UpdateTaskInput,
  UpdateTaskStatusInput,
} from "./task.validation.js";

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function scopeFor(tenant: TenantContext) {
  return { viewAll: canViewAllProjects(tenant), userId: tenant.userId };
}

async function requireAccessibleTask(
  tenant: TenantContext,
  taskId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const task = await taskRepository.findAccessible(
    taskId,
    tenant.organizationId,
    scopeFor(tenant),
    db,
  );
  if (!task) {
    throw AppError.notFound("TASK_NOT_FOUND", "The requested task was not found.");
  }
  return task;
}

async function assertContentItemInProject(
  organizationId: string,
  projectId: string,
  contentItemId: string,
  db: Prisma.TransactionClient | typeof prisma,
): Promise<void> {
  const contentItem = await taskRepository.findContentInProject(
    contentItemId,
    organizationId,
    projectId,
    db,
  );
  if (!contentItem) {
    throw AppError.badRequest(
      "INVALID_TASK_CONTENT",
      "The linked content item must belong to the same project.",
      [{ path: "contentItemId", message: "Select content from this project." }],
    );
  }
}

async function resolveAssignee(
  organizationId: string,
  projectId: string,
  assigneeId: string | null,
  db: Prisma.TransactionClient | typeof prisma,
): Promise<string | null> {
  if (!assigneeId) return null;
  return resolveProjectAssignee(organizationId, projectId, assigneeId, "assigneeId", db);
}

export async function listTasks(tenant: TenantContext, query: TaskListQuery) {
  if (query.projectId) {
    await requireAccessibleProject(tenant, query.projectId);
  }

  const tasks = await taskRepository.list(
    tenant.organizationId,
    {
      ...query,
      assigneeId: query.assigneeId === "me" ? tenant.userId : query.assigneeId,
      overdue: query.overdue === "true",
    },
    scopeFor(tenant),
  );
  return tasks.map(presentTask);
}

export async function getTask(tenant: TenantContext, taskId: string) {
  return presentTask(await requireAccessibleTask(tenant, taskId));
}

export async function createTask(tenant: TenantContext, actorId: string, input: CreateTaskInput) {
  return prisma.$transaction(async (tx) => {
    const project = await requireAccessibleProject(tenant, input.projectId, tx);
    assertProjectOpen(project);

    if (input.contentItemId) {
      await assertContentItemInProject(
        tenant.organizationId,
        input.projectId,
        input.contentItemId,
        tx,
      );
    }

    const assigneeId = await resolveAssignee(
      tenant.organizationId,
      input.projectId,
      input.assigneeId ?? null,
      tx,
    );

    const task = await taskRepository.create(
      {
        organizationId: tenant.organizationId,
        projectId: input.projectId,
        contentItemId: input.contentItemId ?? null,
        title: input.title,
        description: input.description ? input.description : null,
        status: input.status ?? "TODO",
        priority: input.priority ?? "MEDIUM",
        assigneeId,
        createdById: actorId,
        dueDate: toDate(input.dueDate) ?? null,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "task.created",
      resourceType: "task",
      resourceId: task.id,
      metadata: {
        title: task.title,
        projectId: task.projectId,
        contentItemId: task.contentItemId,
        status: task.status,
        priority: task.priority,
        assigneeId: task.assigneeId,
      },
    });

    return presentTask(task);
  });
}

export async function updateTask(
  tenant: TenantContext,
  actorId: string,
  taskId: string,
  input: UpdateTaskInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireAccessibleTask(tenant, taskId, tx);
    assertProjectOpen(existing.project);

    if (input.contentItemId) {
      await assertContentItemInProject(
        tenant.organizationId,
        existing.projectId,
        input.contentItemId,
        tx,
      );
    }

    const data: Prisma.TaskUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.description !== undefined) {
      data.description = input.description.length > 0 ? input.description : null;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.priority !== undefined) data.priority = input.priority;
    if (input.dueDate !== undefined) data.dueDate = toDate(input.dueDate);
    if (input.contentItemId !== undefined) data.contentItemId = input.contentItemId;
    if (input.assigneeId !== undefined) {
      data.assigneeId = await resolveAssignee(
        tenant.organizationId,
        existing.projectId,
        input.assigneeId,
        tx,
      );
    }

    const updated = await taskRepository.update(taskId, data, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "task.updated",
      resourceType: "task",
      resourceId: taskId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        priority: updated.priority,
        assigneeId: updated.assigneeId,
        dueDate: updated.dueDate?.toISOString().slice(0, 10) ?? null,
      },
    });

    return presentTask(updated);
  });
}

export async function updateTaskStatus(
  tenant: TenantContext,
  actorId: string,
  taskId: string,
  input: UpdateTaskStatusInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireAccessibleTask(tenant, taskId, tx);
    assertProjectOpen(existing.project);

    const canManage = hasPermission(tenant.role, PERMISSIONS.TASKS_CREATE);
    if (!canManage && existing.assigneeId !== tenant.userId) {
      throw AppError.forbidden(
        "TASK_STATUS_FORBIDDEN",
        "Only the assignee or a task manager can change this task's status.",
      );
    }

    if (existing.status === input.status) {
      return presentTask(existing);
    }

    const updated = await taskRepository.update(taskId, { status: input.status }, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "task.status_changed",
      resourceType: "task",
      resourceId: taskId,
      metadata: {
        fromStatus: existing.status,
        toStatus: updated.status,
      },
    });

    return presentTask(updated);
  });
}
