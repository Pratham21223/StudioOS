import type { ContentStatus, Prisma, ReviewDecision } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import type { DbClient } from "../users/user.repository.js";

const portalContentStatuses: ContentStatus[] = ["CLIENT_APPROVAL", "READY_TO_PUBLISH"];
const clientDecisions: ReviewDecision[] = ["CLIENT_APPROVED", "CLIENT_REVISION_REQUESTED"];

const portalContentInclude = {
  project: {
    select: {
      id: true,
      name: true,
      status: true,
      client: { select: { id: true, name: true } },
    },
  },
  assets: {
    select: {
      id: true,
      originalFilename: true,
      mimeType: true,
      sizeBytes: true,
      createdAt: true,
    },
    orderBy: { createdAt: "desc" as const },
  },
  reviews: {
    where: { decision: { in: clientDecisions } },
    select: {
      id: true,
      decision: true,
      contentVersion: true,
      feedback: true,
      createdAt: true,
      reviewer: { select: { id: true, name: true, email: true } },
      asset: { select: { id: true, originalFilename: true } },
    },
    orderBy: { createdAt: "asc" as const },
  },
} as const;

const portalProjectInclude = {
  client: { select: { id: true, name: true, status: true } },
  contentItems: {
    where: { status: { in: portalContentStatuses } },
    select: { id: true, status: true },
  },
} as const;

export const portalRepository = {
  listProjects(userId: string, db: DbClient = prisma) {
    return db.project.findMany({
      where: {
        client: {
          status: "ACTIVE",
          memberships: { some: { userId, status: "ACTIVE" } },
        },
        organization: { status: "ACTIVE" },
      },
      include: portalProjectInclude,
      orderBy: [{ deadline: { sort: "asc", nulls: "last" } }, { createdAt: "desc" }],
    });
  },

  findProject(userId: string, projectId: string, db: DbClient = prisma) {
    return db.project.findFirst({
      where: {
        id: projectId,
        client: {
          status: "ACTIVE",
          memberships: { some: { userId, status: "ACTIVE" } },
        },
        organization: { status: "ACTIVE" },
      },
      include: portalProjectInclude,
    });
  },

  listVisibleContent(projectId: string, db: DbClient = prisma) {
    return db.contentItem.findMany({
      where: { projectId, status: { in: portalContentStatuses } },
      include: portalContentInclude,
      orderBy: [{ updatedAt: "desc" }],
    });
  },

  findVisibleContent(userId: string, contentId: string, db: DbClient = prisma) {
    return db.contentItem.findFirst({
      where: {
        id: contentId,
        status: { in: portalContentStatuses },
        project: {
          client: {
            status: "ACTIVE",
            memberships: { some: { userId, status: "ACTIVE" } },
          },
          organization: { status: "ACTIVE" },
        },
      },
      include: portalContentInclude,
    });
  },

  findPortalAsset(userId: string, assetId: string, db: DbClient = prisma) {
    return db.asset.findFirst({
      where: {
        id: assetId,
        contentItem: {
          status: { in: portalContentStatuses },
          project: {
            client: {
              status: "ACTIVE",
              memberships: { some: { userId, status: "ACTIVE" } },
            },
            organization: { status: "ACTIVE" },
          },
        },
      },
      select: {
        id: true,
        originalFilename: true,
        mimeType: true,
        storageKey: true,
      },
    });
  },
};

export type PortalContentWithRelations = Prisma.ContentItemGetPayload<{
  include: typeof portalContentInclude;
}>;

export type PortalProjectWithRelations = Prisma.ProjectGetPayload<{
  include: typeof portalProjectInclude;
}>;
