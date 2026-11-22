import type { RequestHandler } from "express";
import {
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  presentNotification,
} from "./notification.service.js";

export const getNotifications: RequestHandler = async (req, res) => {
  const query = res.locals.query as { unread?: string; limit?: number };
  const result = await listNotifications(req.auth!.userId, {
    unreadOnly: query.unread === "true",
    limit: query.limit,
  });
  res.status(200).json({
    notifications: result.notifications.map(presentNotification),
    unreadCount: result.unreadCount,
  });
};

export const patchNotificationRead: RequestHandler = async (req, res) => {
  const notification = await markNotificationRead(
    req.auth!.userId,
    req.params.notificationId as string,
  );
  res.status(200).json({ notification: presentNotification(notification) });
};

export const postNotificationsReadAll: RequestHandler = async (req, res) => {
  const result = await markAllNotificationsRead(req.auth!.userId);
  res.status(200).json(result);
};
