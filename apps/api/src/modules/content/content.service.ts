import type { Prisma } from "@prisma/client";
import {
  PERMISSIONS,
  canPerformContentTransition,
  hasPermission,
  isContentTransitionAllowed,
} from "@studioos/shared";
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
import { contentRepository } from "./content.repository.js";
import { presentContent, presentWorkflowEvent } from "./content.presenter.js";
import type {
  ContentListQuery,
  CreateContentInput,
  TransitionContentInput,
  UpdateContentInput,
} from "./content.validation.js";

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function scopeFor(tenant: TenantContext) {
  return { viewAll: canViewAllProjects(tenant), userId: tenant.userId };
}

async function requireAccessibleContent(
  tenant: TenantContext,
  contentId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const content = await contentRepository.findAccessible(
    contentId,
    tenant.organizationId,
    scopeFor(tenant),
    db,
  );
  if (!content) {
    throw AppError.notFound("CONTENT_NOT_FOUND", "The requested content item was not found.");
  }
  return content;
}

export async function listContent(tenant: TenantContext, query: ContentListQuery) {
  if (query.projectId) {
    await requireAccessibleProject(tenant, query.projectId);
  }

  const items = await contentRepository.list(
    tenant.organizationId,
    {
      ...query,
      assigneeId: query.assigneeId === "me" ? tenant.userId : query.assigneeId,
    },
    scopeFor(tenant),
  );
  return items.map(presentContent);
}

export async function listProjectContent(
  tenant: TenantContext,
  projectId: string,
  query: ContentListQuery,
) {
  await requireAccessibleProject(tenant, projectId);
  const items = await contentRepository.listForProject(
    tenant.organizationId,
    projectId,
    {
      ...query,
      assigneeId: query.assigneeId === "me" ? tenant.userId : query.assigneeId,
    },
    scopeFor(tenant),
  );
  return items.map(presentContent);
}

export async function getContent(tenant: TenantContext, contentId: string) {
  return presentContent(await requireAccessibleContent(tenant, contentId));
}

export async function listContentHistory(tenant: TenantContext, contentId: string) {
  await requireAccessibleContent(tenant, contentId);
  const events = await contentRepository.listEvents(tenant.organizationId, contentId);
  return events.map(presentWorkflowEvent);
}

export async function createContent(
  tenant: TenantContext,
  actorId: string,
  projectId: string,
  input: CreateContentInput,
) {
  return prisma.$transaction(async (tx) => {
    const project = await requireAccessibleProject(tenant, projectId, tx);
    assertProjectOpen(project);

    const assigneeId = input.assigneeId
      ? await resolveProjectAssignee(
          tenant.organizationId,
          projectId,
          input.assigneeId,
          "assigneeId",
          tx,
        )
      : null;

    const content = await contentRepository.create(
      {
        organizationId: tenant.organizationId,
        projectId,
        title: input.title,
        description: input.description ? input.description : null,
        type: input.type,
        status: "BRIEF",
        deadline: toDate(input.deadline) ?? null,
        assigneeId,
        version: 1,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "content.created",
      resourceType: "content_item",
      resourceId: content.id,
      metadata: {
        title: content.title,
        type: content.type,
        status: content.status,
        projectId,
        assigneeId,
      },
    });

    return presentContent(content);
  });
}

export async function updateContent(
  tenant: TenantContext,
  actorId: string,
  contentId: string,
  input: UpdateContentInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireAccessibleContent(tenant, contentId, tx);
    assertProjectOpen(existing.project);

    const data: Prisma.ContentItemUncheckedUpdateInput = {};
    if (input.title !== undefined) data.title = input.title;
    if (input.type !== undefined) data.type = input.type;
    if (input.description !== undefined) {
      data.description = input.description.length > 0 ? input.description : null;
    }
    if (input.deadline !== undefined) data.deadline = toDate(input.deadline);
    if (input.assigneeId !== undefined) {
      data.assigneeId = input.assigneeId
        ? await resolveProjectAssignee(
            tenant.organizationId,
            existing.projectId,
            input.assigneeId,
            "assigneeId",
            tx,
          )
        : null;
    }

    const updated = await contentRepository.update(contentId, data, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "content.updated",
      resourceType: "content_item",
      resourceId: contentId,
      metadata: {
        title: updated.title,
        type: updated.type,
        deadline: updated.deadline?.toISOString().slice(0, 10) ?? null,
        assigneeId: updated.assigneeId,
      },
    });

    return presentContent(updated);
  });
}

export async function transitionContent(
  tenant: TenantContext,
  actorId: string,
  contentId: string,
  input: TransitionContentInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await requireAccessibleContent(tenant, contentId, tx);
    assertProjectOpen(existing.project);

    if (existing.status === input.toStatus) {
      throw AppError.conflict(
        "CONTENT_STATE_CHANGED",
        `This content item is already in ${input.toStatus}. Refresh to see the latest state.`,
      );
    }

    if (input.expectedVersion !== undefined && input.expectedVersion !== existing.version) {
      throw AppError.conflict(
        "CONTENT_STATE_CHANGED",
        "This content item changed while you were working. Refresh and try again.",
      );
    }

    if (!isContentTransitionAllowed(existing.status, input.toStatus)) {
      throw AppError.conflict(
        "INVALID_CONTENT_TRANSITION",
        `Content cannot move from ${existing.status} to ${input.toStatus}.`,
      );
    }

    if (!hasPermission(tenant.role, PERMISSIONS.CONTENT_TRANSITION)) {
      throw AppError.forbidden(
        "CONTENT_TRANSITION_FORBIDDEN",
        "Your role cannot move content through the workflow.",
      );
    }

    if (!canPerformContentTransition(tenant.role, existing.status, input.toStatus)) {
      throw AppError.forbidden(
        "CONTENT_TRANSITION_FORBIDDEN",
        `${tenant.role} cannot perform the ${existing.status} to ${input.toStatus} transition.`,
      );
    }

    if (existing.status === "CLIENT_APPROVAL" && input.toStatus === "EDITING" && !input.note) {
      throw AppError.badRequest(
        "TRANSITION_NOTE_REQUIRED",
        "A revision must explain what needs to change.",
        [{ path: "note", message: "Add revision feedback." }],
      );
    }

    const claimed = await contentRepository.applyTransition(
      contentId,
      existing.status,
      existing.version,
      input.toStatus,
      tx,
    );
    if (claimed.count !== 1) {
      throw AppError.conflict(
        "CONTENT_STATE_CHANGED",
        "This content item changed while you were updating it. Refresh and try again.",
      );
    }

    const updated = await contentRepository.findByIdInOrganization(
      contentId,
      tenant.organizationId,
      tx,
    );
    if (!updated) {
      throw AppError.notFound("CONTENT_NOT_FOUND", "The requested content item was not found.");
    }

    const event = await contentRepository.createEvent(
      {
        organizationId: tenant.organizationId,
        contentItemId: contentId,
        actorId,
        fromStatus: existing.status,
        toStatus: input.toStatus,
        note: input.note ?? null,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "content.transitioned",
      resourceType: "content_item",
      resourceId: contentId,
      metadata: {
        fromStatus: existing.status,
        toStatus: input.toStatus,
        version: updated.version,
        note: input.note ?? null,
      },
    });

    return {
      content: presentContent(updated),
      event: presentWorkflowEvent(event),
    };
  });
}
