import type { RequestHandler } from "express";
import { prisma } from "../infrastructure/database/prisma.js";
import { AppError } from "../shared/errors.js";

const UUID_PATTERN =
  /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-8][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}$/;

/**
 * The organization id in the URL is only a selector. Access is granted solely
 * by an active membership resolved from the authenticated session.
 *
 * Inaccessible and non-existent organizations both return 404 to avoid
 * cross-tenant resource enumeration.
 */
export const resolveTenant: RequestHandler = async (req, _res, next) => {
  if (!req.auth) {
    next(AppError.unauthorized());
    return;
  }

  const organizationId = req.params.orgId;
  if (typeof organizationId !== "string" || !UUID_PATTERN.test(organizationId)) {
    next(AppError.notFound("ORGANIZATION_NOT_FOUND", "The requested workspace was not found."));
    return;
  }

  const membership = await prisma.organizationMembership.findUnique({
    where: {
      organizationId_userId: {
        organizationId,
        userId: req.auth.userId,
      },
    },
    include: {
      organization: {
        select: { id: true, name: true, slug: true, status: true },
      },
    },
  });

  if (
    !membership ||
    membership.status !== "ACTIVE" ||
    membership.organization.status !== "ACTIVE"
  ) {
    next(AppError.notFound("ORGANIZATION_NOT_FOUND", "The requested workspace was not found."));
    return;
  }

  req.tenant = {
    organizationId: membership.organizationId,
    membershipId: membership.id,
    role: membership.role,
    organization: membership.organization,
  };
  next();
};
