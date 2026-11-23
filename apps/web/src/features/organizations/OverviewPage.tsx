import { useEffect, useState, type ReactNode } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Bell,
  Clapperboard,
  Clock3,
  FolderKanban,
  ListChecks,
  MailPlus,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  CONTENT_STATUS_LABELS,
  ORG_ROLE_DESCRIPTIONS,
  PERMISSIONS,
  hasPermission,
} from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import { Alert, Badge, Card, EmptyState, Spinner } from "../../components/ui";
import { ContentStatusBadge, TaskPriorityBadge, TaskStatusBadge } from "../../components/status";
import { api, getErrorMessage } from "../../lib/api";
import type { Dashboard } from "../../lib/types";
import { cn, firstName, formatDate, greet, roleLabel } from "../../lib/utils";
import { useActiveMembership } from "./useActiveMembership";

type DashboardResponse = { dashboard: Dashboard };

function isOverdue(date: string | null): boolean {
  if (!date) return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${date}T00:00:00.000Z`).getTime() < today.getTime();
}

export function OverviewPage() {
  const { user } = useAuth();
  const membership = useActiveMembership();
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const organizationId = membership?.organization.id;

  const canInvite = membership ? hasPermission(membership.role, PERMISSIONS.MEMBERS_INVITE) : false;
  const canManageProjects = membership
    ? hasPermission(membership.role, PERMISSIONS.PROJECTS_MANAGE)
    : false;
  const canViewContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;

  useEffect(() => {
    if (!organizationId) return;
    let active = true;
    setLoading(true);
    setError(null);

    api
      .get<DashboardResponse>(`/organizations/${organizationId}/dashboard`)
      .then((response) => {
        if (active) setDashboard(response.dashboard);
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
  }, [organizationId]);

  if (!user || !membership) return null;

  return (
    <div className="space-y-7">
      <section className="studio-grid relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-7 text-cream-50 shadow-card sm:px-8 sm:py-9">
        <div className="studio-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <Badge tone="accent" className="border-accent-400/20 bg-accent-500/10 text-accent-400">
              Production control center
            </Badge>
            <div className="space-y-2">
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
                {greet()}, {firstName(user.name)}.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-ink-300">
                Your production pipeline, deadlines, approvals, and files in one workspace.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            {canInvite ? (
              <Link
                to={`/orgs/${membership.organization.id}/members`}
                className="inline-flex items-center gap-2 rounded-lg bg-accent-500 px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-accent-600"
              >
                <MailPlus className="size-4" aria-hidden="true" />
                Invite teammate
              </Link>
            ) : null}
            {canViewContent ? (
              <Link
                to={`/orgs/${membership.organization.id}/content`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-cream-100 transition hover:bg-white/10"
              >
                <Clapperboard className="size-4" aria-hidden="true" />
                Content board
              </Link>
            ) : null}
            {canManageProjects ? (
              <Link
                to={`/orgs/${membership.organization.id}/projects?new=1`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-cream-100 transition hover:bg-white/10"
              >
                <FolderKanban className="size-4" aria-hidden="true" />
                New project
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <Alert
          tone="error"
          action={
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="text-sm font-medium underline underline-offset-2"
            >
              Reload
            </button>
          }
        >
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading dashboard…
        </div>
      ) : !dashboard ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title="Dashboard unavailable"
            description="Refresh the page to load your workspace metrics."
          />
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-5">
            <StatCard
              label="Active projects"
              value={dashboard.counts.activeProjects}
              icon={<FolderKanban className="size-4" />}
            />
            <StatCard
              label="Active content"
              value={dashboard.counts.activeContent}
              icon={<Clapperboard className="size-4" />}
            />
            <StatCard
              label="Awaiting approval"
              value={dashboard.counts.awaitingApproval}
              icon={<Clock3 className="size-4" />}
            />
            <StatCard
              label={dashboard.scope === "ORGANIZATION" ? "Open tasks" : "My open tasks"}
              value={dashboard.counts.openTasks}
              icon={<ListChecks className="size-4" />}
            />
            <StatCard
              label="Overdue"
              value={dashboard.counts.overdueTasks}
              icon={<TriangleAlert className="size-4" />}
              tone={dashboard.counts.overdueTasks > 0 ? "danger" : "neutral"}
            />
          </div>

          <Card className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="font-display text-xl tracking-tight text-ink-900">
                  Content pipeline
                </h2>
                <p className="text-xs text-ink-500">
                  {dashboard.scope === "ORGANIZATION"
                    ? "Across every project in the workspace"
                    : "Across projects assigned to you"}
                </p>
              </div>
              <Link
                to={`/orgs/${membership.organization.id}/content`}
                className="inline-flex items-center gap-1 text-xs font-medium text-accent-600 hover:text-accent-700"
              >
                Open board <ArrowRight className="size-3.5" />
              </Link>
            </div>
            <div className="mt-4 flex h-3 overflow-hidden rounded-full bg-cream-100">
              {dashboard.contentByStatus.map((entry) =>
                entry.count > 0 ? (
                  <div
                    key={entry.status}
                    title={`${CONTENT_STATUS_LABELS[entry.status]}: ${entry.count}`}
                    className={cn(
                      "h-full border-r border-white/40 last:border-r-0",
                      entry.status === "READY_TO_PUBLISH"
                        ? "bg-moss-500"
                        : entry.status === "CLIENT_APPROVAL"
                          ? "bg-rust-500"
                          : entry.status === "BRIEF"
                            ? "bg-cream-300"
                            : "bg-accent-500/70",
                    )}
                    style={{
                      width: `${
                        (entry.count /
                          Math.max(
                            1,
                            dashboard.contentByStatus.reduce((sum, item) => sum + item.count, 0),
                          )) *
                        100
                      }%`,
                    }}
                  />
                ) : null,
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5">
              {dashboard.contentByStatus.map((entry) => (
                <span key={entry.status} className="flex items-center gap-1.5 text-[11px]">
                  <ContentStatusBadge status={entry.status} />
                  <span className="font-semibold text-ink-700">{entry.count}</span>
                </span>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl tracking-tight text-ink-900">
                    {dashboard.scope === "ORGANIZATION" ? "Open tasks" : "My tasks"}
                  </h2>
                  <p className="text-xs text-ink-500">
                    {dashboard.scope === "ORGANIZATION"
                      ? "Open work across the workspace"
                      : "Open work assigned to you"}
                  </p>
                </div>
                <Link
                  to={`/orgs/${membership.organization.id}/tasks`}
                  className="text-xs font-medium text-accent-600 hover:text-accent-700"
                >
                  Task board
                </Link>
              </div>
              {dashboard.openTasks.length === 0 ? (
                <EmptyState
                  icon={<ListChecks className="size-5" />}
                  title="No open tasks"
                  description={
                    dashboard.scope === "ORGANIZATION"
                      ? "Every task in the workspace is done."
                      : "Nothing is assigned to you right now."
                  }
                />
              ) : (
                <ul className="divide-y divide-cream-200">
                  {dashboard.openTasks.map((task) => (
                    <li key={task.id} className="px-5 py-3.5">
                      <div className="flex items-start justify-between gap-2">
                        <Link
                          to={`/orgs/${membership.organization.id}/tasks?projectId=${task.project.id}`}
                          className="text-sm font-medium text-ink-900 hover:text-accent-600"
                        >
                          {task.title}
                        </Link>
                        <TaskPriorityBadge priority={task.priority} />
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500">
                        <span>{task.project.name}</span>
                        {dashboard.scope === "ORGANIZATION" && task.assignee ? (
                          <span>{task.assignee.name}</span>
                        ) : null}
                        <TaskStatusBadge status={task.status} />
                        {task.dueDate ? (
                          <span
                            className={isOverdue(task.dueDate) ? "font-semibold text-rust-700" : ""}
                          >
                            {isOverdue(task.dueDate) ? "Overdue " : "Due "}
                            {formatDate(task.dueDate)}
                          </span>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl tracking-tight text-ink-900">
                    Awaiting client approval
                  </h2>
                  <p className="text-xs text-ink-500">Deliverables submitted to clients</p>
                </div>
                <Badge tone={dashboard.counts.awaitingApproval > 0 ? "danger" : "neutral"}>
                  {dashboard.counts.awaitingApproval}
                </Badge>
              </div>
              {dashboard.awaitingApproval.length === 0 ? (
                <EmptyState
                  icon={<ShieldCheck className="size-5" />}
                  title="Nothing waiting on clients"
                  description="Submitted deliverables will appear here until they are approved or revised."
                />
              ) : (
                <ul className="divide-y divide-cream-200">
                  {dashboard.awaitingApproval.map((item) => (
                    <li key={item.id}>
                      <Link
                        to={`/orgs/${membership.organization.id}/content/${item.id}`}
                        className="flex items-center justify-between gap-3 px-5 py-3.5 transition hover:bg-cream-50"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-ink-900">{item.title}</p>
                          <p className="text-[11px] text-ink-500">
                            {item.project.name} · v{item.version}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          <ContentStatusBadge status="CLIENT_APPROVAL" />
                          <ArrowRight className="size-3.5 text-ink-400" />
                        </div>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="overflow-hidden">
              <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
                <div>
                  <h2 className="font-display text-xl tracking-tight text-ink-900">Overdue work</h2>
                  <p className="text-xs text-ink-500">
                    {dashboard.scope === "ORGANIZATION"
                      ? "Every overdue task in the workspace"
                      : "Your overdue tasks"}
                  </p>
                </div>
                <Badge tone={dashboard.counts.overdueTasks > 0 ? "danger" : "neutral"}>
                  {dashboard.counts.overdueTasks}
                </Badge>
              </div>
              {dashboard.overdueTasks.length === 0 ? (
                <EmptyState
                  icon={<TriangleAlert className="size-5" />}
                  title="Nothing overdue"
                  description="Deadlines are under control."
                />
              ) : (
                <ul className="divide-y divide-cream-200">
                  {dashboard.overdueTasks.map((task) => (
                    <li key={task.id} className="flex items-center gap-3 px-5 py-3.5">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-rust-100 text-rust-700">
                        <TriangleAlert className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-ink-900">{task.title}</p>
                        <p className="text-[11px] text-ink-500">
                          {task.project.name}
                          {task.assignee ? ` · ${task.assignee.name}` : ""} · due{" "}
                          {task.dueDate ? formatDate(task.dueDate) : "—"}
                        </p>
                      </div>
                      <TaskPriorityBadge priority={task.priority} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card className="p-5">
              <h2 className="font-display text-xl tracking-tight text-ink-900">Project progress</h2>
              <p className="text-xs text-ink-500">Content and task volume by project</p>
              {dashboard.projects.length === 0 ? (
                <p className="mt-4 text-sm text-ink-500">No projects yet.</p>
              ) : (
                <ul className="mt-4 space-y-3">
                  {dashboard.projects.map((project) => {
                    const total = project.contentByStatus.reduce(
                      (sum, entry) => sum + entry.count,
                      0,
                    );
                    const ready =
                      project.contentByStatus.find((entry) => entry.status === "READY_TO_PUBLISH")
                        ?.count ?? 0;
                    return (
                      <li key={project.id} className="rounded-lg border border-cream-200 p-3">
                        <div className="flex items-center justify-between gap-2">
                          <Link
                            to={`/orgs/${membership.organization.id}/projects/${project.id}`}
                            className="truncate text-sm font-medium text-ink-900 hover:text-accent-600"
                          >
                            {project.name}
                          </Link>
                          <span className="shrink-0 text-[10px] text-ink-400">
                            {project.client.name}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px] text-ink-500">
                          <span>
                            {total} content · {project.taskCount} tasks
                          </span>
                          <span>{ready} ready</span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-cream-100">
                          <div
                            className="h-full rounded-full bg-moss-500"
                            style={{ width: `${total > 0 ? (ready / total) * 100 : 0}%` }}
                          />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          <Card className="p-5">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3">
                <span className="grid size-9 place-items-center rounded-lg bg-moss-100 text-moss-500">
                  <ShieldCheck className="size-4" aria-hidden="true" />
                </span>
                <div>
                  <p className="text-sm font-medium text-ink-900">
                    {roleLabel(membership.role)} access
                  </p>
                  <p className="text-xs text-ink-500">{ORG_ROLE_DESCRIPTIONS[membership.role]}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  to="/notifications"
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-cream-100"
                >
                  <Bell className="size-3.5" aria-hidden="true" />
                  {dashboard.counts.unreadNotifications} unread
                </Link>
                <Link
                  to={`/orgs/${membership.organization.id}/tasks?overdue=1`}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-cream-100"
                >
                  <Clock3 className="size-3.5" aria-hidden="true" />
                  Overdue view
                </Link>
              </div>
            </div>
          </Card>
        </>
      )}
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
          {label}
        </p>
        <span
          className={cn(
            "grid size-7 place-items-center rounded-lg",
            tone === "danger" ? "bg-rust-100 text-rust-700" : "bg-cream-100 text-ink-500",
          )}
        >
          {icon}
        </span>
      </div>
      <p
        className={cn(
          "mt-2 font-display text-3xl tracking-tight",
          tone === "danger" ? "text-rust-700" : "text-ink-900",
        )}
      >
        {value}
      </p>
    </Card>
  );
}
