import { prisma } from "../../infrastructure/database/prisma.js";
import { env } from "../../config/env.js";
import { storage } from "../../infrastructure/storage/s3.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { contentRepository } from "../content/content.repository.js";
import { notifyContentAudience } from "../notifications/notification.service.js";
import { reviewRepository } from "../reviews/review.repository.js";
import { portalRepository } from "./portal.repository.js";
import {
  presentPortalContent,
  presentPortalProject,
  presentPortalReview,
} from "./portal.presenter.js";
import type { PortalDecisionInput, PortalRevisionInput } from "./portal.validation.js";

export async function listPortalProjects(userId: string) {
  const projects = await portalRepository.listProjects(userId);
  return projects.map(presentPortalProject);
}

export async function listPortalProjectContent(userId: string, projectId: string) {
  const project = await portalRepository.findProject(userId, projectId);
  if (!project) {
    throw AppError.notFound("PORTAL_PROJECT_NOT_FOUND", "The requested project was not found.");
  }
  const content = await portalRepository.listVisibleContent(projectId);
  return {
    project: presentPortalProject(project),
    content: content.map(presentPortalContent),
  };
}

export async function getPortalContent(userId: string, contentId: string) {
  const content = await portalRepository.findVisibleContent(userId, contentId);
  if (!content) {
    throw AppError.notFound("PORTAL_CONTENT_NOT_FOUND", "The requested deliverable was not found.");
  }
  return presentPortalContent(content);
}

async function requirePortalContent(userId: string, contentId: string) {
  const content = await portalRepository.findVisibleContent(userId, contentId);
  if (!content) {
    throw AppError.notFound("PORTAL_CONTENT_NOT_FOUND", "The requested deliverable was not found.");
  }
  return content;
}

async function recordClientDecision(input: {
  userId: string;
  contentId: string;
  expectedVersion: number;
  feedback?: string | null;
  assetId?: string | null;
  decision: "CLIENT_APPROVED" | "CLIENT_REVISION_REQUESTED";
}) {
  const content = await requirePortalContent(input.userId, input.contentId);

  if (content.status !== "CLIENT_APPROVAL") {
    throw AppError.conflict(
      "CONTENT_NOT_AWAITING_APPROVAL",
      "This deliverable is not currently awaiting client approval.",
    );
  }
  if (content.version !== input.expectedVersion) {
    throw AppError.conflict(
      "CONTENT_STATE_CHANGED",
      "This deliverable changed since you opened it. Refresh and review the latest version.",
    );
  }
  if (input.assetId) {
    const asset = content.assets.find((item) => item.id === input.assetId);
    if (!asset) {
      throw AppError.badRequest(
        "INVALID_REVIEW_ASSET",
        "The selected file does not belong to this deliverable.",
      );
    }
  }

  const nextStatus = input.decision === "CLIENT_APPROVED" ? "READY_TO_PUBLISH" : "EDITING";

  return prisma.$transaction(async (tx) => {
    const updated = await contentRepository.applyTransition(
      content.id,
      content.status,
      content.version,
      nextStatus,
      tx,
    );
    if (updated.count !== 1) {
      throw AppError.conflict(
        "CONTENT_STATE_CHANGED",
        "This deliverable changed while you were deciding. Refresh and review the latest version.",
      );
    }

    const review = await reviewRepository.create(
      {
        organizationId: content.organizationId,
        contentItemId: content.id,
        reviewerId: input.userId,
        assetId: input.assetId ?? null,
        decision: input.decision,
        contentVersion: content.version,
        feedback: input.feedback ?? null,
      },
      tx,
    );

    const event = await contentRepository.createEvent(
      {
        organizationId: content.organizationId,
        contentItemId: content.id,
        actorId: input.userId,
        fromStatus: "CLIENT_APPROVAL",
        toStatus: nextStatus,
        note:
          input.feedback ??
          (input.decision === "CLIENT_APPROVED" ? "Approved by client." : "Revision requested."),
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: content.organizationId,
      actorId: input.userId,
      action:
        input.decision === "CLIENT_APPROVED"
          ? "content.client_approved"
          : "content.client_revision_requested",
      resourceType: "content_item",
      resourceId: content.id,
      metadata: {
        contentVersion: content.version,
        reviewId: review.id,
        assetId: input.assetId ?? null,
        ...(input.feedback ? { feedback: input.feedback.slice(0, 1_000) } : {}),
      },
    });

    await notifyContentAudience(tx, {
      organizationId: content.organizationId,
      contentItemId: content.id,
      projectId: content.projectId,
      type: input.decision === "CLIENT_APPROVED" ? "CONTENT_APPROVED" : "REVISION_REQUESTED",
      title:
        input.decision === "CLIENT_APPROVED"
          ? `Client approved ${content.title}`
          : `Revision requested on ${content.title}`,
      body:
        input.feedback ??
        (input.decision === "CLIENT_APPROVED"
          ? "The client approved this deliverable for publishing."
          : "The client requested changes."),
      excludeUserIds: [input.userId],
    });

    return {
      review: presentPortalReview(review),
      eventId: event.id,
      content: {
        id: content.id,
        status: nextStatus,
        version: content.version + 1,
      },
    };
  });
}

export async function approvePortalContent(
  userId: string,
  contentId: string,
  input: PortalDecisionInput,
) {
  return recordClientDecision({
    userId,
    contentId,
    expectedVersion: input.expectedVersion,
    feedback: input.feedback ?? null,
    assetId: input.assetId ?? null,
    decision: "CLIENT_APPROVED",
  });
}

export async function requestPortalRevision(
  userId: string,
  contentId: string,
  input: PortalRevisionInput,
) {
  return recordClientDecision({
    userId,
    contentId,
    expectedVersion: input.expectedVersion,
    feedback: input.feedback,
    assetId: input.assetId ?? null,
    decision: "CLIENT_REVISION_REQUESTED",
  });
}

export async function createPortalDownloadUrl(
  userId: string,
  assetId: string,
  disposition: "attachment" | "inline" = "attachment",
) {
  const asset = await portalRepository.findPortalAsset(userId, assetId);
  if (!asset) {
    throw AppError.notFound("ASSET_NOT_FOUND", "The requested file was not found.");
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
