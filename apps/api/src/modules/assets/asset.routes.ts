import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateBody, validateParams, validateQuery } from "../../shared/validation.js";
import {
  getAssetById,
  getAssets,
  postAssetDownloadUrl,
  postCompleteUpload,
  postUploadIntent,
} from "./asset.controller.js";
import {
  assetListQuerySchema,
  assetParamsSchema,
  completeUploadSchema,
  createUploadIntentSchema,
} from "./asset.validation.js";

export const assetRouter = Router({ mergeParams: true });

assetRouter.get(
  "/",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateQuery(assetListQuerySchema),
  getAssets,
);

assetRouter.post(
  "/upload-intents",
  requirePermission(PERMISSIONS.ASSETS_UPLOAD),
  validateBody(createUploadIntentSchema),
  postUploadIntent,
);

assetRouter.post(
  "/complete",
  requirePermission(PERMISSIONS.ASSETS_UPLOAD),
  validateBody(completeUploadSchema),
  postCompleteUpload,
);

assetRouter.get(
  "/:assetId",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateParams(assetParamsSchema),
  getAssetById,
);

assetRouter.post(
  "/:assetId/download-url",
  requirePermission(PERMISSIONS.CONTENT_VIEW),
  validateParams(assetParamsSchema),
  postAssetDownloadUrl,
);
