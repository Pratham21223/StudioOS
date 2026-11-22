import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  Building2,
  CalendarDays,
  CheckCircle2,
  Clapperboard,
  FolderKanban,
  ListChecks,
  Pause,
  Play,
  Plus,
  Save,
  ShieldAlert,
  Trash2,
  Users,
} from "lucide-react";
import { CONTENT_TYPE_LABELS, PERMISSIONS, hasPermission } from "@studioos/shared";
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
import { ContentStatusBadge, ProjectStatusBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type {
  Client,
  ContentItem,
  Member,
  Project,
  ProjectMember,
  ProjectStatus,
} from "../../lib/types";
import { formatDate, roleLabel } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ProjectResponse = { project: Project };
type ProjectMemberResponse = { members: ProjectMember[] };
type MemberResponse = { members: Member[] };
type ClientResponse = { clients: Client[] };
type ContentResponse = { content: ContentItem[] };

const emptyForm = {
  name: "",
  description: "",
  startDate: "",
  deadline: "",
  clientId: "",
};

export function ProjectDetailPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const membership = useActiveMembership();
  const organizationId = membership?.organization.id;
  const canViewProjects = membership
    ? hasPermission(membership.role, PERMISSIONS.PROJECTS_VIEW)
    : false;
  const canManageProjects = membership
    ? hasPermission(membership.role, PERMISSIONS.PROJECTS_MANAGE)
    : false;
  const canViewClients = membership
    ? hasPermission(membership.role, PERMISSIONS.CLIENTS_VIEW)
    : false;
  const canViewContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;
  const canCreateContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_CREATE)
    : false;

  const [project, setProject] = useState<Project | null>(null);
  const [members, setMembers] = useState<ProjectMember[]>([]);
  const [organizationMembers, setOrganizationMembers] = useState<Member[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [statusBusy, setStatusBusy] = useState<ProjectStatus | null>(null);

  const [selectedUserId, setSelectedUserId] = useState("");
  const [memberBusy, setMemberBusy] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !projectId || !canViewProjects) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const requests = [
        api.get<ProjectResponse>(`/organizations/${organizationId}/projects/${projectId}`),
        api.get<ProjectMemberResponse>(
          `/organizations/${organizationId}/projects/${projectId}/members`,
        ),
        canViewContent
          ? api.get<ContentResponse>(
              `/organizations/${organizationId}/projects/${projectId}/content-items`,
            )
          : Promise.resolve({ content: [] }),
      ] as const;

      const [projectResponse, memberResponse, contentResponse] = await Promise.all(requests);
      setProject(projectResponse.project);
      setMembers(memberResponse.members);
      setContent(contentResponse.content);
      setForm({
        name: projectResponse.project.name,
        description: projectResponse.project.description ?? "",
        startDate: projectResponse.project.startDate ?? "",
        deadline: projectResponse.project.deadline ?? "",
        clientId: projectResponse.project.client.id,
      });

      if (canManageProjects) {
        const [directoryResponse, clientResponse] = await Promise.all([
          api.get<MemberResponse>(`/organizations/${organizationId}/members`),
          canViewClients
            ? api.get<ClientResponse>(`/organizations/${organizationId}/clients`)
            : Promise.resolve({ clients: [] }),
        ]);
        setOrganizationMembers(directoryResponse.members);
        setClients(clientResponse.clients);
      }
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [
    organizationId,
    projectId,
    canViewProjects,
    canManageProjects,
    canViewClients,
    canViewContent,
  ]);

  useEffect(() => {
    void load();
  }, [load]);

  const assignedIds = useMemo(() => new Set(members.map((member) => member.user.id)), [members]);

  const availableMembers = organizationMembers.filter(
    (member) => member.status === "ACTIVE" && !assignedIds.has(member.user.id),
  );

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    setActionError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const response = await api.patch<ProjectResponse>(
        `/organizations/${organizationId}/projects/${projectId}`,
        {
          name: form.name,
          description: form.description,
          clientId: form.clientId,
          startDate: form.startDate ? form.startDate : null,
          deadline: form.deadline ? form.deadline : null,
        },
      );
      setProject(response.project);
      setForm({
        name: response.project.name,
        description: response.project.description ?? "",
        startDate: response.project.startDate ?? "",
        deadline: response.project.deadline ?? "",
        clientId: response.project.client.id,
      });
      setNotice("Project details saved.");
    } catch (error) {
      setActionError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setSaving(false);
    }
  }

  async function changeStatus(status: ProjectStatus) {
    if (!organizationId) return;
    if (
      status === "COMPLETED" &&
      !window.confirm("Complete this project? Completed projects cannot be reopened.")
    ) {
      return;
    }

    setStatusBusy(status);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.patch<ProjectResponse>(
        `/organizations/${organizationId}/projects/${projectId}`,
        { status },
      );
      setProject(response.project);
      setNotice(`Project marked ${status.toLowerCase()}.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setStatusBusy(null);
    }
  }

  async function addMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId || !selectedUserId) return;

    setMemberBusy(true);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.post<ProjectMemberResponse>(
        `/organizations/${organizationId}/projects/${projectId}/members`,
        { userIds: [selectedUserId] },
      );
      setMembers(response.members);
      setProject((current) =>
        current ? { ...current, memberCount: response.members.length } : current,
      );
      setSelectedUserId("");
      setNotice("Team member added.");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setMemberBusy(false);
    }
  }

  async function removeMember(member: ProjectMember) {
    if (!organizationId) return;
    if (!window.confirm(`Remove ${member.user.name} from this project?`)) return;

    setBusyMemberId(member.user.id);
    setActionError(null);
    setNotice(null);
    try {
      await api.delete<{ removed: boolean }>(
        `/organizations/${organizationId}/projects/${projectId}/members/${member.user.id}`,
      );
      setMembers((current) => current.filter((item) => item.user.id !== member.user.id));
      setProject((current) =>
        current ? { ...current, memberCount: Math.max(0, current.memberCount - 1) } : current,
      );
      setNotice(`${member.user.name} was removed from the project.`);
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyMemberId(null);
    }
  }

  if (!membership || !user) return null;

  if (!canViewProjects) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Production workspace" title="Project" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Project access is restricted"
            description="Your role doesn't include project access."
          />
        </Card>
      </div>
    );
  }

  if (!loading && (loadError || !project)) {
    return (
      <div className="space-y-6">
        <Link
          to={`/orgs/${membership.organization.id}/projects`}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
        >
          <ArrowLeft className="size-4" /> Back to projects
        </Link>
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title="Project not available"
            description={
              loadError ?? "This project could not be found, or you haven't been assigned to it."
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

  if (loading || !project) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner /> Loading project…
      </div>
    );
  }

  const isCompleted = project.status === "COMPLETED";

  return (
    <div className="space-y-6">
      <Link
        to={`/orgs/${membership.organization.id}/projects`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to projects
      </Link>

      <PageHeader
        eyebrow="Project workspace"
        title={project.name}
        description={`${project.client.name} · Created ${formatDate(project.createdAt)}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <ProjectStatusBadge status={project.status} />
            {canManageProjects && !isCompleted ? (
              <>
                {project.status === "ACTIVE" ? (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={statusBusy === "PAUSED"}
                    onClick={() => void changeStatus("PAUSED")}
                    icon={<Pause className="size-3.5" />}
                  >
                    Pause
                  </Button>
                ) : (
                  <Button
                    variant="secondary"
                    size="sm"
                    loading={statusBusy === "ACTIVE"}
                    onClick={() => void changeStatus("ACTIVE")}
                    icon={<Play className="size-3.5" />}
                  >
                    Resume
                  </Button>
                )}
                <Button
                  variant="dark"
                  size="sm"
                  loading={statusBusy === "COMPLETED"}
                  onClick={() => void changeStatus("COMPLETED")}
                  icon={<CheckCircle2 className="size-3.5" />}
                >
                  Complete
                </Button>
              </>
            ) : null}
          </div>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
              <FolderKanban className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">Project brief</h2>
              <p className="text-xs text-ink-500">
                {canManageProjects
                  ? "Keep scope, schedule, and client context current."
                  : "Read-only project details for your production work."}
              </p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Project name"
                htmlFor="project-name"
                error={fieldErrors.name}
                className="sm:col-span-2"
              >
                <Input
                  id="project-name"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  maxLength={160}
                  disabled={!canManageProjects}
                  required
                />
              </FormField>
              <FormField label="Client" htmlFor="project-client" error={fieldErrors.clientId}>
                <Select
                  id="project-client"
                  value={form.clientId}
                  onChange={(event) => setForm({ ...form, clientId: event.target.value })}
                  disabled={!canManageProjects}
                >
                  {clients.length === 0 ? (
                    <option value={project.client.id}>{project.client.name}</option>
                  ) : (
                    clients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                        {client.status === "ARCHIVED" ? " (archived)" : ""}
                      </option>
                    ))
                  )}
                </Select>
              </FormField>
              <div />
              <FormField label="Start date" htmlFor="project-start" error={fieldErrors.startDate}>
                <Input
                  id="project-start"
                  type="date"
                  value={form.startDate}
                  onChange={(event) => setForm({ ...form, startDate: event.target.value })}
                  disabled={!canManageProjects}
                />
              </FormField>
              <FormField label="Deadline" htmlFor="project-deadline" error={fieldErrors.deadline}>
                <Input
                  id="project-deadline"
                  type="date"
                  value={form.deadline}
                  onChange={(event) => setForm({ ...form, deadline: event.target.value })}
                  disabled={!canManageProjects}
                />
              </FormField>
            </div>

            <FormField label="Brief" htmlFor="project-description" error={fieldErrors.description}>
              <Textarea
                id="project-description"
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                maxLength={10_000}
                disabled={!canManageProjects}
                placeholder="Scope, deliverables, schedule, and review expectations…"
              />
            </FormField>

            {canManageProjects ? (
              <div className="flex flex-col gap-2 border-t border-cream-200 pt-4 sm:flex-row sm:items-center">
                <Button type="submit" loading={saving} icon={<Save className="size-4" />}>
                  Save project
                </Button>
                <span className="text-xs text-ink-500">
                  Completed projects stay readable but cannot be reopened.
                </span>
              </div>
            ) : null}
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Client</h2>
            <div className="mt-3 flex items-center gap-3">
              <span className="grid size-9 place-items-center rounded-lg bg-cream-100 text-ink-600">
                <Building2 className="size-4" aria-hidden="true" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-ink-900">{project.client.name}</p>
                <p className="text-xs capitalize text-ink-500">
                  {project.client.status.toLowerCase()}
                </p>
              </div>
            </div>
            {canViewClients ? (
              <Link
                to={`/orgs/${membership.organization.id}/clients/${project.client.id}`}
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 transition hover:text-accent-700"
              >
                Open client profile
              </Link>
            ) : null}
          </Card>

          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Schedule</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <CalendarDays className="size-4 text-ink-400" /> Start
                </dt>
                <dd className="text-ink-800">
                  {project.startDate ? formatDate(project.startDate) : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <CalendarDays className="size-4 text-ink-400" /> Deadline
                </dt>
                <dd className="text-ink-800">
                  {project.deadline ? formatDate(project.deadline) : "Not set"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <Users className="size-4 text-ink-400" /> Team
                </dt>
                <dd className="text-ink-800">{members.length} assigned</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-cream-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink-900">Production team</h2>
            <p className="text-xs text-ink-500">
              Only active workspace members can be assigned to a project.
            </p>
          </div>
          <BadgeCount count={members.length} />
        </div>

        {canManageProjects ? (
          <form
            className="flex flex-col gap-2 border-b border-cream-200 bg-cream-50/60 px-5 py-3 sm:flex-row sm:items-center"
            onSubmit={addMember}
          >
            <Select
              aria-label="Select a team member to add"
              value={selectedUserId}
              onChange={(event) => setSelectedUserId(event.target.value)}
              className="flex-1 bg-white"
              disabled={availableMembers.length === 0}
            >
              <option value="">
                {availableMembers.length === 0
                  ? "All active members are assigned"
                  : "Select an active member"}
              </option>
              {availableMembers.map((member) => (
                <option key={member.user.id} value={member.user.id}>
                  {member.user.name} · {roleLabel(member.role)}
                </option>
              ))}
            </Select>
            <Button
              type="submit"
              variant="secondary"
              loading={memberBusy}
              disabled={!selectedUserId}
              icon={<Plus className="size-4" />}
            >
              Add to project
            </Button>
          </form>
        ) : null}

        {members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No team assigned"
            description={
              canManageProjects
                ? "Add producers and editors so they can access this project."
                : "A project manager will assign the production team."
            }
          />
        ) : (
          <ul className="divide-y divide-cream-200">
            {members.map((member) => (
              <li key={member.id} className="flex items-center gap-3 px-5 py-3.5">
                <Avatar name={member.user.name} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">{member.user.name}</p>
                  <p className="truncate text-xs text-ink-500">{member.user.email}</p>
                </div>
                <span className="hidden text-xs text-ink-400 sm:block">
                  Added {formatDate(member.createdAt)}
                </span>
                {canManageProjects ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={busyMemberId === member.user.id}
                    onClick={() => void removeMember(member)}
                    aria-label={`Remove ${member.user.name} from project`}
                  >
                    {busyMemberId === member.user.id ? (
                      <Spinner className="size-3.5" />
                    ) : (
                      <Trash2 className="size-3.5" />
                    )}
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </Card>

      {canViewContent ? (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-cream-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Clapperboard className="size-4 text-ink-400" aria-hidden="true" />
                <h2 className="font-display text-xl tracking-tight text-ink-900">Content</h2>
                <span className="rounded-full bg-cream-100 px-2 py-0.5 text-[10px] font-semibold text-ink-500">
                  {content.length}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-ink-500">
                Deliverables moving through the fixed production workflow.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Link
                to={`/orgs/${membership.organization.id}/content?projectId=${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-cream-100"
              >
                <Clapperboard className="size-3.5" aria-hidden="true" />
                Open content board
              </Link>
              {canCreateContent && !isCompleted ? (
                <Link
                  to={`/orgs/${membership.organization.id}/content?projectId=${project.id}&new=1`}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-ink-900 px-3 py-2 text-xs font-medium text-cream-50 transition hover:bg-ink-800"
                >
                  <Plus className="size-3.5" aria-hidden="true" />
                  New content
                </Link>
              ) : null}
              <Link
                to={`/orgs/${membership.organization.id}/tasks?projectId=${project.id}`}
                className="inline-flex items-center gap-1.5 rounded-lg border border-cream-300 bg-white px-3 py-2 text-xs font-medium text-ink-700 transition hover:bg-cream-100"
              >
                <ListChecks className="size-3.5" aria-hidden="true" />
                Project tasks
              </Link>
            </div>
          </div>

          {content.length === 0 ? (
            <EmptyState
              icon={<Clapperboard className="size-5" />}
              title="No content yet"
              description="Create the first deliverable to start the production workflow."
            />
          ) : (
            <ul className="divide-y divide-cream-200">
              {content.map((item) => (
                <li key={item.id}>
                  <Link
                    to={`/orgs/${membership.organization.id}/content/${item.id}`}
                    className="flex flex-col gap-2 px-5 py-3.5 transition hover:bg-cream-50 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-500">
                        <Clapperboard className="size-4" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-ink-900">{item.title}</p>
                        <p className="text-xs text-ink-500">
                          {CONTENT_TYPE_LABELS[item.type]}
                          {item.assignee ? ` · ${item.assignee.name}` : " · Unassigned"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 pl-11 sm:pl-0">
                      {item.deadline ? (
                        <span className="text-xs text-ink-500">
                          Due {formatDate(item.deadline)}
                        </span>
                      ) : null}
                      <ContentStatusBadge status={item.status} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
      ) : null}
    </div>
  );
}

function BadgeCount({ count }: { count: number }) {
  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-cream-300 bg-cream-100 px-2 py-0.5 text-[11px] font-semibold text-ink-600">
      <Users className="size-3" aria-hidden="true" />
      {count} {count === 1 ? "member" : "members"}
    </span>
  );
}
