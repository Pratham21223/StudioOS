import type { RequestHandler } from "express";
import { prisma } from "../infrastructure/database/prisma.js";
import { AppError } from "../shared/errors.js";

export const requireClientPortalAccess: RequestHandler = async (req, _res, next) => {
  if (!req.auth) {
    next(AppError.unauthorized());
    return;
  }

  const membership = await prisma.clientMembership.findFirst({
    where: {
      userId: req.auth.userId,
      status: "ACTIVE",
      client: { status: "ACTIVE" },
      organization: { status: "ACTIVE" },
    },
    select: { id: true },
  });

  if (!membership) {
    next(
      AppError.forbidden(
        "CLIENT_ACCESS_REQUIRED",
        "This area is only available to active client contacts.",
      ),
    );
    return;
  }

  next();
};
