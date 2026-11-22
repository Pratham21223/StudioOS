import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";

export const notificationListQuerySchema = z.object({
  unread: z.enum(["true", "false"]).optional(),
  limit: z.coerce.number().int().min(1).max(100).optional(),
});

export const notificationParamsSchema = z.object({
  notificationId: uuidSchema,
});
