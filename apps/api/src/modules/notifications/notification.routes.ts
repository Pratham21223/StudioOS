import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { validateParams, validateQuery } from "../../shared/validation.js";
import {
  getNotifications,
  patchNotificationRead,
  postNotificationsReadAll,
} from "./notification.controller.js";
import {
  notificationListQuerySchema,
  notificationParamsSchema,
} from "./notification.validation.js";

export const notificationRouter = Router();

notificationRouter.use(authenticate);

notificationRouter.get("/", validateQuery(notificationListQuerySchema), getNotifications);

notificationRouter.post("/read-all", postNotificationsReadAll);

notificationRouter.patch(
  "/:notificationId/read",
  validateParams(notificationParamsSchema),
  patchNotificationRead,
);
