import { z } from "zod";
import { emailSchema, nameSchema, passwordSchema } from "../../shared/validation.js";

export const registerSchema = z
  .object({
    name: nameSchema,
    email: emailSchema,
    password: passwordSchema,
    organizationName: z
      .string()
      .trim()
      .min(2, "Workspace names must be at least 2 characters.")
      .max(160, "Workspace names must be 160 characters or fewer."),
  })
  .strict();

export const verifyEmailSchema = z
  .object({
    email: emailSchema,
    code: z
      .string()
      .trim()
      .regex(/^\d{6}$/, "Enter the 6-digit verification code."),
  })
  .strict();

export const resendVerificationSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const loginSchema = z
  .object({
    email: emailSchema,
    password: z.string().min(1).max(128),
  })
  .strict();

export const forgotPasswordSchema = z
  .object({
    email: emailSchema,
  })
  .strict();

export const resetPasswordSchema = z
  .object({
    token: z.string().min(20).max(256),
    password: passwordSchema,
  })
  .strict();

export type RegisterInput = z.infer<typeof registerSchema>;
export type VerifyEmailInput = z.infer<typeof verifyEmailSchema>;
export type ResendVerificationInput = z.infer<typeof resendVerificationSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;
