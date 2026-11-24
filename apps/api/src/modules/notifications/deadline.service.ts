import { env } from "../../config/env.js";
import { prisma } from "../../infrastructure/database/prisma.js";
import { notificationEmail } from "../../infrastructure/email/templates.js";
import { createNotification, queueEmail } from "./notification.service.js";

function dateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

/**
 * Send one reminder per assignee/task/day for tasks due within 48 hours or
 * already overdue. Dedupe keys make repeated worker runs harmless.
 */
export async function sendDeadlineReminders(now = new Date()): Promise<{ notified: number }> {
  const horizon = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const tasks = await prisma.task.findMany({
    where: {
      status: { not: "DONE" },
      dueDate: { not: null, lte: horizon },
      assigneeId: { not: null },
      project: { status: { not: "COMPLETED" } },
    },
    select: {
      id: true,
      title: true,
      dueDate: true,
      organizationId: true,
      projectId: true,
      assignee: {
        select: {
          id: true,
          name: true,
          email: true,
          status: true,
          memberships: {
            where: { status: "ACTIVE" },
            select: { organizationId: true },
          },
        },
      },
    },
  });

  let notified = 0;
  for (const task of tasks) {
    const assignee = task.assignee;
    if (!assignee || !task.dueDate) continue;
    if (assignee.status !== "ACTIVE") continue;
    if (
      !assignee.memberships.some((membership) => membership.organizationId === task.organizationId)
    ) {
      continue;
    }

    const due = task.dueDate;
    const overdue = due.getTime() < new Date(now.toISOString().slice(0, 10)).getTime();
    const title = overdue ? `Overdue task: ${task.title}` : `Task due soon: ${task.title}`;
    const body = overdue
      ? `This task was due ${formatDate(due)}. Update it or mark it done.`
      : `This task is due ${formatDate(due)}.`;
    const dedupeKey = `deadline:${task.id}:${dateKey(now)}`;

    const created = await prisma.$transaction(async (tx) => {
      const notification = await createNotification(tx, {
        organizationId: task.organizationId,
        userId: assignee.id,
        type: "DEADLINE_REMINDER",
        title,
        body,
        payload: { taskId: task.id, projectId: task.projectId },
        dedupeKey,
      });
      if (!notification) return false;
      await queueEmail(tx, {
        organizationId: task.organizationId,
        to: assignee.email,
        ...notificationEmail({
          name: assignee.name,
          title,
          body,
          url: `${env.WEB_ORIGIN}/orgs/${task.organizationId}/tasks`,
        }),
      });
      return true;
    });

    if (created) notified += 1;
  }

  return { notified };
}
