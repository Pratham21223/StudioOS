import { beforeEach, describe, expect, it } from "vitest";
import { decryptPayload } from "../src/shared/crypto.js";
import { prisma } from "../src/infrastructure/database/prisma.js";
import { sendDeadlineReminders } from "../src/modules/notifications/deadline.service.js";
import type { EmailPayload } from "../src/modules/notifications/notification.service.js";
import {
  PASSWORD,
  addInternalMember,
  createApiClient,
  createClientRecord,
  createContentRecord,
  createProjectRecord,
  createTaskRecord,
  inviteClientContact,
  inviteMember,
  resetDatabase,
  setupOrganization,
  transitionContentRecord,
} from "./helpers.js";

function dateOffset(days: number): string {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

async function latestEmail(): Promise<EmailPayload & { id: string; ciphertext: string }> {
  const event = await prisma.outboxEvent.findFirstOrThrow({
    where: { type: "EMAIL" },
    orderBy: { createdAt: "desc" },
  });
  return {
    id: event.id,
    ciphertext: event.payloadCiphertext,
    ...decryptPayload<EmailPayload>(event.payloadCiphertext),
  };
}

describe("notifications, outbox email, and deadline reminders", () => {
  beforeEach(async () => {
    await resetDatabase();
  });

  it("creates assignment notifications and mark-read state", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Notify Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Notify Project",
    });
    const editor = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "editor@alpha.test",
      "EDITOR",
      "Elena Editor",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [editor.auth.user.id] },
    );

    const task = await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Notify the editor",
      assigneeId: editor.auth.user.id,
      priority: "URGENT",
      dueDate: dateOffset(1),
    });
    expect(task.assignee?.id).toBe(editor.auth.user.id);

    const inbox = await editor.client.get("/api/v1/notifications");
    expect(inbox.status).toBe(200);
    expect(inbox.body.unreadCount).toBe(1);
    expect(inbox.body.notifications[0].type).toBe("TASK_ASSIGNED");
    expect(inbox.body.notifications[0].title).toContain("Notify the editor");
    const notificationId = inbox.body.notifications[0].id as string;

    const unreadOnly = await editor.client.get("/api/v1/notifications?unread=true");
    expect(unreadOnly.body.notifications).toHaveLength(1);

    const email = await latestEmail();
    expect(email.to).toBe("editor@alpha.test");
    expect(email.subject).toContain("Notify the editor");
    expect(email.html).toContain("Notify the editor");
    expect(email.ciphertext).not.toContain("editor@alpha.test");
    expect(email.ciphertext).not.toContain("Notify the editor");

    const read = await editor.client.patch(`/api/v1/notifications/${notificationId}/read`);
    expect(read.status).toBe(200);
    expect(read.body.notification.readAt).not.toBeNull();
    const after = await editor.client.get("/api/v1/notifications");
    expect(after.body.unreadCount).toBe(0);

    const other = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "other@alpha.test",
      "PRODUCER",
      "Other Producer",
    );
    const cannotRead = await other.client.patch(`/api/v1/notifications/${notificationId}/read`);
    expect(cannotRead.status).toBe(404);

    await alpha.client.post(`/api/v1/organizations/${alpha.organization.id}/tasks`, {
      projectId: project.id,
      title: "Second assigned task",
      assigneeId: editor.auth.user.id,
    });
    const beforeAll = await editor.client.get("/api/v1/notifications");
    expect(beforeAll.body.unreadCount).toBe(1);
    const readAll = await editor.client.post("/api/v1/notifications/read-all");
    expect(readAll.status).toBe(200);
    expect(readAll.body.updated).toBe(1);
    const final = await editor.client.get("/api/v1/notifications");
    expect(final.body.unreadCount).toBe(0);
  });

  it("notifies review feedback, client submission, and client approval", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Notify Portal Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Notify Portal Project",
    });
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    const content = await createContentRecord(alpha.client, alpha.organization.id, project.id, {
      title: "Notification Deliverable",
    });
    await alpha.client.patch(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
      { assigneeId: producer.auth.user.id },
    );

    const feedback = await producer.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Please revise the mix." },
    );
    expect(feedback.status).toBe(201);

    const producerInbox = await producer.client.get("/api/v1/notifications");
    expect(
      producerInbox.body.notifications.some(
        (item: { type: string }) => item.type === "REVIEW_FEEDBACK",
      ),
    ).toBe(false);

    // The actor is excluded, so use an admin review to notify the producer.
    const adminFeedback = await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}/reviews`,
      { feedback: "Admin note for the producer." },
    );
    expect(adminFeedback.status).toBe(201);
    const afterAdminFeedback = await producer.client.get("/api/v1/notifications");
    expect(
      afterAdminFeedback.body.notifications.some(
        (item: { type: string }) => item.type === "REVIEW_FEEDBACK",
      ),
    ).toBe(true);

    const invite = await inviteClientContact(
      alpha.client,
      alpha.organization.id,
      client.id,
      "notify-portal@example.test",
    );
    const contact = await createApiClient();
    await contact.post("/api/v1/invitations/accept", {
      token: invite.token,
      name: "Notify Portal User",
      password: PASSWORD,
    });

    for (const status of [
      "SCRIPT",
      "SHOOT",
      "EDITING",
      "INTERNAL_REVIEW",
      "CLIENT_APPROVAL",
    ] as const) {
      expect(
        (await transitionContentRecord(alpha.client, alpha.organization.id, content.id, status))
          .status,
      ).toBe(200);
    }

    const clientInbox = await contact.get("/api/v1/notifications");
    expect(clientInbox.status).toBe(200);
    expect(
      clientInbox.body.notifications.some(
        (item: { type: string }) => item.type === "CONTENT_SUBMITTED",
      ),
    ).toBe(true);

    const contentState = await alpha.client.get(
      `/api/v1/organizations/${alpha.organization.id}/content-items/${content.id}`,
    );
    const approved = await contact.post(
      `/api/v1/client-portal/content-items/${content.id}/approve`,
      { expectedVersion: contentState.body.content.version },
    );
    expect(approved.status).toBe(200);

    const producerAfterApproval = await producer.client.get("/api/v1/notifications");
    expect(
      producerAfterApproval.body.notifications.some(
        (item: { type: string }) => item.type === "CONTENT_APPROVED",
      ),
    ).toBe(true);

    const email = await latestEmail();
    expect(email.to).toBe("producer@alpha.test");
  });

  it("queues encrypted invitation and password-reset emails", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const invite = await inviteMember(
      alpha.client,
      alpha.organization.id,
      "invited@example.test",
      "EDITOR",
    );
    expect(invite.response.status).toBe(201);

    const invitationEmail = await latestEmail();
    expect(invitationEmail.to).toBe("invited@example.test");
    expect(invitationEmail.text).toContain(invite.token);
    expect(invitationEmail.ciphertext).not.toContain(invite.token);

    const forgot = await alpha.client.post("/api/v1/auth/password/forgot", {
      email: "alpha@example.com",
    });
    expect(forgot.status).toBe(200);
    expect(forgot.body.resetUrl).toContain("token=");
    const resetEmail = await latestEmail();
    expect(resetEmail.to).toBe("alpha@example.com");
    expect(resetEmail.text).toContain("token=");
  });

  it("creates idempotent deadline reminders for upcoming tasks", async () => {
    const alpha = await setupOrganization("Alpha Studio", "alpha@example.com");
    const client = await createClientRecord(alpha.client, alpha.organization.id, {
      name: "Deadline Client",
    });
    const project = await createProjectRecord(alpha.client, alpha.organization.id, client.id, {
      name: "Deadline Project",
    });
    const producer = await addInternalMember(
      alpha.client,
      alpha.organization.id,
      "producer@alpha.test",
      "PRODUCER",
      "Noah Producer",
    );
    await alpha.client.post(
      `/api/v1/organizations/${alpha.organization.id}/projects/${project.id}/members`,
      { userIds: [producer.auth.user.id] },
    );
    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Due tomorrow",
      assigneeId: producer.auth.user.id,
      dueDate: dateOffset(1),
    });
    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Overdue reminder",
      assigneeId: producer.auth.user.id,
      dueDate: dateOffset(-2),
    });
    await createTaskRecord(alpha.client, alpha.organization.id, {
      projectId: project.id,
      title: "Done already",
      status: "DONE",
      assigneeId: producer.auth.user.id,
      dueDate: dateOffset(-2),
    });

    const first = await sendDeadlineReminders(new Date());
    expect(first.notified).toBe(2);

    const inbox = await producer.client.get("/api/v1/notifications");
    const reminders = inbox.body.notifications.filter(
      (item: { type: string }) => item.type === "DEADLINE_REMINDER",
    );
    expect(reminders).toHaveLength(2);
    expect(reminders.some((item: { title: string }) => item.title.includes("Overdue"))).toBe(true);

    const second = await sendDeadlineReminders(new Date());
    expect(second.notified).toBe(0);
    const count = await prisma.notification.count({
      where: { userId: producer.auth.user.id, type: "DEADLINE_REMINDER" },
    });
    expect(count).toBe(2);
  });
});
