import { ORG_ROLES } from "@studioos/shared";
import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "../../shared/validation.js";

export const createInvitationSchema = z
  .object({
    email: emailSchema,
    role: z.enum(ORG_ROLES),
  })
  .strict();

export const createClientInvitationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const acceptInvitationSchema = z
  .object({
    token: z.string().min(20).max(256),
    name: nameSchema.optional(),
    password: passwordSchema.optional(),
  })
  .strict()
  .refine((data) => !data.name || data.password !== undefined, {
    message: "Provide both a name and a password to create an account.",
    path: ["password"],
  })
  .refine((data) => !data.password || data.name !== undefined, {
    message: "Provide both a name and a password to create an account.",
    path: ["name"],
  });

export const invitationTokenParamsSchema = z.object({
  token: z.string().min(20).max(256),
});

export type CreateInvitationInput = z.infer<typeof createInvitationSchema>;
export type CreateClientInvitationInput = z.infer<typeof createClientInvitationSchema>;
export type AcceptInvitationInput = z.infer<typeof acceptInvitationSchema>;
