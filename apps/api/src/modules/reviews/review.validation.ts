import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const createInternalReviewSchema = z
  .object({
    feedback: z.string().trim().min(1, "Add feedback before recording a review.").max(10_000),
    assetId: z.union([uuidSchema, z.null()]).optional(),
  })
  .strict();

export const reviewListQuerySchema = z.object({
  decision: z
    .enum(["INTERNAL_FEEDBACK", "CLIENT_APPROVED", "CLIENT_REVISION_REQUESTED"])
    .optional(),
  projectId: uuidSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const contentParamsSchema = z.object({
  contentId: uuidSchema,
});

export type CreateInternalReviewInput = z.infer<typeof createInternalReviewSchema>;
export type ReviewListQuery = z.infer<typeof reviewListQuerySchema>;
