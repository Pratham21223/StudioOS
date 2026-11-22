import { hasPermission, type Permission } from "@studioos/shared";
import type { RequestHandler } from "express";
import { AppError } from "../shared/errors.js";

export function requirePermission(permission: Permission): RequestHandler {
  return (req, _res, next) => {
    if (!req.tenant) {
      next(AppError.unauthorized());
      return;
    }

    if (!hasPermission(req.tenant.role, permission)) {
      next(
        AppError.forbidden(
          "FORBIDDEN",
          "Your role does not allow this action in the current workspace.",
        ),
      );
      return;
    }

    next();
  };
}
