import type {
  PortalContentWithRelations,
  PortalProjectWithRelations,
} from "./portal.repository.js";

function dateOnly(value: Date | null): string | null {
  return value ? value.toISOString().slice(0, 10) : null;
}

export function presentPortalProject(project: PortalProjectWithRelations) {
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    status: project.status,
    startDate: dateOnly(project.startDate),
    deadline: dateOnly(project.deadline),
    client: project.client,
    visibleContentCount: project.contentItems.length,
    awaitingReviewCount: project.contentItems.filter((item) => item.status === "CLIENT_APPROVAL")
      .length,
    createdAt: project.createdAt.toISOString(),
  };
}

export function presentPortalAsset(asset: {
  id: string;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: Date;
}) {
  return {
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    createdAt: asset.createdAt.toISOString(),
  };
}

export function presentPortalReview(review: {
  id: string;
  decision: string;
  contentVersion: number;
  feedback: string | null;
  createdAt: Date;
  reviewer: { id: string; name: string; email: string } | null;
  asset: { id: string; originalFilename: string } | null;
}) {
  return {
    id: review.id,
    decision: review.decision,
    contentVersion: review.contentVersion,
    feedback: review.feedback,
    reviewer: review.reviewer,
    asset: review.asset,
    createdAt: review.createdAt.toISOString(),
  };
}

export function presentPortalContent(content: PortalContentWithRelations) {
  return {
    id: content.id,
    title: content.title,
    description: content.description,
    type: content.type,
    status: content.status,
    deadline: dateOnly(content.deadline),
    version: content.version,
    project: {
      id: content.project.id,
      name: content.project.name,
      client: content.project.client,
    },
    assets: content.assets.map(presentPortalAsset),
    reviews: content.reviews.map((review) =>
      presentPortalReview({
        ...review,
        reviewer: review.reviewer,
        asset: review.asset,
      }),
    ),
    updatedAt: content.updatedAt.toISOString(),
    createdAt: content.createdAt.toISOString(),
  };
}
