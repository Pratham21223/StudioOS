import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date in YYYY-MM-DD format.")
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00.000Z`)), {
    message: "Enter a valid date.",
  });

const nullableDate = z.union([dateString, z.null()]);

export const createProjectSchema = z
  .object({
    clientId: uuidSchema,
    name: z.string().trim().min(1, "Project name is required.").max(160),
    description: z.string().trim().max(10_000).optional(),
    startDate: dateString.optional(),
    deadline: dateString.optional(),
  })
  .strict();

export const updateProjectSchema = z
  .object({
    clientId: uuidSchema.optional(),
    name: z.string().trim().min(1, "Project name is required.").max(160).optional(),
    description: z.string().trim().max(10_000).optional(),
    status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
    startDate: nullableDate.optional(),
    deadline: nullableDate.optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update.",
    path: ["name"],
  });

export const projectListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "PAUSED", "COMPLETED"]).optional(),
  clientId: uuidSchema.optional(),
  search: z.string().trim().max(100).optional(),
});

export const projectParamsSchema = z.object({
  projectId: uuidSchema,
});

export const projectMemberParamsSchema = z.object({
  projectId: uuidSchema,
  userId: uuidSchema,
});

export const assignProjectMembersSchema = z
  .object({
    userIds: z
      .array(uuidSchema)
      .min(1, "Select at least one team member.")
      .max(100)
      .refine((values) => new Set(values).size === values.length, {
        message: "Duplicate user ids are not allowed.",
      }),
  })
  .strict();

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type ProjectListQuery = z.infer<typeof projectListQuerySchema>;
export type AssignProjectMembersInput = z.infer<typeof assignProjectMembersSchema>;
