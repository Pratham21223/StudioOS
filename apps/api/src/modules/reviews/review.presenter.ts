import { presentUser } from "../../shared/presenters.js";
import type { ReviewWithRelations } from "./review.repository.js";

export function presentReview(review: ReviewWithRelations) {
  return {
    id: review.id,
    decision: review.decision,
    contentVersion: review.contentVersion,
    feedback: review.feedback,
    reviewer: review.reviewer ? presentUser(review.reviewer) : null,
    asset: review.asset
      ? {
          id: review.asset.id,
          originalFilename: review.asset.originalFilename,
          mimeType: review.asset.mimeType,
          sizeBytes: review.asset.sizeBytes,
        }
      : null,
    content: {
      id: review.contentItem.id,
      title: review.contentItem.title,
      status: review.contentItem.status,
    },
    project: {
      id: review.contentItem.project.id,
      name: review.contentItem.project.name,
    },
    createdAt: review.createdAt.toISOString(),
  };
}
