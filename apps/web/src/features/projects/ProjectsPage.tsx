import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarDays,
  FolderKanban,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import {
  Alert,
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
import { ProjectStatusBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type { Client, Project, ProjectStatus } from "../../lib/types";
import { formatDate } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ProjectResponse = { projects: Project[] };
type ClientResponse = { clients: Client[] };

export function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const membership = useActiveMembership();
  const [searchParams] = useSearchParams();
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

  const queryClientId = searchParams.get("clientId") ?? "";
  const queryNew = searchParams.get("new") === "1";

  const [projects, setProjects] = useState<Project[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [clientFilter, setClientFilter] = useState(queryClientId);

  const [showCreate, setShowCreate] = useState(
    Boolean(queryClientId || queryNew) && canManageProjects,
  );
  const [createClientId, setCreateClientId] = useState(queryClientId);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [deadline, setDeadline] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!organizationId || !canViewProjects) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);

    const requests: Promise<unknown>[] = [
      api.get<ProjectResponse>(`/organizations/${organizationId}/projects`),
    ];
    if (canViewClients) {
      requests.push(api.get<ClientResponse>(`/organizations/${organizationId}/clients`));
    }

    Promise.all(requests)
      .then(([projectResponse, clientResponse]) => {
        if (!active) return;
        setProjects((projectResponse as ProjectResponse).projects);
        if (clientResponse) {
          setClients((clientResponse as ClientResponse).clients);
        }
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
  }, [organizationId, canViewProjects, canViewClients]);

  const activeClients = clients.filter((client) => client.status === "ACTIVE");

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return projects.filter((project) => {
      if (statusFilter !== "ALL" && project.status !== statusFilter) return false;
      if (clientFilter && project.client.id !== clientFilter) return false;
      if (!query) return true;
      return (
        project.name.toLowerCase().includes(query) ||
        project.client.name.toLowerCase().includes(query)
      );
    });
  }, [projects, search, statusFilter, clientFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setCreating(true);
    setCreateError(null);
    setFieldErrors({});

    try {
      const response = await api.post<{ project: Project }>(
        `/organizations/${organizationId}/projects`,
        {
          clientId: createClientId,
          name,
          description,
          ...(startDate ? { startDate } : {}),
          ...(deadline ? { deadline } : {}),
        },
      );
      navigate(`/orgs/${organizationId}/projects/${response.project.id}`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setCreating(false);
    }
  }

  if (!membership || !user) return null;

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production workspace"
        title="Projects"
        description={
          canManageProjects
            ? "Every client engagement, its schedule, and the production team assigned to it."
            : "Projects you're assigned to, with client context and delivery dates."
        }
        actions={
          canManageProjects ? (
            <Button
              onClick={() => setShowCreate((value) => !value)}
              icon={<Plus className="size-4" />}
              disabled={activeClients.length === 0}
            >
              New project
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
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink-900">New project</h2>
            <p className="text-xs text-ink-500">
              Projects belong to one client and can have a dedicated internal team.
            </p>
          </div>

          {createError ? (
            <div className="mt-4">
              <Alert tone="error">{createError}</Alert>
            </div>
          ) : null}

          {activeClients.length === 0 ? (
            <div className="mt-4">
              <Alert tone="warning">
                Create an active client before starting a project.{" "}
                <Link
                  to={`/orgs/${membership.organization.id}/clients`}
                  className="font-medium underline underline-offset-2"
                >
                  Go to clients
                </Link>
              </Alert>
            </div>
          ) : (
            <form className="mt-4 space-y-4" onSubmit={handleCreate}>
              <div className="grid gap-4 sm:grid-cols-2">
                <FormField label="Client" htmlFor="project-client" error={fieldErrors.clientId}>
                  <Select
                    id="project-client"
                    value={createClientId}
                    onChange={(event) => setCreateClientId(event.target.value)}
                    required
                  >
                    <option value="">Select a client</option>
                    {activeClients.map((client) => (
                      <option key={client.id} value={client.id}>
                        {client.name}
                      </option>
                    ))}
                  </Select>
                </FormField>
                <FormField label="Project name" htmlFor="project-name" error={fieldErrors.name}>
                  <Input
                    id="project-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Podcast Season 2"
                    maxLength={160}
                    required
                  />
                </FormField>
                <FormField label="Start date" htmlFor="project-start" error={fieldErrors.startDate}>
                  <Input
                    id="project-start"
                    type="date"
                    value={startDate}
                    onChange={(event) => setStartDate(event.target.value)}
                  />
                </FormField>
                <FormField label="Deadline" htmlFor="project-deadline" error={fieldErrors.deadline}>
                  <Input
                    id="project-deadline"
                    type="date"
                    value={deadline}
                    onChange={(event) => setDeadline(event.target.value)}
                  />
                </FormField>
              </div>
              <FormField
                label="Brief"
                htmlFor="project-description"
                error={fieldErrors.description}
              >
                <Textarea
                  id="project-description"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  placeholder="Scope, deliverables, and delivery context for the team…"
                  maxLength={10_000}
                />
              </FormField>
              <div className="flex items-center gap-2">
                <Button type="submit" loading={creating} icon={<Plus className="size-4" />}>
                  Create project
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
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search projects or clients"
              aria-label="Search projects"
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | ProjectStatus)}
            className="lg:w-40"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="PAUSED">Paused</option>
            <option value="COMPLETED">Completed</option>
          </Select>
          {canViewClients ? (
            <Select
              aria-label="Filter by client"
              value={clientFilter}
              onChange={(event) => setClientFilter(event.target.value)}
              className="lg:w-52"
            >
              <option value="">All clients</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name}
                </option>
              ))}
            </Select>
          ) : null}
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[0, 1, 2, 3].map((index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-xl border border-cream-200 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title={projects.length === 0 ? "No projects yet" : "No projects match those filters"}
            description={
              projects.length === 0
                ? canManageProjects
                  ? "Create a project for one of your clients to start production planning."
                  : "You haven't been added to a project yet. A project manager can assign you."
                : "Try a different search term, status, or client."
            }
            action={
              projects.length === 0 && canManageProjects && activeClients.length > 0 ? (
                <Button onClick={() => setShowCreate(true)} icon={<Plus className="size-4" />}>
                  New project
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {filtered.map((project) => (
            <Link
              key={project.id}
              to={`/orgs/${membership.organization.id}/projects/${project.id}`}
              className="group rounded-xl border border-cream-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-cream-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0 space-y-1">
                  <p className="truncate font-display text-xl leading-tight text-ink-900">
                    {project.name}
                  </p>
                  <p className="flex items-center gap-1.5 text-xs text-ink-500">
                    <Building2 className="size-3.5 text-ink-400" aria-hidden="true" />
                    {project.client.name}
                  </p>
                </div>
                <ProjectStatusBadge status={project.status} />
              </div>

              <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-ink-500">
                {project.description ?? "No brief added yet."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-cream-200 pt-3 text-[11px] text-ink-500">
                <span className="flex items-center gap-1.5">
                  <Users className="size-3.5 text-ink-400" aria-hidden="true" />
                  {project.memberCount} team {project.memberCount === 1 ? "member" : "members"}
                </span>
                {project.deadline ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarDays className="size-3.5 text-ink-400" aria-hidden="true" />
                    Due {formatDate(project.deadline)}
                  </span>
                ) : null}
                <span className="ml-auto inline-flex items-center gap-1 font-medium text-ink-500 transition group-hover:text-accent-600">
                  Open project
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading projects…
        </div>
      ) : null}
    </div>
  );
}
