import { ALLOWED_ASSET_MIME_TYPES } from "@studioos/shared";
import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const createUploadIntentSchema = z
  .object({
    projectId: uuidSchema,
    contentItemId: z.union([uuidSchema, z.null()]).optional(),
    originalFilename: z
      .string()
      .trim()
      .min(1, "A filename is required.")
      .max(255)
      .refine(
        (value) =>
          !/[\\/]/.test(value) &&
          !Array.from(value).some((character) => character.charCodeAt(0) < 32),
        {
          message: "Filenames cannot contain path separators or control characters.",
        },
      ),
    mimeType: z.enum(ALLOWED_ASSET_MIME_TYPES),
    sizeBytes: z.number().int().positive(),
  })
  .strict();

export const completeUploadSchema = z
  .object({
    uploadId: uuidSchema,
  })
  .strict();

export const assetListQuerySchema = z.object({
  projectId: uuidSchema.optional(),
  contentItemId: uuidSchema.optional(),
  search: z.string().trim().max(120).optional(),
});

export const assetParamsSchema = z.object({
  assetId: uuidSchema,
});

export const assetDownloadSchema = z
  .object({
    disposition: z.enum(["attachment", "inline"]).optional(),
  })
  .strict();

export type CreateUploadIntentInput = z.infer<typeof createUploadIntentSchema>;
export type CompleteUploadInput = z.infer<typeof completeUploadSchema>;
export type AssetListQuery = z.infer<typeof assetListQuerySchema>;
