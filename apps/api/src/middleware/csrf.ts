import type { RequestHandler } from "express";
import { env } from "../config/env.js";
import { safeEqual } from "../shared/crypto.js";
import { AppError } from "../shared/errors.js";

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

export const csrfProtection: RequestHandler = (req, _res, next) => {
  if (SAFE_METHODS.has(req.method)) {
    next();
    return;
  }

  const cookieToken = req.cookies?.[env.CSRF_COOKIE_NAME];
  const headerToken = req.get("x-csrf-token");

  if (
    typeof cookieToken !== "string" ||
    typeof headerToken !== "string" ||
    cookieToken.length === 0 ||
    !safeEqual(cookieToken, headerToken)
  ) {
    next(
      new AppError(
        403,
        "CSRF_INVALID",
        "The request could not be verified. Refresh the page and try again.",
      ),
    );
    return;
  }

  next();
};
