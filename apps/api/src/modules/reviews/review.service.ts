import { prisma } from "../../infrastructure/database/prisma.js";
import type { TenantContext } from "../../shared/context.js";
import { AppError } from "../../shared/errors.js";
import { recordAudit } from "../audit/audit.service.js";
import { contentRepository } from "../content/content.repository.js";
import {
  assertProjectOpen,
  canViewAllProjects,
  requireAccessibleProject,
} from "../projects/project-access.js";
import { notifyContentAudience } from "../notifications/notification.service.js";
import { reviewRepository } from "./review.repository.js";
import { presentReview } from "./review.presenter.js";
import type { CreateInternalReviewInput, ReviewListQuery } from "./review.validation.js";

function scopeFor(tenant: TenantContext) {
  return { viewAll: canViewAllProjects(tenant), userId: tenant.userId };
}

async function requireAccessibleContent(tenant: TenantContext, contentId: string) {
  const content = await contentRepository.findAccessible(
    contentId,
    tenant.organizationId,
    scopeFor(tenant),
  );
  if (!content) {
    throw AppError.notFound("CONTENT_NOT_FOUND", "The requested content item was not found.");
  }
  return content;
}

export async function listContentReviews(tenant: TenantContext, contentId: string) {
  await requireAccessibleContent(tenant, contentId);
  const reviews = await reviewRepository.listForContent(tenant.organizationId, contentId);
  return reviews.map(presentReview);
}

export async function listOrganizationReviews(tenant: TenantContext, query: ReviewListQuery) {
  if (query.projectId) {
    await requireAccessibleProject(tenant, query.projectId);
  }
  const reviews = await reviewRepository.listForOrganization(
    tenant.organizationId,
    { ...query, limit: query.limit ?? 50 },
    scopeFor(tenant),
  );
  return reviews.map(presentReview);
}

export async function createInternalReview(
  tenant: TenantContext,
  actorId: string,
  contentId: string,
  input: CreateInternalReviewInput,
) {
  return prisma.$transaction(async (tx) => {
    const content = await requireAccessibleContent(tenant, contentId);
    assertProjectOpen(content.project);

    if (input.assetId) {
      const asset = await reviewRepository.findAssetForContent(
        input.assetId,
        tenant.organizationId,
        contentId,
        tx,
      );
      if (!asset) {
        throw AppError.badRequest(
          "INVALID_REVIEW_ASSET",
          "The selected asset does not belong to this content item.",
          [{ path: "assetId", message: "Select an asset from this content item." }],
        );
      }
    }

    const review = await reviewRepository.create(
      {
        organizationId: tenant.organizationId,
        contentItemId: contentId,
        reviewerId: actorId,
        assetId: input.assetId ?? null,
        decision: "INTERNAL_FEEDBACK",
        contentVersion: content.version,
        feedback: input.feedback,
      },
      tx,
    );

    await recordAudit(tx, {
      organizationId: tenant.organizationId,
      actorId,
      action: "review.internal_feedback",
      resourceType: "review",
      resourceId: review.id,
      metadata: {
        contentItemId: contentId,
        contentVersion: content.version,
        assetId: input.assetId ?? null,
      },
    });

    await notifyContentAudience(tx, {
      organizationId: tenant.organizationId,
      contentItemId: contentId,
      projectId: content.projectId,
      type: "REVIEW_FEEDBACK",
      title: `New review feedback on ${content.title}`,
      body: input.feedback.slice(0, 500),
      excludeUserIds: [actorId],
    });

    return presentReview(review);
  });
}
