import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  ListChecks,
  Pencil,
  Plus,
  Search,
  ShieldAlert,
  UserRound,
} from "lucide-react";
import {
  PERMISSIONS,
  TASK_PRIORITIES,
  TASK_PRIORITY_LABELS,
  TASK_STATUSES,
  TASK_STATUS_LABELS,
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
import { TaskPriorityBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type {
  ContentItem,
  Project,
  ProjectMember,
  Task,
  TaskPriority,
  TaskStatus,
} from "../../lib/types";
import { cn, formatDate } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type TaskListResponse = { tasks: Task[] };
type ProjectListResponse = { projects: Project[] };
type ProjectMemberResponse = { members: ProjectMember[] };
type ContentListResponse = { content: ContentItem[] };

const emptyForm = {
  projectId: "",
  contentItemId: "",
  title: "",
  description: "",
  status: "TODO" as TaskStatus,
  priority: "MEDIUM" as TaskPriority,
  dueDate: "",
  assigneeId: "",
};

function isTaskOverdue(task: Task): boolean {
  if (!task.dueDate || task.status === "DONE") return false;
  const today = new Date();
  today.setUTCHours(0, 0, 0, 0);
  return new Date(`${task.dueDate}T00:00:00.000Z`).getTime() < today.getTime();
}

export function TasksPage() {
  const { user } = useAuth();
  const membership = useActiveMembership();
  const [searchParams] = useSearchParams();
  const organizationId = membership?.organization.id;
  const canViewTasks = membership ? hasPermission(membership.role, PERMISSIONS.TASKS_VIEW) : false;
  const canManageTasks = membership
    ? hasPermission(membership.role, PERMISSIONS.TASKS_CREATE)
    : false;

  const queryProjectId = searchParams.get("projectId") ?? "";
  const queryOverdue = searchParams.get("overdue") === "1";
  const queryNew = searchParams.get("new") === "1";

  const [tasks, setTasks] = useState<Task[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | TaskStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | TaskPriority>("ALL");
  const [projectFilter, setProjectFilter] = useState(queryProjectId);
  const [assigneeFilter, setAssigneeFilter] = useState("");
  const [overdueOnly, setOverdueOnly] = useState(queryOverdue);

  const [showForm, setShowForm] = useState(Boolean(queryNew) && canManageTasks);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [projectMembers, setProjectMembers] = useState<ProjectMember[]>([]);
  const [projectContent, setProjectContent] = useState<ContentItem[]>([]);
  const [formOptionsLoading, setFormOptionsLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [busyTaskId, setBusyTaskId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !canViewTasks) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      api.get<TaskListResponse>(`/organizations/${organizationId}/tasks`),
      api.get<ProjectListResponse>(`/organizations/${organizationId}/projects`),
    ])
      .then(([taskResponse, projectResponse]) => {
        if (!active) return;
        setTasks(taskResponse.tasks);
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
  }, [organizationId, canViewTasks]);

  const loadFormOptions = useCallback(
    async (projectId: string) => {
      if (!organizationId || !projectId) {
        setProjectMembers([]);
        setProjectContent([]);
        return;
      }
      setFormOptionsLoading(true);
      try {
        const [memberResponse, contentResponse] = await Promise.all([
          api.get<ProjectMemberResponse>(
            `/organizations/${organizationId}/projects/${projectId}/members`,
          ),
          api.get<ContentListResponse>(
            `/organizations/${organizationId}/projects/${projectId}/content-items`,
          ),
        ]);
        setProjectMembers(memberResponse.members);
        setProjectContent(contentResponse.content);
      } catch {
        setProjectMembers([]);
        setProjectContent([]);
      } finally {
        setFormOptionsLoading(false);
      }
    },
    [organizationId],
  );

  useEffect(() => {
    if (!showForm || !form.projectId) return;
    void loadFormOptions(form.projectId);
  }, [showForm, form.projectId, loadFormOptions]);

  const filterAssigneeOptions = useMemo(() => {
    const people = new Map<string, { id: string; name: string; email: string }>();
    for (const task of tasks) {
      if (task.assignee) people.set(task.assignee.id, task.assignee);
    }
    return Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [tasks]);

  const formAssigneeOptions = useMemo(() => {
    const people = new Map<string, { id: string; name: string; email: string }>();
    for (const member of projectMembers) people.set(member.user.id, member.user);
    if (user) people.set(user.id, user);
    if (editingTask?.assignee) people.set(editingTask.assignee.id, editingTask.assignee);
    return Array.from(people.values()).sort((a, b) => a.name.localeCompare(b.name));
  }, [projectMembers, user, editingTask]);

  const baseFiltered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return tasks.filter((task) => {
      if (priorityFilter !== "ALL" && task.priority !== priorityFilter) return false;
      if (projectFilter && task.project.id !== projectFilter) return false;
      if (assigneeFilter && task.assignee?.id !== assigneeFilter) return false;
      if (overdueOnly && !isTaskOverdue(task)) return false;
      if (!query) return true;
      return (
        task.title.toLowerCase().includes(query) ||
        (task.description ?? "").toLowerCase().includes(query) ||
        task.project.name.toLowerCase().includes(query) ||
        (task.contentItem?.title ?? "").toLowerCase().includes(query)
      );
    });
  }, [tasks, search, priorityFilter, projectFilter, assigneeFilter, overdueOnly]);

  const filtered = useMemo(
    () =>
      statusFilter === "ALL"
        ? baseFiltered
        : baseFiltered.filter((task) => task.status === statusFilter),
    [baseFiltered, statusFilter],
  );

  const statusCounts = useMemo(() => {
    const counts = new Map<TaskStatus, number>();
    for (const task of baseFiltered) {
      counts.set(task.status, (counts.get(task.status) ?? 0) + 1);
    }
    return counts;
  }, [baseFiltered]);

  const overdueCount = tasks.filter(isTaskOverdue).length;
  const inProgressCount = tasks.filter((task) => task.status === "IN_PROGRESS").length;
  const doneCount = tasks.filter((task) => task.status === "DONE").length;
  const visibleStatuses = statusFilter === "ALL" ? TASK_STATUSES : [statusFilter as TaskStatus];

  function openCreate() {
    const defaultProject =
      projectFilter || projects.find((project) => project.status !== "COMPLETED")?.id || "";
    setEditingTask(null);
    setForm({ ...emptyForm, projectId: defaultProject });
    setFormError(null);
    setFieldErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function openEdit(task: Task) {
    setEditingTask(task);
    setForm({
      projectId: task.project.id,
      contentItemId: task.contentItem?.id ?? "",
      title: task.title,
      description: task.description ?? "",
      status: task.status,
      priority: task.priority,
      dueDate: task.dueDate ?? "",
      assigneeId: task.assignee?.id ?? "",
    });
    setFormError(null);
    setFieldErrors({});
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    setFormError(null);
    setFieldErrors({});
    setNotice(null);

    const payload = {
      ...(editingTask ? {} : { projectId: form.projectId }),
      contentItemId: form.contentItemId ? form.contentItemId : null,
      title: form.title,
      description: form.description,
      status: form.status,
      priority: form.priority,
      dueDate: form.dueDate ? form.dueDate : null,
      assigneeId: form.assigneeId ? form.assigneeId : null,
    };

    try {
      if (editingTask) {
        const response = await api.patch<{ task: Task }>(
          `/organizations/${organizationId}/tasks/${editingTask.id}`,
          payload,
        );
        setTasks((current) =>
          current.map((task) => (task.id === response.task.id ? response.task : task)),
        );
        setNotice("Task updated.");
      } else {
        const response = await api.post<{ task: Task }>(
          `/organizations/${organizationId}/tasks`,
          payload,
        );
        setTasks((current) => [response.task, ...current]);
        setNotice("Task created.");
      }
      setShowForm(false);
      setEditingTask(null);
      setForm(emptyForm);
    } catch (error) {
      setFormError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(task: Task, status: TaskStatus) {
    if (!organizationId || task.status === status) return;
    setBusyTaskId(task.id);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.patch<{ task: Task }>(
        `/organizations/${organizationId}/tasks/${task.id}/status`,
        { status },
      );
      setTasks((current) =>
        current.map((item) => (item.id === response.task.id ? response.task : item)),
      );
      setNotice(`${response.task.title} moved to ${TASK_STATUS_LABELS[status]}.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyTaskId(null);
    }
  }

  if (!membership || !user) return null;

  if (!canViewTasks) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Production tasks" title="Tasks" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Tasks are restricted"
            description="Your role doesn't include task access in this workspace."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production tasks"
        title="Task board"
        description="Plan the work behind each deliverable, track ownership, and surface overdue tasks."
        actions={
          canManageTasks ? (
            <Button onClick={openCreate} icon={<Plus className="size-4" />}>
              New task
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
      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {showForm ? (
        <Card className="animate-rise p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
              <ListChecks className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">
                {editingTask ? "Edit task" : "New task"}
              </h2>
              <p className="text-xs text-ink-500">
                Tasks belong to a project and can optionally reference a content item.
              </p>
            </div>
          </div>

          {formError ? (
            <div className="mt-4">
              <Alert tone="error">{formError}</Alert>
            </div>
          ) : null}

          <form className="mt-4 space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField label="Project" htmlFor="task-project" error={fieldErrors.projectId}>
                <Select
                  id="task-project"
                  value={form.projectId}
                  onChange={(event) => {
                    setForm({
                      ...form,
                      projectId: event.target.value,
                      contentItemId: "",
                      assigneeId: "",
                    });
                  }}
                  disabled={Boolean(editingTask)}
                  required
                >
                  <option value="">Select a project</option>
                  {projects
                    .filter(
                      (project) =>
                        project.status !== "COMPLETED" || project.id === editingTask?.project.id,
                    )
                    .map((project) => (
                      <option key={project.id} value={project.id}>
                        {project.name}
                        {project.status === "PAUSED" ? " (paused)" : ""}
                      </option>
                    ))}
                </Select>
              </FormField>
              <FormField label="Title" htmlFor="task-title" error={fieldErrors.title}>
                <Input
                  id="task-title"
                  value={form.title}
                  onChange={(event) => setForm({ ...form, title: event.target.value })}
                  placeholder="Record host intro"
                  maxLength={200}
                  required
                />
              </FormField>
              <FormField
                label="Content item"
                htmlFor="task-content"
                error={fieldErrors.contentItemId}
                hint="Optional. Only content from the selected project can be linked."
              >
                <Select
                  id="task-content"
                  value={form.contentItemId}
                  onChange={(event) => setForm({ ...form, contentItemId: event.target.value })}
                  disabled={!form.projectId || formOptionsLoading}
                >
                  <option value="">No linked content</option>
                  {projectContent.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.title}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Assignee" htmlFor="task-assignee" error={fieldErrors.assigneeId}>
                <Select
                  id="task-assignee"
                  value={form.assigneeId}
                  onChange={(event) => setForm({ ...form, assigneeId: event.target.value })}
                  disabled={!form.projectId || formOptionsLoading}
                >
                  <option value="">Unassigned</option>
                  {formAssigneeOptions.map((person) => (
                    <option key={person.id} value={person.id}>
                      {person.name}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Status" htmlFor="task-status" error={fieldErrors.status}>
                <Select
                  id="task-status"
                  value={form.status}
                  onChange={(event) =>
                    setForm({ ...form, status: event.target.value as TaskStatus })
                  }
                >
                  {TASK_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {TASK_STATUS_LABELS[status]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Priority" htmlFor="task-priority" error={fieldErrors.priority}>
                <Select
                  id="task-priority"
                  value={form.priority}
                  onChange={(event) =>
                    setForm({ ...form, priority: event.target.value as TaskPriority })
                  }
                >
                  {TASK_PRIORITIES.map((priority) => (
                    <option key={priority} value={priority}>
                      {TASK_PRIORITY_LABELS[priority]}
                    </option>
                  ))}
                </Select>
              </FormField>
              <FormField label="Due date" htmlFor="task-due" error={fieldErrors.dueDate}>
                <Input
                  id="task-due"
                  type="date"
                  value={form.dueDate}
                  onChange={(event) => setForm({ ...form, dueDate: event.target.value })}
                />
              </FormField>
            </div>
            <FormField
              label="Description"
              htmlFor="task-description"
              error={fieldErrors.description}
            >
              <Textarea
                id="task-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                placeholder="What needs to happen, and what does done look like?"
                maxLength={20_000}
              />
            </FormField>
            <div className="flex items-center gap-2">
              <Button
                type="submit"
                loading={saving}
                icon={<CheckCircle2 className="size-4" />}
                disabled={!form.projectId}
              >
                {editingTask ? "Save task" : "Create task"}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowForm(false);
                  setEditingTask(null);
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <MiniStat
          label="Open tasks"
          value={tasks.filter((task) => task.status !== "DONE").length}
        />
        <MiniStat label="In progress" value={inProgressCount} />
        <MiniStat label="Done" value={doneCount} />
        <MiniStat
          label="Overdue"
          value={overdueCount}
          tone={overdueCount > 0 ? "danger" : "neutral"}
        />
      </div>

      <Card className="p-4">
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_repeat(3,minmax(0,10.5rem))_auto]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search tasks or content"
              aria-label="Search tasks"
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
            aria-label="Filter by assignee"
            value={assigneeFilter}
            onChange={(event) => setAssigneeFilter(event.target.value)}
          >
            <option value="">All assignees</option>
            {filterAssigneeOptions.map((person) => (
              <option key={person.id} value={person.id}>
                {person.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="Filter by priority"
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as "ALL" | TaskPriority)}
          >
            <option value="ALL">All priorities</option>
            {TASK_PRIORITIES.map((priority) => (
              <option key={priority} value={priority}>
                {TASK_PRIORITY_LABELS[priority]}
              </option>
            ))}
          </Select>
          <div className="flex gap-2">
            <Select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as "ALL" | TaskStatus)}
            >
              <option value="ALL">All statuses</option>
              {TASK_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </option>
              ))}
            </Select>
            <Button
              variant={overdueOnly ? "danger" : "secondary"}
              onClick={() => setOverdueOnly((value) => !value)}
              icon={<AlertTriangle className="size-3.5" />}
              aria-pressed={overdueOnly}
              className="shrink-0"
            >
              Overdue
            </Button>
          </div>
        </div>
      </Card>

      {!loading && tasks.length > 0 ? (
        <div className="-mx-4 overflow-x-auto px-4 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex min-w-max items-center gap-2">
            <button
              type="button"
              onClick={() => setStatusFilter("ALL")}
              className={cn(
                "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                statusFilter === "ALL"
                  ? "border-ink-900 bg-ink-900 text-cream-50"
                  : "border-cream-300 bg-white text-ink-600 hover:bg-cream-100",
              )}
            >
              All statuses
              <span className="ml-1.5 opacity-70">{baseFiltered.length}</span>
            </button>
            {TASK_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-[11px] font-semibold transition",
                  statusFilter === status
                    ? "border-accent-500 bg-accent-500 text-white"
                    : "border-cream-300 bg-white text-ink-600 hover:bg-cream-100",
                )}
              >
                {TASK_STATUS_LABELS[status]}
                <span className="ml-1.5 opacity-70">{statusCounts.get(status) ?? 0}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading tasks…
        </div>
      ) : tasks.length === 0 ? (
        <Card>
          <EmptyState
            icon={<ListChecks className="size-5" />}
            title="No tasks yet"
            description={
              canManageTasks
                ? "Break the production work into tasks and assign them to the project team."
                : "Tasks assigned to you or your projects will appear here."
            }
            action={
              canManageTasks ? (
                <Button onClick={openCreate} icon={<Plus className="size-4" />}>
                  New task
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Search className="size-5" />}
            title="No tasks match those filters"
            description="Try another search term, project, assignee, priority, or status."
            action={
              <Button
                variant="secondary"
                onClick={() => {
                  setSearch("");
                  setStatusFilter("ALL");
                  setPriorityFilter("ALL");
                  setProjectFilter("");
                  setAssigneeFilter("");
                  setOverdueOnly(false);
                }}
              >
                Clear filters
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="-mx-4 overflow-x-auto px-4 pb-2 sm:-mx-6 sm:px-6 lg:mx-0 lg:px-0">
          <div className="flex min-w-max snap-x snap-mandatory gap-3">
            {visibleStatuses.map((status) => {
              const items = filtered.filter((task) => task.status === status);
              return (
                <section
                  key={status}
                  className="flex h-[32rem] max-h-[calc(100vh-18rem)] min-h-[20rem] w-[20rem] shrink-0 snap-start flex-col rounded-xl border border-cream-200 bg-cream-100/50"
                  aria-label={TASK_STATUS_LABELS[status]}
                >
                  <header className="flex shrink-0 items-center justify-between gap-2 border-b border-cream-200 px-4 py-3.5">
                    <span className="text-xs font-semibold uppercase tracking-[0.1em] text-ink-600">
                      {TASK_STATUS_LABELS[status]}
                    </span>
                    <span className="rounded-full bg-white px-1.5 py-0.5 text-[10px] font-semibold text-ink-500">
                      {items.length}
                    </span>
                  </header>
                  <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain p-3 [scrollbar-width:thin] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-cream-300 [&::-webkit-scrollbar-track]:bg-transparent">
                    {items.length === 0 ? (
                      <p className="rounded-lg border border-dashed border-cream-300 px-3 py-10 text-center text-[11px] text-ink-400">
                        Nothing here
                      </p>
                    ) : (
                      items.map((task) => {
                        const overdue = isTaskOverdue(task);
                        const canChangeStatus =
                          (canManageTasks || task.assignee?.id === user.id) &&
                          task.project.status !== "COMPLETED";
                        return (
                          <article
                            key={task.id}
                            className="rounded-xl border border-cream-200 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-[15px] font-medium leading-snug text-ink-900">
                                {task.title}
                              </p>
                              <TaskPriorityBadge priority={task.priority} />
                            </div>
                            <p className="mt-1.5 truncate text-[11px] text-ink-500">
                              {task.project.name}
                            </p>
                            {task.contentItem ? (
                              <Link
                                to={`/orgs/${membership.organization.id}/content/${task.contentItem.id}`}
                                className="mt-1 block truncate text-[11px] text-accent-600 hover:text-accent-700"
                              >
                                {task.contentItem.title}
                              </Link>
                            ) : null}
                            <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-cream-100 pt-2.5 text-[10px]">
                              {task.dueDate ? (
                                <span
                                  className={cn(
                                    "flex items-center gap-1",
                                    overdue ? "font-semibold text-rust-700" : "text-ink-500",
                                  )}
                                >
                                  <CalendarClock className="size-3" aria-hidden="true" />
                                  {overdue ? "Overdue " : "Due "}
                                  {formatDate(task.dueDate)}
                                </span>
                              ) : (
                                <span className="text-ink-400">No due date</span>
                              )}
                              <span className="ml-auto flex items-center gap-1.5 text-ink-500">
                                {task.assignee ? (
                                  <>
                                    <Avatar
                                      name={task.assignee.name}
                                      className="size-5 text-[8px]"
                                    />
                                    <span className="max-w-[8rem] truncate">
                                      {task.assignee.name}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <UserRound className="size-3" aria-hidden="true" />
                                    Unassigned
                                  </>
                                )}
                              </span>
                            </div>
                            <div className="mt-2.5 flex items-center gap-1.5">
                              <Select
                                aria-label={`Change status for ${task.title}`}
                                value={task.status}
                                onChange={(event) =>
                                  void changeStatus(task, event.target.value as TaskStatus)
                                }
                                disabled={!canChangeStatus || busyTaskId === task.id}
                                className="min-h-9 flex-1 py-1 text-xs"
                              >
                                {TASK_STATUSES.map((option) => (
                                  <option key={option} value={option}>
                                    {TASK_STATUS_LABELS[option]}
                                  </option>
                                ))}
                              </Select>
                              {canManageTasks ? (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="px-2"
                                  onClick={() => openEdit(task)}
                                  aria-label={`Edit ${task.title}`}
                                >
                                  <Pencil className="size-3.5" />
                                </Button>
                              ) : null}
                            </div>
                          </article>
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

function MiniStat({
  label,
  value,
  tone = "neutral",
}: {
  label: string;
  value: number;
  tone?: "neutral" | "danger";
}) {
  return (
    <Card className="p-4">
      <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">{label}</p>
      <p
        className={cn(
          "mt-1 font-display text-2xl tracking-tight",
          tone === "danger" ? "text-rust-700" : "text-ink-900",
        )}
      >
        {value}
      </p>
    </Card>
  );
}
