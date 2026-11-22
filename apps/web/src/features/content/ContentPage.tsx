import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { CalendarClock, Clapperboard, Plus, Search, ShieldAlert, UserRound } from "lucide-react";
import {
  CONTENT_STATUSES,
  CONTENT_STATUS_LABELS,
  CONTENT_TYPE_LABELS,
  CONTENT_TYPES,
  PERMISSIONS,
  hasPermission,
} from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import {
  Alert,
  Avatar,
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
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type {
  ContentItem,
  ContentStatus,
  ContentType,
  Project,
  ProjectMember,
} from "../../lib/types";
import { formatDate } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ContentListResponse = { content: ContentItem[] };
type ProjectListResponse = { projects: Project[] };
type ProjectMemberResponse = { members: ProjectMember[] };

function isOverdue(deadline: string | null, status: ContentStatus): boolean {
  if (!deadline || status === "READY_TO_PUBLISH") return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${deadline}T00:00:00.000Z`).getTime() < today.getTime();
}

export function ContentPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const membership = useActiveMembership();
  const [searchParams] = useSearchParams();
  const organizationId = membership?.organization.id;
  const canViewContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;
  const canCreateContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_CREATE)
    : false;

  const queryProjectId = searchParams.get("projectId") ?? "";
  const queryNew = searchParams.get("new") === "1";

  const [content, setContent] = useState<ContentItem[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ContentStatus>("ALL");
  const [typeFilter, setTypeFilter] = useState<"ALL" | ContentType>("ALL");
  const [projectFilter, setProjectFilter] = useState(queryProjectId);
  const [assigneeFilter, setAssigneeFilter] = useState("");

  const [showCreate, setShowCreate] = useState(Boolean(queryNew) && canCreateContent);
  const [formProjectId, setFormProjectId] = useState(queryProjectId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<ContentType>("PODCAST");
  const [deadline, setDeadline] = useState("");
  const [assigneeId, setAssigneeId] = useState("");
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!organizationId || !canViewContent) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      api.get<ContentListResponse>(`/organizations/${organizationId}/content-items`),
      api.get<ProjectListResponse>(`/organizations/${organizationId}/projects`),
    ])
      .then(([contentResponse, projectResponse]) => {
        if (!active) return;
        setContent(contentResponse.content);
        setProjects(projectResponse.projects);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId, canViewContent]);

  useEffect(() => {
    if (!organizationId || !showCreate || !formProjectId) {
      setProjectMembers([]);
      return;
    }
    let active = true;
    setMembersLoading(true);
    api
      .get<ProjectMemberResponse>(
        `/organizations/${organizationId}/projects/${formProjectId}/members`,
      )
      .then((response) => {
        if (active) setProjectMembers(response.members);
      })
      .catch(() => {
        if (active) setProjectMembers([]);
      })
      .finally(() => {
        if (active) setMembersLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId, showCreate, formProjectId]);

  const assigneeOptions = useMemo(() => {
    const people = new Map<string, { id: string; name: string; email: string }>();
    for (const item of content) {
      if (item.assignee) {
        people.set(item.assignee.id, {
          id: item.assignee.id,
          name: item.assignee.name,
          email: item.assignee.email,
        });
      }
    }
    return Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [content]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return content.filter((item) => {
      if (statusFilter !== "ALL" && item.status !== statusFilter) return false;
      if (typeFilter !== "ALL" && item.type !== typeFilter) return false;
      if (projectFilter && item.project.id !== projectFilter) return false;
      if (assigneeFilter && item.assignee?.id !== assigneeFilter) return false;
      if (!query) return true;
      return (
        item.title.toLowerCase().includes(query) ||
        (item.description ?? "").toLowerCase().includes(query) ||
        item.project.name.toLowerCase().includes(query)
      );
    });
  }, [content, search, statusFilter, typeFilter, projectFilter, assigneeFilter]);

  const visibleStatuses =
    statusFilter === "ALL" ? CONTENT_STATUSES : [statusFilter as ContentStatus];

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !formProjectId) return;

    setCreating(true);
    setCreateError(null);
    setFieldErrors({});

    try {
      const response = await api.post<{ content: ContentItem }>(
        `/organizations/${organizationId}/projects/${formProjectId}/content-items`,
        {
          title,
          type,
          ...(description ? { description } : {}),
          ...(deadline ? { deadline } : {}),
          ...(assigneeId ? { assigneeId } : {}),
        },
      );
      navigate(`/orgs/${organizationId}/content/${response.content.id}`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setCreating(false);
    }
  }

  if (!membership || !user) return null;

  if (!canViewContent) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Content workflow" title="Content" />
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

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Content workflow"
        title="Content board"
        description="Every deliverable moves through the same fixed production workflow, from brief to ready to publish."
        actions={
          canCreateContent ? (
            <Button
              onClick={() => setShowCreate((value) => !value)}
              icon={<Plus className="size-4" />}
              disabled={projects.length === 0}
            >
              New content
            </Button>
          ) : null
        }
      />

      {loadError ? (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={() => window.location.reload()}>
              Reload
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : null}

      {showCreate ? (
        <Card className="animate-rise p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
              <Clapperboard className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">New content item</h2>
              <p className="text-xs text-ink-500">
                New deliverables always start in Brief. The workflow is fixed for this MVP.
              </p>
            </div>
          </div>

          {createError ? (
            <div className="mt-4">
              <Alert tone="error">{createError}</Alert>
            </div>
          ) : null}

          {projects.length === 0 ? (
            <div className="mt-4">
              <Alert tone="warning">
                You need access to an active project before creating content.
              </Alert>
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Project" htmlFor="content-project" error={fieldErrors.projectId}>
                  <Select
                    id="content-project"
                    value={formProjectId}
                    onChange={(event) => {
                      setFormProjectId(event.target.value);
                      setAssigneeId("");
                    }}
                    required
                  >
                    <option value="">Select a project</option>
                    {projects
                      .filter((project) => project.status !== "COMPLETED")
                      .map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.name}
                          {project.status === "PAUSED" ? " (paused)" : ""}
                        </option>
                      ))}
                  </Select>
                </FormField>
                <FormField label="Content type" htmlFor="content-type" error={fieldErrors.type}>
                  <Select
                    id="content-type"
                    value={type}
                    onChange={(event) => setType(event.target.value as ContentType)}
                  >
                    {CONTENT_TYPES.map((value) => (
                      <option key={value} value={value}>
                        {CONTENT_TYPE_LABELS[value]}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField
                  label="Title"
                  htmlFor="content-title"
                  error={fieldErrors.title}
                  className="sm:col-span-2"
                >
                  <Input
                    id="content-title"
                    value={title}
                    onChange={(event) => setTitle(event.target.value)}
                    placeholder="Episode 03 — The Next Signal"
                    maxLength={200}
                    required
                  />
                </FormField>
                <FormField label="Deadline" htmlFor="content-deadline" error={fieldErrors.deadline}>
                  <Input
                    id="content-deadline"
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </FormField>
                <FormField
                  label="Assignee"
                  htmlFor="content-assignee"
                  error={fieldErrors.assigneeId}
                  hint={
                    formProjectId
                      ? "Only project team members (and managers) can be assigned."
                      : "Select a project first."
                  }
                >
                  <Select
                    id="content-assignee"
                    value={assigneeId}
                    onChange={(event) => setAssigneeId(event.target.value)}
                    disabled={!formProjectId || membersLoading}
                  >
                    <option value="">{membersLoading ? "Loading team…" : "Unassigned"}</option>
                    {projectMembers.map((member) => (
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
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Scope, angle, and delivery notes…"
                  maxLength={20_000}
                />
              </FormField>
              <div className="flex items-center gap-2">
                <Button type="submit" loading={creating} icon={<Plus className="size-4" />}>
                  Create content
                </Button>
                <Button variant="ghost" onClick={() => setShowCreate(false)}>
                  Cancel
                </Button>
              </div>
            </form>
          )}
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(4,minmax(0,11rem))]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search content, briefs, or projects"
              aria-label="Search content"
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter by project"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | ContentStatus)}
          >
            <option value="ALL">All stages</option>
            {CONTENT_STATUSES.map((value) => (
              <option key={value} value={value}>
                {CONTENT_STATUS_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by type"
            value={typeFilter}
            onChange={(event) => setTypeFilter(event.target.value as "ALL" | ContentType)}
          >
            <option value="ALL">All types</option>
            {CONTENT_TYPES.map((value) => (
              <option key={value} value={value}>
                {CONTENT_TYPE_LABELS[value]}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="">All assignees</option>
            {assigneeOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading content…
        </div>
      ) : content.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clapperboard className="size-5" />}
            title="No content yet"
            description={
              canCreateContent
                ? "Create the first deliverable to begin the production workflow."
                : "A producer or project manager will add deliverables to your projects."
            }
            action={
              canCreateContent ? (
                <Button
                  onClick={() => setShowCreate(true)}
                  icon={<Plus className="size-4" />}
                  disabled={projects.length === 0}
                >
                  New content
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="size-5" />}
            title="No content matches those filters"
            description="Try another search term, stage, type, project, or assignee."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setTypeFilter("ALL");
                  setProjectFilter("");
                  setAssigneeFilter("");
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex min-w-max gap-3">
            {visibleStatuses.map((status) => {
              const items = filtered.filter((item) => item.status === status);
              return (
                <section
                  key={status}
                  className="w-[17rem] shrink-0 rounded-xl border border-cream-200 bg-cream-100/50"
                  aria-label={CONTENT_STATUS_LABELS[status]}
                >
                  <header className="flex items-center justify-between gap-2 border-b border-cream-200 px-3.5 py-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-xs font-semibold uppercase tracking-[0.1em] text-ink-600">
                        {CONTENT_STATUS_LABELS[status]}
                      </span>
                    </div>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                      {items.length}
                    </span>
                  </header>

                  <div className="space-y-2.5 p-2.5">
                    {items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-cream-300 px-3 py-6 text-center text-[11px] text-ink-400">
                        Nothing here
                      </p>
                    ) : (
                      items.map((item) => {
                        const overdue = isOverdue(item.deadline, item.status);
                        return (
                          <Link
                            key={item.id}
                            to={`/orgs/${membership.organization.id}/content/${item.id}`}
                            className="group block rounded-lg border border-cream-200 bg-white p-3.5 shadow-sm transition hover:-translate-y-0.5 hover:border-cream-300 hover:shadow-md"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="line-clamp-2 text-sm font-medium leading-snug text-ink-900">
                                {item.title}
                              </p>
                            </div>
                            <p className="mt-2 truncate text-[11px] text-ink-500">
                              {item.project.name}
                            </p>
                            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-cream-100 pt-2.5">
                              <span className="rounded bg-cream-100 px-1.5 py-0.5 text-[10px] font-medium text-ink-500">
                                {CONTENT_TYPE_LABELS[item.type]}
                              </span>
                              {item.deadline ? (
                                <span
                                  className={`flex items-center gap-1 text-[10px] ${
                                    overdue ? "font-semibold text-rust-700" : "text-ink-500"
                                  }`}
                                >
                                  <CalendarClock className="size-3" aria-hidden="true" />
                                  {formatDate(item.deadline)}
                                </span>
                              ) : null}
                            </div>
                            <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-500">
                              {item.assignee ? (
                                <>
                                  <Avatar name={item.assignee.name} className="size-5 text-[8px]" />
                                  <span className="truncate">{item.assignee.name}</span>
                                </>
                              ) : (
                                <>
                                  <UserRound className="size-3" aria-hidden="true" />
                                  <span>Unassigned</span>
                                </>
                              )}
                            </div>
                          </Link>
                        );
                      })
                    )}
                  </div>
                </section>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
