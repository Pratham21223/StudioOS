import type { Prisma, ReviewDecision } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const reviewInclude = {
  reviewer: true,
  asset: {
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
    },
  },
  contentItem: {
    select: {
      id: true,
      title: true,
      status: true,
      project: { select: { id: true, name: true } },
    },
  },
} as const;

export const reviewRepository = {
  listForContent(organizationId: string, contentItemId: string, db: DbClient = prisma) {
    return db.review.findMany({
      where: { organizationId, contentItemId },
      include: reviewInclude,
      orderBy: { createdAt: "asc" },
    });
  },

  listForOrganization(
    organizationId: string,
    filters: { decision?: ReviewDecision; projectId?: string; limit: number },
    scope: { viewAll: boolean; userId: string },
    db: DbClient = prisma,
  ) {
    return db.review.findMany({
      where: {
        organizationId,
        ...(filters.decision ? { decision: filters.decision } : {}),
        ...(filters.projectId ? { contentItem: { projectId: filters.projectId } } : {}),
        ...(scope.viewAll
          ? {}
          : {
              contentItem: {
                project: { memberships: { some: { userId: scope.userId } } },
              },
            }),
      },
      include: reviewInclude,
      orderBy: { createdAt: "desc" },
      take: filters.limit,
    });
  },

  create(
    data: {
      organizationId: string;
      contentItemId: string;
      reviewerId: string;
      assetId?: string | null;
      decision: ReviewDecision;
      contentVersion: number;
      feedback?: string | null;
    },
    db: DbClient = prisma,
  ) {
    return db.review.create({ data, include: reviewInclude });
  },

  findAssetForContent(
    assetId: string,
    organizationId: string,
    contentItemId: string,
    db: DbClient = prisma,
  ) {
    return db.asset.findFirst({
      where: { id: assetId, organizationId, contentItemId },
      select: { id: true, originalFilename: true },
    });
  },
};

export type ReviewWithRelations = Prisma.ReviewGetPayload<{
  include: typeof reviewInclude;
}>;
