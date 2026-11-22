import { presentUser } from "../../shared/presenters.js";
import type { AssetWithRelations } from "./asset.repository.js";

export function presentAsset(asset: AssetWithRelations) {
  return {
    id: asset.id,
    originalFilename: asset.originalFilename,
    mimeType: asset.mimeType,
    sizeBytes: asset.sizeBytes,
    project: {
      id: asset.project.id,
      name: asset.project.name,
      status: asset.project.status,
    },
    contentItem: asset.contentItem
      ? {
          id: asset.contentItem.id,
          title: asset.contentItem.title,
          status: asset.contentItem.status,
        }
      : null,
    uploadedBy: asset.uploadedBy ? presentUser(asset.uploadedBy) : null,
    createdAt: asset.createdAt.toISOString(),
  };
}
