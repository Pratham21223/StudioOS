import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import { AppError } from "../../shared/errors.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { projectRepository } from "./project.repository.js";

/**
 * Validate a content or task assignee. Admins and project managers can be
 * assigned across projects; producers and editors must be on the project team
 * so that assignees can always access the work they own.
 */
export async function resolveProjectAssignee(
  organizationId: string,
  projectId: string,
  assigneeId: string,
  field: string,
  db: Prisma.TransactionClient | typeof prisma = prisma,
): Promise<string> {
  const membership = await membershipRepository.findForUser(organizationId, assigneeId, db);
  if (!membership || membership.status !== "ACTIVE") {
    throw AppError.badRequest(
      "INVALID_ASSIGNEE",
      "Work can only be assigned to an active internal member of this workspace.",
      [{ path: field, message: "Select an active workspace member." }],
    );
  }

  if (membership.role !== "ADMIN" && membership.role !== "PROJECT_MANAGER") {
    const projectMembership = await projectRepository.findMember(
      organizationId,
      projectId,
      assigneeId,
      db,
    );
    if (!projectMembership) {
      throw AppError.badRequest(
        "ASSIGNEE_NOT_ON_PROJECT",
        "Producers and editors must be assigned to the project before they can be assigned work.",
        [{ path: field, message: "Add this person to the project team first." }],
      );
    }
  }

  return assigneeId;
}
