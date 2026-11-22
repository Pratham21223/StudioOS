import { ORG_ROLES } from "@studioos/shared";
import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const membershipIdParamsSchema = z.object({
  membershipId: uuidSchema,
});

export const updateMembershipSchema = z
  .object({
    role: z.enum(ORG_ROLES).optional(),
    status: z.enum(["ACTIVE", "DEACTIVATED"]).optional(),
  })
  .strict()
  .refine((data) => data.role !== undefined || data.status !== undefined, {
    message: "Provide a role or a status to update.",
    path: ["role"],
  });

export type UpdateMembershipInput = z.infer<typeof updateMembershipSchema>;
