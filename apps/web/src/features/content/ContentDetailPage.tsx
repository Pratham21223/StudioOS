import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  CheckCircle2,
  Clapperboard,
  Clock3,
  FolderKanban,
  History,
  Save,
  ShieldAlert,
  Sparkles,
  UserRound,
} from "lucide-react";
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  CONTENT_TRANSITIONS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  PERMISSIONS,
  canPerformContentTransition,
  hasPermission,
} from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import {
  Alert,
  Avatar,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { ContentStatusBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type {
  ContentItem,
  ContentStatus,
  ContentType,
  ProjectMember,
  WorkflowEvent,
} from "../../lib/types";
import { cn, formatDate, formatDateTime } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ContentResponse = { content: ContentItem };
type EventResponse = { events: WorkflowEvent[] };
type ProjectMemberResponse = { members: ProjectMember[] };
type TransitionResponse = { content: ContentItem; event: WorkflowEvent };

const emptyForm = {
  title: "",
  description: "",
  type: "PODCAST" as ContentType,
  deadline: "",
  assigneeId: "",
};

function transitionLabel(from: ContentStatus, to: ContentStatus): string {
  if (to === "SCRIPT") return "Start scripting";
  if (to === "SHOOT") return "Move to shoot";
  if (to === "EDITING") {
    return from === "CLIENT_APPROVAL" ? "Request revision" : "Move to editing";
  }
  if (to === "INTERNAL_REVIEW") return "Submit for internal review";
  if (to === "CLIENT_APPROVAL") return "Send to client approval";
  if (to === "READY_TO_PUBLISH") return "Approve for publishing";
  return `Move to ${CONTENT_STATUS_LABELS[to]}`;
}

export function ContentDetailPage() {
  const { contentId = "" } = useParams<{ contentId: string }>();
  const { user } = useAuth();
  const membership = useActiveMembership();
  const organizationId = membership?.organization.id;
  const canViewContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;
  const canManageContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_CREATE)
    : false;
  const canTransition = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_TRANSITION)
    : false;

  const [content, setContent] = useState<ContentItem | null>(null);
  const [events, setEvents] = useState<WorkflowEvent[]>([]);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const [note, setNote] = useState("");
  const [transitioningTo, setTransitioningTo] = useState<ContentStatus | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !contentId || !canViewContent) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [contentResponse, eventResponse] = await Promise.all([
        api.get<ContentResponse>(`/organizations/${organizationId}/content-items/${contentId}`),
        api.get<EventResponse>(
          `/organizations/${organizationId}/content-items/${contentId}/events`,
        ),
      ]);
      setContent(contentResponse.content);
      setEvents(eventResponse.events);
      setForm({
        title: contentResponse.content.title,
        description: contentResponse.content.description ?? "",
        type: contentResponse.content.type,
        deadline: contentResponse.content.deadline ?? "",
        assigneeId: contentResponse.content.assignee?.id ?? "",
      });

      if (canManageContent) {
        const memberResponse = await api.get<ProjectMemberResponse>(
          `/organizations/${organizationId}/projects/${contentResponse.content.project.id}/members`,
        );
        setProjectMembers(memberResponse.members);
      }
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [organizationId, contentId, canViewContent, canManageContent]);

  useEffect(() => {
    void load();
  }, [load]);

  const stages = useMemo(() => {
    if (!content) return [];
    const currentIndex = CONTENT_STATUSES.indexOf(content.status);
    return CONTENT_STATUSES.map((status, index) => ({
      status,
      state: index < currentIndex ? "done" : index === currentIndex ? "current" : "upcoming",
    }));
  }, [content]);

  const availableTransitions = useMemo(() => {
    if (!content || !membership || !canTransition) return [];
    return CONTENT_TRANSITIONS[content.status].filter((to) =>
      canPerformContentTransition(membership.role, content.status, to),
    );
  }, [content, membership, canTransition]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !content) return;

    setSaving(true);
    setActionError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const response = await api.patch<ContentResponse>(
        `/organizations/${organizationId}/content-items/${content.id}`,
        {
          title: form.title,
          description: form.description,
          type: form.type,
          deadline: form.deadline ? form.deadline : null,
          assigneeId: form.assigneeId ? form.assigneeId : null,
        },
      );
      setContent(response.content);
      setForm((current) => ({
        ...current,
        title: response.content.title,
        description: response.content.description ?? "",
        type: response.content.type,
        deadline: response.content.deadline ?? "",
        assigneeId: response.content.assignee?.id ?? "",
      }));
      setNotice("Content details saved.");
    } catch (error) {
      setActionError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setSaving(false);
    }
  }

  async function moveTo(toStatus: ContentStatus) {
    if (!organizationId || !content) return;
    const requiresNote = content.status === "CLIENT_APPROVAL" && toStatus === "EDITING";
    if (requiresNote && !note.trim()) {
      setActionError("Add revision feedback before moving this content back to editing.");
      return;
    }
    if (
      toStatus === "READY_TO_PUBLISH" &&
      !window.confirm("Approve this version for publishing? This is the final workflow stage.")
    ) {
      return;
    }

    setTransitioningTo(toStatus);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.post<TransitionResponse>(
        `/organizations/${organizationId}/content-items/${content.id}/transitions`,
        {
          toStatus,
          expectedVersion: content.version,
          ...(note.trim() ? { note: note.trim() } : {}),
        },
      );
      setContent(response.content);
      setEvents((current) => [...current, response.event]);
      setNote("");
      setNotice(`Content moved to ${CONTENT_STATUS_LABELS[response.content.status]}.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setTransitioningTo(null);
    }
  }

  if (!membership || !user) return null;

  if (!canViewContent) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Content workflow" title="Content item" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Content is restricted"
            description="Your role doesn't include content access in this workspace."
          />
        </Card>
      </div>
    );
  }

  if (!loading && (loadError || !content)) {
    return (
      <div className="space-y-6">
        <Link
          to={`/orgs/${membership.organization.id}/content`}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
        >
          <ArrowLeft className="size-4" /> Back to content
        </Link>
        <Card>
          <EmptyState
            icon={<Clapperboard className="size-5" />}
            title="Content not available"
            description={
              loadError ??
              "This content item could not be found, or you don't have access to its project."
            }
            action={
              <Button variant="secondary" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        </Card>
      </div>
    );
  }

  if (loading || !content) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner /> Loading content…
      </div>
    );
  }

  const projectCompleted = content.project.status === "COMPLETED";
  const requiresNote = content.status === "CLIENT_APPROVAL";
  const assigneeOptions = [...projectMembers];
  if (
    content.assignee &&
    !projectMembers.some((member) => member.user.id === content.assignee!.id)
  ) {
    assigneeOptions.push({
      id: `current-${content.assignee.id}`,
      createdAt: content.assignee.createdAt,
      user: content.assignee,
    });
  }

  return (
    <div className="space-y-6">
      <Link
        to={`/orgs/${membership.organization.id}/content`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to content board
      </Link>

      <PageHeader
        eyebrow={CONTENT_TYPE_LABELS[content.type]}
        title={content.title}
        description={`${content.project.name} · ${content.project.client.name}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone="neutral">v{content.version}</Badge>
            <ContentStatusBadge status={content.status} />
          </div>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {projectCompleted ? (
        <Alert tone="warning">
          This project is completed. Content is read-only and no further workflow transitions are
          possible.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_23rem]">
        <Card className="min-w-0 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
              <Clapperboard className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">Content details</h2>
              <p className="text-xs text-ink-500">
                {canManageContent
                  ? "Update the brief metadata. Workflow state only changes through transitions."
                  : "Read-only details for your production work."}
              </p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <FormField label="Title" htmlFor="content-title" error={fieldErrors.title}>
              <Input
                id="content-title"
                value={form.title}
                onChange={(event) => setForm({ ...form, title: event.target.value })}
                maxLength={200}
                disabled={!canManageContent || projectCompleted}
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Type" htmlFor="content-type" error={fieldErrors.type}>
                <Select
                  id="content-type"
                  value={form.type}
                  onChange={(event) =>
                    setForm({ ...form, type: event.target.value as ContentType })
                  }
                  disabled={!canManageContent || projectCompleted}
                >
                  {CONTENT_TYPES.map((value) => (
                    <option key={value} value={value}>
                      {CONTENT_TYPE_LABELS[value]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Deadline" htmlFor="content-deadline" error={fieldErrors.deadline}>
                <Input
                  id="content-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                  disabled={!canManageContent || projectCompleted}
                />
              </FormField>
              <FormField
                label="Assignee"
                htmlFor="content-assignee"
                error={fieldErrors.assigneeId}
                className="sm:col-span-2"
              >
                <Select
                  id="content-assignee"
                  value={form.assigneeId}
                  onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                  disabled={!canManageContent || projectCompleted}
                >
                  <option value="">Unassigned</option>
                  {assigneeOptions.map((member) => (
                    <option key={member.user.id} value={member.user.id}>
                      {member.user.name}
                    </option>
                  ))}
                </Select>
              </FormField>
            </div>
            <FormField
              label="Description"
              htmlFor="content-description"
              error={fieldErrors.description}
            >
              <Textarea
                id="content-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={20_000}
                disabled={!canManageContent || projectCompleted}
                placeholder="Angle, script notes, references, and delivery expectations…"
              />
            </FormField>
            {canManageContent ? (
              <div className="flex items-center gap-2 border-t border-cream-200 pt-4">
                <Button
                  type="submit"
                  loading={saving}
                  icon={<Save className="size-4" />}
                  disabled={projectCompleted}
                >
                  Save details
                </Button>
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Sparkles className="size-4 text-accent-600" aria-hidden="true" />
              <h2 className="font-display text-xl tracking-tight text-ink-900">Workflow</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Fixed production stages. Only valid next steps are available to your role.
            </p>

            <ol className="mt-4 space-y-1.5">
              {stages.map((stage, index) => (
                <li key={stage.status} className="flex items-center gap-2.5">
                  <span
                    className={cn(
                      "grid size-5 shrink-0 place-items-center rounded-full border text-[9px] font-semibold",
                      stage.state === "done" && "border-moss-500/30 bg-moss-100 text-moss-500",
                      stage.state === "current" && "border-accent-500/40 bg-accent-500 text-white",
                      stage.state === "upcoming" && "border-cream-300 bg-white text-ink-400",
                    )}
                  >
                    {stage.state === "done" ? (
                      <CheckCircle2 className="size-3" aria-hidden="true" />
                    ) : (
                      index + 1
                    )}
                  </span>
                  <span
                    className={cn(
                      "text-xs",
                      stage.state === "current"
                        ? "font-semibold text-ink-900"
                        : stage.state === "done"
                          ? "text-ink-500"
                          : "text-ink-400",
                    )}
                  >
                    {CONTENT_STATUS_LABELS[stage.status]}
                  </span>
                </li>
              ))}
            </ol>

            {content.status === "READY_TO_PUBLISH" ? (
              <div className="mt-4 rounded-lg border border-moss-500/20 bg-moss-100 px-3 py-2.5 text-xs font-medium text-moss-500">
                This content is approved and ready for publishing. The workflow is complete.
              </div>
            ) : availableTransitions.length === 0 ? (
              <p className="mt-4 rounded-lg border border-dashed border-cream-300 px-3 py-2.5 text-xs text-ink-500">
                {canTransition
                  ? "Your role cannot move this item from its current stage."
                  : "Your role has read-only access to the workflow."}
              </p>
            ) : (
              <div className="mt-4 space-y-2">
                {requiresNote ? (
                  <FormField
                    label="Feedback"
                    htmlFor="transition-note"
                    hint="Required when sending the item back to editing."
                  >
                    <Textarea
                      id="transition-note"
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      maxLength={2_000}
                      placeholder="What needs to change before the next review?"
                      className="min-h-20"
                      disabled={projectCompleted}
                    />
                  </FormField>
                ) : null}
                {availableTransitions.map((toStatus) => (
                  <Button
                    key={toStatus}
                    variant={toStatus === "READY_TO_PUBLISH" ? "dark" : "secondary"}
                    className="w-full justify-between"
                    loading={transitioningTo === toStatus}
                    disabled={projectCompleted || transitioningTo !== null}
                    onClick={() => void moveTo(toStatus)}
                    icon={
                      toStatus === "READY_TO_PUBLISH" ? (
                        <CheckCircle2 className="size-4" />
                      ) : (
                        <ArrowRight className="size-4" />
                      )
                    }
                  >
                    {transitionLabel(content.status, toStatus)}
                  </Button>
                ))}
              </div>
            )}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Snapshot</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <FolderKanban className="size-4 text-ink-400" /> Project
                </dt>
                <dd className="max-w-[12rem] truncate text-right">
                  <Link
                    to={`/orgs/${membership.organization.id}/projects/${content.project.id}`}
                    className="font-medium text-accent-600 hover:text-accent-700"
                  >
                    {content.project.name}
                  </Link>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <CalendarClock className="size-4 text-ink-400" /> Deadline
                </dt>
                <dd className="text-ink-800">
                  {content.deadline ? formatDate(content.deadline) : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <UserRound className="size-4 text-ink-400" /> Assignee
                </dt>
                <dd className="flex items-center gap-1.5 text-ink-800">
                  {content.assignee ? (
                    <>
                      <Avatar name={content.assignee.name} className="size-6 text-[9px]" />
                      <span className="max-w-[9rem] truncate">{content.assignee.name}</span>
                    </>
                  ) : (
                    "Unassigned"
                  )}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <Clock3 className="size-4 text-ink-400" /> Created
                </dt>
                <dd className="text-ink-800">{formatDate(content.createdAt)}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="p-5">
        <div className="flex items-center gap-2">
          <History className="size-4 text-ink-400" aria-hidden="true" />
          <h2 className="font-display text-xl tracking-tight text-ink-900">Workflow history</h2>
          <Badge tone="neutral">{events.length}</Badge>
        </div>
        {events.length === 0 ? (
          <p className="mt-3 text-sm text-ink-500">
            No transitions yet. This item is still in its initial brief stage.
          </p>
        ) : (
          <ol className="mt-4 space-y-0">
            {events.map((event, index) => (
              <li key={event.id} className="relative flex gap-3 pb-5 last:pb-0">
                {index < events.length - 1 ? (
                  <span
                    className="absolute left-[11px] top-6 h-full w-px bg-cream-200"
                    aria-hidden="true"
                  />
                ) : null}
                <span className="relative mt-0.5 grid size-[23px] shrink-0 place-items-center rounded-full border border-cream-300 bg-white">
                  <span className="size-1.5 rounded-full bg-accent-500" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-ink-800">
                    <span className="font-medium">{CONTENT_STATUS_LABELS[event.fromStatus]}</span>
                    <ArrowRight className="mx-1.5 inline size-3 text-ink-400" aria-hidden="true" />
                    <span className="font-medium">{CONTENT_STATUS_LABELS[event.toStatus]}</span>
                  </p>
                  <p className="mt-0.5 text-[11px] text-ink-500">
                    {event.actor?.name ?? "System"} · {formatDateTime(event.createdAt)}
                  </p>
                  {event.note ? (
                    <p className="mt-1.5 rounded-lg bg-cream-50 px-3 py-2 text-xs leading-relaxed text-ink-600">
                      {event.note}
                    </p>
                  ) : null}
                </div>
              </li>
            ))}
          </ol>
        )}
      </Card>
    </div>
  );
}
