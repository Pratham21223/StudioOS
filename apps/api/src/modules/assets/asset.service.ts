import { randomUUID } from "node:crypto";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { storage } from "../../infrastructure/storage/s3.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { contentRepository } from "../content/content.repository.js";
import {
  assertProjectOpen,
  canViewAllProjects,
  requireAccessibleProject,
} from "../projects/project-access.js";
import { assetRepository } from "./asset.repository.js";
import { presentAsset } from "./asset.presenter.js";
import type { AssetListQuery, CreateUploadIntentInput } from "./asset.validation.js";

function scopeFor(tenant: TenantContext) {
  return { viewAll: canViewAllProjects(tenant), userId: tenant.userId };
}

function safeFilename(filename: string): string {
  return (
    filename
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^[-.]+|[-.]+$/g, "")
      .slice(0, 180) || "upload"
  );
}

function baseMime(value: string | null): string {
  return (value ?? "").split(";")[0]!.trim().toLowerCase();
}

export async function listAssets(tenant: TenantContext, query: AssetListQuery) {
  if (query.projectId) {
    await requireAccessibleProject(tenant, query.projectId);
  }
  const assets = await assetRepository.list(tenant.organizationId, query, scopeFor(tenant));
  return assets.map(presentAsset);
}

export async function listContentAssets(tenant: TenantContext, contentId: string) {
  const content = await contentRepository.findAccessible(
    contentId,
    tenant.organizationId,
    scopeFor(tenant),
  );
  if (!content) {
    throw AppError.notFound("CONTENT_NOT_FOUND", "The requested content item was not found.");
  }
  const assets = await assetRepository.listForContent(tenant.organizationId, contentId);
  return assets.map(presentAsset);
}

export async function getAsset(tenant: TenantContext, assetId: string) {
  const asset = await assetRepository.findAccessible(
    assetId,
    tenant.organizationId,
    scopeFor(tenant),
  );
  if (!asset) {
    throw AppError.notFound("ASSET_NOT_FOUND", "The requested asset was not found.");
  }
  return presentAsset(asset);
}

export async function createUploadIntent(
  tenant: TenantContext,
  actorId: string,
  input: CreateUploadIntentInput,
) {
  if (!storage.isConfigured()) {
    throw new AppError(
      503,
      "STORAGE_UNAVAILABLE",
      "Object storage is not configured. Uploads are unavailable.",
    );
  }
  if (input.sizeBytes > env.ASSET_MAX_BYTES) {
    throw AppError.badRequest(
      "ASSET_TOO_LARGE",
      `Files must be ${Math.floor(env.ASSET_MAX_BYTES / (1024 * 1024))} MB or smaller.`,
      [{ path: "sizeBytes", message: "Reduce the file size and try again." }],
    );
  }

  const project = await requireAccessibleProject(tenant, input.projectId);
  assertProjectOpen(project);

  if (input.contentItemId) {
    const content = await assetRepository.findContentInProject(
      input.contentItemId,
      tenant.organizationId,
      input.projectId,
    );
    if (!content) {
      throw AppError.badRequest(
        "INVALID_ASSET_CONTENT",
        "The linked content item must belong to the same project.",
        [{ path: "contentItemId", message: "Select content from this project." }],
      );
    }
  }

  const storageKey = [
    tenant.organizationId,
    input.projectId,
    `${randomUUID()}-${safeFilename(input.originalFilename)}`,
  ].join("/");
  const expiresInSeconds = env.UPLOAD_URL_TTL_MINUTES * 60;
  const target = await storage.createUploadTarget({
    storageKey,
    contentType: input.mimeType,
    expiresInSeconds,
  });

  const upload = await prisma.$transaction(async (tx) => {
    const intent = await assetRepository.createIntent(
      {
        organizationId: tenant.organizationId,
        projectId: input.projectId,
        contentItemId: input.contentItemId ?? null,
        createdById: actorId,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
        storageKey,
        expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "asset.upload_intent_created",
      resourceType: "asset_upload",
      resourceId: intent.id,
      metadata: {
        projectId: input.projectId,
        contentItemId: input.contentItemId ?? null,
        originalFilename: input.originalFilename,
        mimeType: input.mimeType,
        sizeBytes: input.sizeBytes,
      },
    });

    return intent;
  });

  return {
    uploadId: upload.id,
    upload: {
      url: target.url,
      method: target.method,
      headers: target.headers,
      expiresAt: target.expiresAt,
    },
    originalFilename: upload.originalFilename,
    mimeType: upload.mimeType,
    sizeBytes: upload.sizeBytes,
    expiresAt: upload.expiresAt.toISOString(),
  };
}

