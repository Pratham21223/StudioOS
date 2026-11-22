import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requireClientPortalAccess } from "../../middleware/client-portal.js";
import { validateBody, validateParams } from "../../shared/validation.js";
import {
  getPortalContentById,
  getPortalProjectContent,
  getPortalProjects,
  postPortalApprove,
  postPortalDownloadUrl,
  postPortalRevision,
} from "./portal.controller.js";
import {
  portalAssetParamsSchema,
  portalContentParamsSchema,
  portalDecisionSchema,
  portalDownloadSchema,
  portalProjectParamsSchema,
  portalRevisionSchema,
} from "./portal.validation.js";

export const portalRouter = Router();

portalRouter.use(authenticate, requireClientPortalAccess);

portalRouter.get("/projects", getPortalProjects);

portalRouter.get(
  "/projects/:projectId/content-items",
  validateParams(portalProjectParamsSchema),
  getPortalProjectContent,
);

portalRouter.get(
  "/content-items/:contentId",
  validateParams(portalContentParamsSchema),
  getPortalContentById,
);

portalRouter.post(
  "/content-items/:contentId/approve",
  validateParams(portalContentParamsSchema),
  validateBody(portalDecisionSchema),
  postPortalApprove,
);

portalRouter.post(
  "/content-items/:contentId/request-revision",
  validateParams(portalContentParamsSchema),
  validateBody(portalRevisionSchema),
  postPortalRevision,
);

portalRouter.post(
  "/assets/:assetId/download-url",
  validateParams(portalAssetParamsSchema),
  validateBody(portalDownloadSchema),
  postPortalDownloadUrl,
);
