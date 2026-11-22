import { z } from "zod";

export const updateOrganizationSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, "Workspace names must be at least 2 characters.")
      .max(160, "Workspace names must be 160 characters or fewer."),
  })
  .strict();

export type UpdateOrganizationInput = z.infer<typeof updateOrganizationSchema>;
