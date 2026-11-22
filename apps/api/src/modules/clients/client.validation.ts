import { z } from "zod";
import { emailSchema, uuidSchema } from "../../shared/validation.js";

const optionalEmail = z.union([z.literal(""), emailSchema]).optional();
const optionalWebsite = z
  .union([z.literal(""), z.string().trim().url("Enter a valid URL.").max(255)])
  .optional();
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createClientSchema = z
  .object({
    name: z.string().trim().min(1, "Client name is required.").max(160),
    contactName: optionalText(120),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalWebsite,
    notes: optionalText(10_000),
    brandGuidelines: optionalText(20_000),
  })
  .strict();

export const updateClientSchema = z
  .object({
    name: z.string().trim().min(1, "Client name is required.").max(160).optional(),
    contactName: optionalText(120),
    email: optionalEmail,
    phone: optionalText(40),
    website: optionalWebsite,
    notes: optionalText(10_000),
    brandGuidelines: optionalText(20_000),
    status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update.",
    path: ["name"],
  });

export const clientListQuerySchema = z.object({
  status: z.enum(["ACTIVE", "ARCHIVED"]).optional(),
  search: z.string().trim().max(100).optional(),
});

export const clientParamsSchema = z.object({
  clientId: uuidSchema,
});

export const clientMembershipParamsSchema = z.object({
  clientId: uuidSchema,
  membershipId: uuidSchema,
});

export const updateClientMembershipSchema = z
  .object({
    status: z.enum(["ACTIVE", "DEACTIVATED"]),
  })
  .strict();

export type CreateClientInput = z.infer<typeof createClientSchema>;
export type UpdateClientInput = z.infer<typeof updateClientSchema>;
export type ClientListQuery = z.infer<typeof clientListQuerySchema>;
export type UpdateClientMembershipInput = z.infer<typeof updateClientMembershipSchema>;
