import { z } from "zod";
import type { RequestHandler } from "express";
import type { ZodType } from "zod";
import { AppError, type ErrorDetail } from "./errors.js";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(320)
  .email("Enter a valid email address.");

export const passwordSchema = z
  .string()
  .min(12, "Use at least 12 characters.")
  .max(128, "Use no more than 128 characters.");

export const nameSchema = z.string().trim().min(1, "This field is required.").max(120);

export const uuidSchema = z.string().uuid("Invalid identifier.");

function toDetails(error: z.ZodError): ErrorDetail[] {
  return error.issues.map((issue) => ({
    path: issue.path.join(".") || "(root)",
    message: issue.message,
  }));
}

export function validateBody(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.body);
    if (!result.success) {
      next(
        AppError.badRequest(
          "VALIDATION_ERROR",
          "The request data is invalid.",
          toDetails(result.error),
        ),
      );
      return;
    }
    req.body = result.data;
    next();
  };
}

export function validateParams(schema: ZodType): RequestHandler {
  return (req, _res, next) => {
    const result = schema.safeParse(req.params);
    if (!result.success) {
      next(
        AppError.badRequest(
          "VALIDATION_ERROR",
          "The request parameters are invalid.",
          toDetails(result.error),
        ),
      );
      return;
    }
    req.params = Object.assign(
      req.params,
      result.data as Record<string, string>,
    ) as typeof req.params;
    next();
  };
}
