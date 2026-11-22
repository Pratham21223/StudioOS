import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { membershipRepository } from "../memberships/membership.repository.js";
import { organizationRepository } from "./organization.repository.js";
import type { UpdateOrganizationInput } from "./organization.validation.js";

export async function listMyOrganizations(userId: string) {
  return membershipRepository.listActiveForUser(userId);
}

export async function getOrganization(tenant: TenantContext) {
  const organization = await organizationRepository.findById(tenant.organizationId);
  if (!organization) {
    throw AppError.notFound("ORGANIZATION_NOT_FOUND", "The requested workspace was not found.");
  }

  return {
    organization,
    membership: {
      id: tenant.membershipId,
      role: tenant.role,
      status: "ACTIVE" as const,
    },
  };
}

export async function updateOrganization(
  tenant: TenantContext,
  actorId: string,
  input: UpdateOrganizationInput,
) {
  return prisma.$transaction(async (tx) => {
    const current = await organizationRepository.findById(tenant.organizationId, tx);
    if (!current) {
      throw AppError.notFound("ORGANIZATION_NOT_FOUND", "The requested workspace was not found.");
    }

    const updated = await organizationRepository.updateName(tenant.organizationId, input.name, tx);

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "organization.updated",
      resourceType: "organization",
      resourceId: tenant.organizationId,
      metadata: { previousName: current.name, name: updated.name },
    });

    return updated;
  });
}
