import type { NotificationType, Prisma } from "@prisma/client";
import { prisma } from "../../infrastructure/database/prisma.js";
import { env } from "../../config/env.js";
import { encryptPayload } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import type { DbClient } from "../users/user.repository.js";

export type EmailPayload = {
  to: string;
  subject: string;
  text: string;
  replyTo?: string;
};

export async function queueEmail(
  db: DbClient,
  input: EmailPayload & { organizationId?: string | null },
) {
  return db.outboxEvent.create({
    data: {
      organizationId: input.organizationId ?? null,
      type: "EMAIL",
      payloadCiphertext: encryptPayload({
        to: input.to,
        subject: input.subject,
        text: input.text,
        ...(input.replyTo ? { replyTo: input.replyTo } : {}),
      } satisfies EmailPayload),
    },
  });
}

export async function createNotification(
  db: DbClient,
  input: {
    organizationId?: string | null;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    payload?: Prisma.InputJsonValue;
    dedupeKey?: string | null;
  },
) {
  try {
    return await db.notification.create({
      data: {
        organizationId: input.organizationId ?? null,
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        ...(input.payload ? { payload: input.payload } : {}),
        dedupeKey: input.dedupeKey ?? null,
      },
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return null;
    }
    throw error;
  }
}

export async function notifyUser(
  db: DbClient,
  input: {
    organizationId: string;
    userId: string;
    type: NotificationType;
    title: string;
    body?: string | null;
    payload?: Prisma.InputJsonValue;
    url?: string;
  },
) {
  const user = await db.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, status: true },
  });
  if (!user || user.status !== "ACTIVE") return null;

  const notification = await createNotification(db, {
    organizationId: input.organizationId,
    userId: input.userId,
    type: input.type,
    title: input.title,
    body: input.body ?? null,
    payload: input.payload,
  });
  if (!notification) return null;

  await queueEmail(db, {
    organizationId: input.organizationId,
    to: user.email,
    subject: input.title,
    text: [input.body, input.url ? `Open in StudioOS: ${input.url}` : null]
      .filter(Boolean)
      .join("\n\n"),
  });
  return notification;
}

export type NotifyAudienceInput = {
  organizationId: string;
  contentItemId: string;
  projectId: string;
  type: NotificationType;
  title: string;
  body?: string | null;
  excludeUserIds?: string[];
  includeClientContacts?: boolean;
  dedupePrefix?: string;
};

type AudienceUser = {
  id: string;
  name: string;
  email: string;
  active: boolean;
};

/**
 * Notify active project members and (optionally) the client contacts attached
 * to the project's client. In-app notifications and outbox emails are written
 * in the same transaction as the domain change.
 */
export async function notifyContentAudience(db: DbClient, input: NotifyAudienceInput) {
  const project = await db.project.findFirst({
    where: { id: input.projectId, organizationId: input.organizationId },
    select: {
      clientId: true,
      client: {
        select: {
          status: true,
          memberships: {
            where: { status: "ACTIVE" },
            select: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                },
              },
            },
          },
        },
      },
      memberships: {
        select: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              memberships: {
                where: { organizationId: input.organizationId, status: "ACTIVE" },
                select: { id: true },
              },
            },
          },
        },
      },
    },
  });
  if (!project) return [];

  const content = await db.contentItem.findFirst({
    where: { id: input.contentItemId, organizationId: input.organizationId },
    select: {
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          memberships: {
            where: { organizationId: input.organizationId, status: "ACTIVE" },
            select: { id: true },
          },
        },
      },
    },
  });

  const internal = new Map<string, AudienceUser>();
  for (const membership of project.memberships) {
    internal.set(membership.user.id, {
      id: membership.user.id,
      name: membership.user.name,
      email: membership.user.email,
      active: membership.user.memberships.length > 0,
    });
  }
  if (content?.assignee) {
    internal.set(content.assignee.id, {
      id: content.assignee.id,
      name: content.assignee.name,
      email: content.assignee.email,
      active: content.assignee.memberships.length > 0,
    });
  }

  const clientContacts = new Map<string, AudienceUser>();
  if (input.includeClientContacts && project.client.status === "ACTIVE") {
    for (const membership of project.client.memberships) {
      clientContacts.set(membership.user.id, {
        id: membership.user.id,
        name: membership.user.name,
        email: membership.user.email,
        active: true,
      });
    }
  }

  const excluded = new Set(input.excludeUserIds ?? []);
  const payload = {
    contentItemId: input.contentItemId,
    projectId: input.projectId,
  };
  const internalUrl = `${env.WEB_ORIGIN}/orgs/${input.organizationId}/content/${input.contentItemId}`;
  const portalUrl = `${env.WEB_ORIGIN}/portal/content/${input.contentItemId}`;
  const created: string[] = [];

  async function deliver(users: Map<string, AudienceUser>, url: string): Promise<void> {
    for (const user of users.values()) {
      if (!user.active || excluded.has(user.id)) continue;
      const notification = await createNotification(db, {
        organizationId: input.organizationId,
        userId: user.id,
        type: input.type,
        title: input.title,
        body: input.body ?? null,
        payload,
        dedupeKey: input.dedupePrefix ? `${input.dedupePrefix}:${user.id}` : null,
      });
      if (!notification) continue;
      created.push(notification.id);
      await queueEmail(db, {
        organizationId: input.organizationId,
        to: user.email,
        subject: input.title,
        text: [input.body, `Open in StudioOS: ${url}`].filter(Boolean).join("\n\n"),
      });
    }
  }

  await deliver(internal, internalUrl);
  await deliver(clientContacts, portalUrl);

  return created;
}

export async function listNotifications(
  userId: string,
  options: { unreadOnly?: boolean; limit?: number } = {},
) {
  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where: {
        userId,
        ...(options.unreadOnly ? { readAt: null } : {}),
      },
      orderBy: { createdAt: "desc" },
      take: Math.min(options.limit ?? 50, 100),
    }),
    prisma.notification.count({ where: { userId, readAt: null } }),
  ]);
  return { notifications, unreadCount };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });
  if (!notification) {
    throw AppError.notFound("NOTIFICATION_NOT_FOUND", "The requested notification was not found.");
  }
  if (notification.readAt) return notification;
  return prisma.notification.update({
    where: { id: notification.id },
    data: { readAt: new Date() },
  });
}

export async function markAllNotificationsRead(userId: string) {
  const result = await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  return { updated: result.count };
}

export function presentNotification(notification: {
  id: string;
  organizationId: string | null;
  type: NotificationType;
  title: string;
  body: string | null;
  payload: Prisma.JsonValue;
  readAt: Date | null;
  createdAt: Date;
}) {
  return {
    id: notification.id,
    organizationId: notification.organizationId,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    payload: notification.payload,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}
