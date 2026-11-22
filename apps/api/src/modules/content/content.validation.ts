import { CONTENT_STATUSES, CONTENT_TYPES } from "@studioos/shared";
import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const dateOnlySchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: "Enter a valid date.",
  });

const nullableDate = z.union([dateOnlySchema, z.null()]);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createContentSchema = z
  .object({
    title: z.string().trim().min(1, "Content title is required.").max(200),
    description: optionalText(20_000),
    type: z.enum(CONTENT_TYPES),
    deadline: dateOnlySchema.optional(),
    assigneeId: z.union([uuidSchema, z.null()]).optional(),
  })
  .strict();

export const updateContentSchema = z
  .object({
    title: z.string().trim().min(1, "Content title is required.").max(200).optional(),
    description: optionalText(20_000),
    type: z.enum(CONTENT_TYPES).optional(),
    deadline: nullableDate.optional(),
    assigneeId: z.union([uuidSchema, z.null()]).optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update.",
    path: ["title"],
  });

export const transitionContentSchema = z
  .object({
    toStatus: z.enum(CONTENT_STATUSES),
    expectedVersion: z.number().int().positive().optional(),
    note: z.string().trim().max(2_000).optional(),
  })
  .strict();

export const contentListQuerySchema = z.object({
  status: z.enum(CONTENT_STATUSES).optional(),
  type: z.enum(CONTENT_TYPES).optional(),
  projectId: uuidSchema.optional(),
  assigneeId: z.union([uuidSchema, z.literal("me")]).optional(),
  search: z.string().trim().max(120).optional(),
});

export const contentParamsSchema = z.object({
  contentId: uuidSchema,
});

export type CreateContentInput = z.infer<typeof createContentSchema>;
export type UpdateContentInput = z.infer<typeof updateContentSchema>;
export type TransitionContentInput = z.infer<typeof transitionContentSchema>;
export type ContentListQuery = z.infer<typeof contentListQuerySchema>;
