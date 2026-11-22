import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateQuery } from "../../shared/validation.js";
import { getReviews } from "./review.controller.js";
import { reviewListQuerySchema } from "./review.validation.js";

export const reviewRouter = Router({ mergeParams: true });

reviewRouter.get(
  "/",
  requirePermission(PERMISSIONS.REVIEWS_INTERNAL),
  validateQuery(reviewListQuerySchema),
  getReviews,
);
