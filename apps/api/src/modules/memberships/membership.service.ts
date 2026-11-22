import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { membershipRepository } from "./membership.repository.js";
import type { UpdateMembershipInput } from "./membership.validation.js";

export async function listMembers(tenant: TenantContext) {
  return membershipRepository.listForOrganization(tenant.organizationId);
}

export async function updateMember(
  tenant: TenantContext,
  actorId: string,
  membershipId: string,
  input: UpdateMembershipInput,
) {
  return prisma.$transaction(async (tx) => {
    // Serialize admin/membership changes per workspace so two concurrent
    // demotions cannot both observe "another admin exists" and leave zero.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${tenant.organizationId}))`;

    const target = await membershipRepository.findByIdInOrganization(
      tenant.organizationId,
      membershipId,
      tx,
    );

    if (!target) {
      throw AppError.notFound("MEMBERSHIP_NOT_FOUND", "The requested membership was not found.");
    }

    const nextRole = input.role ?? target.role;
    const nextStatus = input.status ?? target.status;

    if (nextRole === target.role && nextStatus === target.status) {
      return target;
    }

    const removesActiveAdmin =
      target.role === "ADMIN" &&
      target.status === "ACTIVE" &&
      (nextRole !== "ADMIN" || nextStatus !== "ACTIVE");

    if (removesActiveAdmin) {
      const activeAdmins = await membershipRepository.countActiveAdmins(tenant.organizationId, tx);
      if (activeAdmins <= 1) {
        throw AppError.conflict(
          "LAST_ADMIN_REQUIRED",
          "A workspace must keep at least one active admin.",
        );
      }
    }

    const updated = await membershipRepository.update(
      membershipId,
      { role: nextRole, status: nextStatus },
      tx,
    );

    const action =
      nextStatus === "DEACTIVATED" && target.status === "ACTIVE"
        ? "membership.deactivated"
        : nextStatus === "ACTIVE" && target.status === "DEACTIVATED"
          ? "membership.reactivated"
          : "membership.role_changed";

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action,
      resourceType: "organization_membership",
      resourceId: membershipId,
      metadata: {
        targetUserId: target.userId,
        previousRole: target.role,
        role: updated.role,
        previousStatus: target.status,
        status: updated.status,
      },
    });

    return updated;
  });
}
