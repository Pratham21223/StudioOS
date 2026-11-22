import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateBody, validateParams, validateQuery } from "../../shared/validation.js";
import {
  getContentById,
  getContentEvents,
  getContentItems,
  getProjectContent,
  patchContent,
  postContentTransition,
  postProjectContent,
} from "./content.controller.js";
import {
  contentListQuerySchema,
  contentParamsSchema,
  createContentSchema,
  transitionContentSchema,
  updateContentSchema,
} from "./content.validation.js";
import { projectParamsSchema } from "../projects/project.validation.js";

export const contentRouter = Router({ mergeParams: true });

contentRouter.get(
  "/",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateQuery(contentListQuerySchema),
  getContentItems,
);

contentRouter.get(
  "/:contentId",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateParams(contentParamsSchema),
  getContentById,
);

contentRouter.get(
  "/:contentId/events",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateParams(contentParamsSchema),
  getContentEvents,
);

contentRouter.patch(
  "/:contentId",
  requirePermission(PERMISSIONS.CONTENT_CREATE),
  validateParams(contentParamsSchema),
  validateBody(updateContentSchema),
  patchContent,
);

contentRouter.post(
  "/:contentId/transitions",
  requirePermission(PERMISSIONS.CONTENT_TRANSITION),
  validateParams(contentParamsSchema),
  validateBody(transitionContentSchema),
  postContentTransition,
);

export const projectContentRouter = Router({ mergeParams: true });

projectContentRouter.get(
  "/",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateParams(projectParamsSchema),
  validateQuery(contentListQuerySchema),
  getProjectContent,
);

projectContentRouter.post(
  "/",
  requirePermission(PERMISSIONS.CONTENT_CREATE),
  validateParams(projectParamsSchema),
  validateBody(createContentSchema),
  postProjectContent,
);
