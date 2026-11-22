import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const portalProjectParamsSchema = z.object({
  projectId: uuidSchema,
});

export const portalContentParamsSchema = z.object({
  contentId: uuidSchema,
});

export const portalAssetParamsSchema = z.object({
  assetId: uuidSchema,
});

export const portalDecisionSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    assetId: z.union([uuidSchema, z.null()]).optional(),
    feedback: z.string().trim().max(10_000).optional(),
  })
  .strict();

export const portalRevisionSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    assetId: z.union([uuidSchema, z.null()]).optional(),
    feedback: z
      .string()
      .trim()
      .min(1, "Explain what needs to change before requesting a revision.")
      .max(10_000),
  })
  .strict();

export const portalDownloadSchema = z
  .object({
    disposition: z.enum(["attachment", "inline"]).optional(),
  })
  .strict();

export type PortalDecisionInput = z.infer<typeof portalDecisionSchema>;
export type PortalRevisionInput = z.infer<typeof portalRevisionSchema>;
