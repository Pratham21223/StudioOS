import type { Prisma } from "@prisma/client";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { clientRepository } from "../clients/client.repository.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { projectRepository } from "./project.repository.js";
import { presentProject, presentProjectMember } from "./project.presenter.js";
import type {
  AssignProjectMembersInput,
  CreateProjectInput,
  ProjectListQuery,
  UpdateProjectInput,
} from "./project.validation.js";

function canViewAllProjects(tenant: TenantContext): boolean {
  return hasPermission(tenant.role, PERMISSIONS.PROJECTS_MANAGE);
}

function toDate(value: string | null | undefined): Date | null | undefined {
  if (value === undefined || value === null) return value;
  return new Date(`${value}T00:00:00.000Z`);
}

function assertDateOrder(startDate: Date | null, deadline: Date | null): void {
  if (startDate && deadline && startDate.getTime() > deadline.getTime()) {
    throw AppError.badRequest(
      "INVALID_PROJECT_DATES",
      "The project deadline cannot be before its start date.",
    );
  }
}

async function requireClientInTenant(
  organizationId: string,
  clientId: string,
  requireActive: boolean,
  db: Prisma.TransactionClient | typeof prisma = prisma,
) {
  const client = await clientRepository.findByIdInOrganization(clientId, organizationId, db);
  if (!client) {
    throw AppError.notFound("CLIENT_NOT_FOUND", "The requested client was not found.");
  }
  if (requireActive && client.status !== "ACTIVE") {
    throw AppError.badRequest(
      "CLIENT_ARCHIVED",
      "Archived clients cannot receive new or reassigned projects.",
    );
  }
  return client;
}

export async function listProjects(tenant: TenantContext, query: ProjectListQuery) {
  const projects = await projectRepository.list(tenant.organizationId, query, {
    viewAll: canViewAllProjects(tenant),
    userId: tenant.userId,
  });
  return projects.map(presentProject);
}

export async function getProject(tenant: TenantContext, projectId: string) {
  const project = await projectRepository.findAccessible(
    projectId,
    tenant.organizationId,
    tenant.userId,
    canViewAllProjects(tenant),
  );
  if (!project) {
    throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
  }
  return presentProject(project);
}

export async function createProject(
  tenant: TenantContext,
  actorId: string,
  input: CreateProjectInput,
) {
  return prisma.$transaction(async (tx) => {
    await requireClientInTenant(tenant.organizationId, input.clientId, true, tx);

    const startDate = toDate(input.startDate) ?? null;
    const deadline = toDate(input.deadline) ?? null;
    assertDateOrder(startDate, deadline);

    const project = await projectRepository.create(
      {
        organizationId: tenant.organizationId,
        clientId: input.clientId,
        name: input.name,
        description: input.description ? input.description : null,
        status: "ACTIVE",
        startDate,
        deadline,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "project.created",
      resourceType: "project",
      resourceId: project.id,
      metadata: {
        name: project.name,
        clientId: project.clientId,
        status: project.status,
      },
    });

    return presentProject(project);
  });
}

export async function updateProject(
  tenant: TenantContext,
  actorId: string,
  projectId: string,
  input: UpdateProjectInput,
) {
  return prisma.$transaction(async (tx) => {
    const existing = await projectRepository.findByIdInOrganization(
      projectId,
      tenant.organizationId,
      tx,
    );
    if (!existing) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
    }

    if (
      input.status !== undefined &&
      existing.status === "COMPLETED" &&
      input.status !== "COMPLETED"
    ) {
      throw AppError.conflict(
        "PROJECT_COMPLETED",
        "Completed projects cannot be reopened or paused.",
      );
    }

    if (input.clientId !== undefined && input.clientId !== existing.clientId) {
      await requireClientInTenant(tenant.organizationId, input.clientId, true, tx);
    }

    const startDate = input.startDate !== undefined ? toDate(input.startDate) : existing.startDate;
    const deadline = input.deadline !== undefined ? toDate(input.deadline) : existing.deadline;
    assertDateOrder(startDate ?? null, deadline ?? null);

    const data: Prisma.ProjectUncheckedUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.description !== undefined) {
      data.description = input.description.length > 0 ? input.description : null;
    }
    if (input.status !== undefined) data.status = input.status;
    if (input.clientId !== undefined) data.clientId = input.clientId;
    if (input.startDate !== undefined) data.startDate = toDate(input.startDate);
    if (input.deadline !== undefined) data.deadline = toDate(input.deadline);

    const updated = await projectRepository.update(projectId, data, tx);
    const presented = presentProject(updated);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "project.updated",
      resourceType: "project",
      resourceId: projectId,
      metadata: {
        previousStatus: existing.status,
        status: updated.status,
        previousClientId: existing.clientId,
        clientId: updated.clientId,
        name: updated.name,
      },
    });

    return presented;
  });
}

export async function listProjectMembers(tenant: TenantContext, projectId: string) {
  const project = await projectRepository.findAccessible(
    projectId,
    tenant.organizationId,
    tenant.userId,
    canViewAllProjects(tenant),
  );
  if (!project) {
    throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
  }

  const members = await projectRepository.listMembers(tenant.organizationId, projectId);
  return members.map(presentProjectMember);
}

export async function assignProjectMembers(
  tenant: TenantContext,
  actorId: string,
  projectId: string,
  input: AssignProjectMembersInput,
) {
  return prisma.$transaction(async (tx) => {
    const project = await projectRepository.findByIdInOrganization(
      projectId,
      tenant.organizationId,
      tx,
    );
    if (!project) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
    }

    const activeMembers = await membershipRepository.findActiveForUsers(
      tenant.organizationId,
      input.userIds,
      tx,
    );
    const activeIds = new Set(activeMembers.map((membership) => membership.userId));
    const invalidUserIds = input.userIds.filter((userId) => !activeIds.has(userId));
    if (invalidUserIds.length > 0) {
      throw AppError.badRequest(
        "INVALID_PROJECT_MEMBER",
        "All project members must be active internal members of this workspace.",
        invalidUserIds.map((userId) => ({
          path: "userIds",
          message: `User ${userId} is not an active workspace member.`,
        })),
      );
    }

    await projectRepository.addMembers(tenant.organizationId, projectId, input.userIds, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "project.members_added",
      resourceType: "project",
      resourceId: projectId,
      metadata: { userIds: input.userIds },
    });

    const members = await projectRepository.listMembers(tenant.organizationId, projectId, tx);
    return members.map(presentProjectMember);
  });
}

export async function removeProjectMember(
  tenant: TenantContext,
  actorId: string,
  projectId: string,
  userId: string,
) {
  return prisma.$transaction(async (tx) => {
    const project = await projectRepository.findByIdInOrganization(
      projectId,
      tenant.organizationId,
      tx,
    );
    if (!project) {
      throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
    }

    const membership = await projectRepository.findMember(
      tenant.organizationId,
      projectId,
      userId,
      tx,
    );
    if (!membership) {
      throw AppError.notFound(
        "PROJECT_MEMBER_NOT_FOUND",
        "The requested project member was not found.",
      );
    }

    await projectRepository.removeMember(tenant.organizationId, projectId, userId, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "project.member_removed",
      resourceType: "project",
      resourceId: projectId,
      metadata: { userId },
    });

    return { removed: true };
  });
}
