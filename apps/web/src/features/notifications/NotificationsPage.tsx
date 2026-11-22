import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  Bell,
  CheckCheck,
  Clapperboard,
  MessageSquare,
  ShieldCheck,
  TriangleAlert,
  UserPlus,
} from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Alert, Badge, Button, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { api, getErrorMessage } from "../../lib/api";
import type { Notification, NotificationType } from "../../lib/types";
import { formatDateTime } from "../../lib/utils";

type NotificationResponse = {
  notifications: Notification[];
  unreadCount: number;
};

const typeIcons: Record<NotificationType, typeof Bell> = {
  TASK_ASSIGNED: CheckCheck,
  CONTENT_ASSIGNED: Clapperboard,
  CONTENT_SUBMITTED: Clapperboard,
  REVIEW_FEEDBACK: MessageSquare,
  CONTENT_APPROVED: ShieldCheck,
  REVISION_REQUESTED: TriangleAlert,
  DEADLINE_REMINDER: Bell,
  INVITATION: UserPlus,
};

export function NotificationsPage() {
  const { memberships, clientMemberships } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [markingAll, setMarkingAll] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<NotificationResponse>("/notifications")
      .then((response) => {
        if (!active) return;
        setNotifications(response.notifications);
        setUnreadCount(response.unreadCount);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  function linkFor(notification: Notification): string | null {
    const payload = notification.payload ?? {};
    const contentItemId = typeof payload.contentItemId === "string" ? payload.contentItemId : null;
    const taskId = typeof payload.taskId === "string" ? payload.taskId : null;
    if (!notification.organizationId) return null;

    const internal = memberships.some(
      (membership) => membership.organization.id === notification.organizationId,
    );
    if (internal) {
      if (contentItemId) {
        return `/orgs/${notification.organizationId}/content/${contentItemId}`;
      }
      if (taskId) {
        return `/orgs/${notification.organizationId}/tasks`;
      }
      return `/orgs/${notification.organizationId}`;
    }

    const client = clientMemberships.some(
      (membership) => membership.organization.id === notification.organizationId,
    );
    if (client && contentItemId) {
      return `/portal/content/${contentItemId}`;
    }
    return null;
  }

  async function markRead(notification: Notification) {
    if (notification.readAt) return;
    setBusyId(notification.id);
    try {
      const response = await api.patch<{ notification: Notification }>(
        `/notifications/${notification.id}/read`,
      );
      setNotifications((current) =>
        current.map((item) =>
          item.id === response.notification.id ? response.notification : item,
        ),
      );
      setUnreadCount((count) => Math.max(0, count - 1));
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setBusyId(null);
    }
  }

  async function markAll() {
    setMarkingAll(true);
    setError(null);
    try {
      await api.post<{ updated: number }>("/notifications/read-all");
      const now = new Date().toISOString();
      setNotifications((current) =>
        current.map((item) => (item.readAt ? item : { ...item, readAt: now })),
      );
      setUnreadCount(0);
    } catch (requestError) {
      setError(getErrorMessage(requestError));
    } finally {
      setMarkingAll(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Inbox"
        title="Notifications"
        description="Assignments, review feedback, approvals, revisions, and deadline reminders."
        actions={
          unreadCount > 0 ? (
            <Button
              variant="secondary"
              onClick={() => void markAll()}
              loading={markingAll}
              icon={<CheckCheck className="size-4" />}
            >
              Mark all read
            </Button>
          ) : null
        }
      />

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading notifications…
        </div>
      ) : notifications.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Bell className="size-5" />}
            title="You're all caught up"
            description="New assignments, review decisions, and deadline reminders will appear here."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-cream-200">
            {notifications.map((notification) => {
              const Icon = typeIcons[notification.type];
              const href = linkFor(notification);
              return (
                <li
                  key={notification.id}
                  className={
                    notification.readAt
                      ? "flex gap-3 px-5 py-4"
                      : "flex gap-3 bg-accent-500/[0.035] px-5 py-4"
                  }
                >
                  <span
                    className={
                      notification.readAt
                        ? "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-400"
                        : "mt-0.5 grid size-9 shrink-0 place-items-center rounded-lg bg-accent-500/10 text-accent-600"
                    }
                  >
                    <Icon className="size-4" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      {href ? (
                        <Link
                          to={href}
                          onClick={() => void markRead(notification)}
                          className="text-sm font-medium text-ink-900 hover:text-accent-600"
                        >
                          {notification.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-medium text-ink-900">
                          {notification.title}
                        </span>
                      )}
                      {!notification.readAt ? <Badge tone="accent">New</Badge> : null}
                    </div>
                    {notification.body ? (
                      <p className="mt-1 text-xs leading-relaxed text-ink-500">
                        {notification.body}
                      </p>
                    ) : null}
                    <div className="mt-1.5 flex items-center gap-3">
                      <span className="text-[10px] text-ink-400">
                        {formatDateTime(notification.createdAt)}
                      </span>
                      {!notification.readAt ? (
                        <button
                          type="button"
                          onClick={() => void markRead(notification)}
                          disabled={busyId === notification.id}
                          className="text-[10px] font-medium text-accent-600 hover:text-accent-700 disabled:opacity-50"
                        >
                          Mark read
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
