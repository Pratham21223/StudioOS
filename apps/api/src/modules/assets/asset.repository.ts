import type { Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const assetInclude = {
  project: { select: { id: true, name: true, status: true } },
  contentItem: { select: { id: true, title: true, status: true } },
  uploadedBy: true,
} as const;

export const assetRepository = {
  list(
    organizationId: string,
    filters: { projectId?: string; contentItemId?: string; search?: string },
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.asset.findMany({
      where: {
        organizationId,
        ...(filters.projectId ? { projectId: filters.projectId } : {}),
        ...(filters.contentItemId ? { contentItemId: filters.contentItemId } : {}),
        ...(filters.search
          ? { originalFilename: { contains: filters.search, mode: "insensitive" as const } }
          : {}),
        ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
      },
      include: assetInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  findAccessible(
    assetId: string,
    organizationId: string,
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.asset.findFirst({
      where: {
        id: assetId,
        organizationId,
        ...(scope.viewAll ? {} : { project: { memberships: { some: { userId: scope.userId } } } }),
      },
      include: assetInclude,
    });
  },

  listForContent(organizationId: string, contentItemId: string, db: DbClient = prisma) {
    return db.asset.findMany({
      where: { organizationId, contentItemId },
      include: assetInclude,
      orderBy: { createdAt: "desc" },
    });
  },

  createIntent(
    data: {
      organizationId: string;
      projectId: string;
      contentItemId?: string | null;
      createdById: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
      expiresAt: Date;
    },
    db: DbClient = prisma,
  ) {
    return db.assetUpload.create({ data });
  },

  findIntent(organizationId: string, uploadId: string, db: DbClient = prisma) {
    return db.assetUpload.findFirst({
      where: { id: uploadId, organizationId },
    });
  },

  claimIntent(uploadId: string, now: Date, db: DbClient = prisma) {
    return db.assetUpload.updateMany({
      where: { id: uploadId, completedAt: null, expiresAt: { gt: now } },
      data: { completedAt: now },
    });
  },

  createAsset(
    data: {
      organizationId: string;
      projectId: string;
      contentItemId?: string | null;
      uploadedById: string;
      originalFilename: string;
      mimeType: string;
      sizeBytes: number;
      storageKey: string;
    },
    db: DbClient = prisma,
  ) {
    return db.asset.create({ data, include: assetInclude });
  },

  findContentInProject(
    contentItemId: string,
    organizationId: string,
    projectId: string,
    db: DbClient = prisma,
  ) {
    return db.contentItem.findFirst({
      where: { id: contentItemId, organizationId, projectId },
      select: { id: true, title: true },
    });
  },

  listForPortalContent(organizationId: string, contentItemId: string, db: DbClient = prisma) {
    return db.asset.findMany({
      where: { organizationId, contentItemId },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        sizeBytes: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    });
  },
};

export type AssetWithRelations = Prisma.AssetGetPayload<{
  include: typeof assetInclude;
}>;
