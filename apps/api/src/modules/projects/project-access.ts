import type { Prisma } from "@prisma/client";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { projectRepository, type ProjectWithRelations } from "./project.repository.js";

export function canViewAllProjects(tenant: TenantContext): boolean {
  return hasPermission(tenant.role, PERMISSIONS.PROJECTS_MANAGE);
}

export async function requireAccessibleProject(
  tenant: TenantContext,
  projectId: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<ProjectWithRelations> {
  const project = await projectRepository.findAccessible(
    projectId,
    tenant.organizationId,
    tenant.userId,
    canViewAllProjects(tenant),
    db,
  );
  if (!project) {
    throw AppError.notFound("PROJECT_NOT_FOUND", "The requested project was not found.");
  }
  return project;
}

export function assertProjectOpen(project: Pick<ProjectWithRelations, "status">): void {
  if (project.status === "COMPLETED") {
    throw AppError.conflict(
      "PROJECT_COMPLETED",
      "Completed projects are read-only. Content and tasks cannot be changed.",
    );
  }
}