export async function completeUpload(tenant: TenantContext, actorId: string, uploadId: string) {
  const intent = await assetRepository.findIntent(tenant.organizationId, uploadId);
  if (!intent) {
    throw AppError.notFound("UPLOAD_INTENT_NOT_FOUND", "The requested upload was not found.");
  }
  if (intent.createdById !== actorId) {
    throw AppError.notFound("UPLOAD_INTENT_NOT_FOUND", "The requested upload was not found.");
  }
  if (intent.completedAt) {
    throw AppError.conflict("UPLOAD_ALREADY_COMPLETED", "This upload has already been completed.");
  }
  if (intent.expiresAt.getTime() <= Date.now()) {
    throw new AppError(
      410,
      "UPLOAD_INTENT_EXPIRED",
      "This upload link has expired. Request a new upload.",
    );
  }

  await requireAccessibleProject(tenant, intent.projectId);

  const head = await storage.headObject(intent.storageKey);
  if (!head) {
    throw AppError.conflict(
      "UPLOAD_NOT_FOUND",
      "The uploaded file was not found in storage. Upload the file before confirming.",
    );
  }
  if (head.sizeBytes !== intent.sizeBytes) {
    throw AppError.badRequest(
      "UPLOAD_SIZE_MISMATCH",
      `Storage reports ${head.sizeBytes} bytes but ${intent.sizeBytes} were expected.`,
    );
  }
  if (head.contentType && baseMime(head.contentType) !== baseMime(intent.mimeType)) {
    throw AppError.badRequest(
      "UPLOAD_MIME_MISMATCH",
      `Storage reports ${head.contentType} but ${intent.mimeType} was expected.`,
    );
  }

  return prisma.$transaction(async (tx) => {
    const now = new Date();
    const claimed = await assetRepository.claimIntent(uploadId, now, tx);
    if (claimed.count !== 1) {
      throw AppError.conflict(
        "UPLOAD_ALREADY_COMPLETED",
        "This upload has already been completed or has expired.",
      );
    }

    const asset = await assetRepository.createAsset(
      {
        organizationId: tenant.organizationId,
        projectId: intent.projectId,
        contentItemId: intent.contentItemId,
        uploadedById: actorId,
        originalFilename: intent.originalFilename,
        mimeType: intent.mimeType,
        sizeBytes: intent.sizeBytes,
        storageKey: intent.storageKey,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "asset.uploaded",
      resourceType: "asset",
      resourceId: asset.id,
      metadata: {
        projectId: asset.projectId,
        contentItemId: asset.contentItemId,
        originalFilename: asset.originalFilename,
        mimeType: asset.mimeType,
        sizeBytes: asset.sizeBytes,
      },
    });

    return presentAsset(asset);
  });
}

export async function createAssetDownloadUrl(
  tenant: TenantContext,
  assetId: string,
  disposition: "attachment" | "inline" = "attachment",
) {
  const asset = await assetRepository.findAccessible(
    assetId,
    tenant.organizationId,
    scopeFor(tenant),
  );
  if (!asset) {
    throw AppError.notFound("ASSET_NOT_FOUND", "The requested asset was not found.");
  }

  const expiresInSeconds = env.DOWNLOAD_URL_TTL_MINUTES * 60;
  const url = await storage.createDownloadTarget({
    storageKey: asset.storageKey,
    filename: asset.originalFilename,
    mimeType: asset.mimeType,
    disposition,
    expiresInSeconds,
  });

  return {
    url,
    expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString(),
  };
}

export function canUploadAssets(tenant: TenantContext): boolean {
  return hasPermission(tenant.role, PERMISSIONS.ASSETS_UPLOAD);
}
