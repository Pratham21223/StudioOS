import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  FolderKanban,
  Mail,
  Plus,
  Search,
  ShieldAlert,
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
} from "../../components/ui";
import { ClientStatusBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type { Client, ClientStatus } from "../../lib/types";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ClientListResponse = { clients: Client[] };

export function ClientsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const membership = useActiveMembership();
  const organizationId = membership?.organization.id;
  const canViewClients = membership
    ? hasPermission(membership.role, PERMISSIONS.CLIENTS_VIEW)
    : false;
  const canManageClients = membership
    ? hasPermission(membership.role, PERMISSIONS.CLIENTS_MANAGE)
    : false;

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ClientStatus>("ALL");

  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [contactName, setContactName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [website, setWebsite] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !canViewClients) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);

    api
      .get<ClientListResponse>(`/organizations/${organizationId}/clients`)
      .then((response) => {
        if (active) setClients(response.clients);
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
  }, [organizationId, canViewClients]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return clients.filter((client) => {
      if (statusFilter !== "ALL" && client.status !== statusFilter) return false;
      if (!query) return true;
      return [client.name, client.contactName, client.email]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(query));
    });
  }, [clients, search, statusFilter]);

  async function handleCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setCreating(true);
    setCreateError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const response = await api.post<{ client: Client }>(
        `/organizations/${organizationId}/clients`,
        {
          name,
          contactName,
          email,
          phone,
          website,
        },
      );
      setNotice(`${response.client.name} was created.`);
      setShowCreate(false);
      setName("");
      setContactName("");
      setEmail("");
      setPhone("");
      setWebsite("");
      navigate(`/orgs/${organizationId}/clients/${response.client.id}`);
    } catch (error) {
      setCreateError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setCreating(false);
    }
  }

  if (!membership || !user) return null;

  if (!canViewClients) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Client directory"
          title="Clients"
          description="Client profiles and portal access are managed by admins and project managers."
        />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Client directory is restricted"
            description="Your role doesn't include access to client contact details. You can still view projects assigned to you."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Client directory"
        title="Clients"
        description="Brands and contacts your studio produces for, with portal access and project counts."
        actions={
          canManageClients ? (
            <Button
              onClick={() => setShowCreate((value) => !value)}
              icon={<Plus className="size-4" />}
            >
              New client
            </Button>
          ) : null
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {loadError ? (
        <Alert
          tone="error"
          action={
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setLoading(true);
                setLoadError(null);
                if (organizationId) {
                  api
                    .get<ClientListResponse>(`/organizations/${organizationId}/clients`)
                    .then((response) => setClients(response.clients))
                    .catch((error: unknown) => setLoadError(getErrorMessage(error)))
                    .finally(() => setLoading(false));
                }
              }}
            >
              Retry
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
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">New client</h2>
              <p className="text-xs text-ink-500">
                Create the client profile first; invitations and projects come next.
              </p>
            </div>
          </div>

          {createError ? (
            <div className="mt-4">
              <Alert tone="error">{createError}</Alert>
            </div>
          ) : null}

          <form className="mt-4 space-y-4" onSubmit={handleCreate}>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Client name"
                htmlFor="client-name"
                error={fieldErrors.name}
                className="sm:col-span-2"
              >
                <Input
                  id="client-name"
                  placeholder="Client or brand"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={160}
                  required
                  autoFocus
                />
              </FormField>
              <FormField
                label="Contact name"
                htmlFor="client-contact"
                error={fieldErrors.contactName}
              >
                <Input
                  id="client-contact"
                  placeholder="Jordan Lee"
                  value={contactName}
                  onChange={(event) => setContactName(event.target.value)}
                  maxLength={120}
                />
              </FormField>
              <FormField label="Contact email" htmlFor="client-email" error={fieldErrors.email}>
                <Input
                  id="client-email"
                  type="email"
                  placeholder="hello@client.com"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  maxLength={320}
                />
              </FormField>
              <FormField label="Phone" htmlFor="client-phone" error={fieldErrors.phone}>
                <Input
                  id="client-phone"
                  placeholder="+1 555 0100"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  maxLength={40}
                />
              </FormField>
              <FormField label="Website" htmlFor="client-website" error={fieldErrors.website}>
                <Input
                  id="client-website"
                  type="url"
                  placeholder="https://client.com"
                  value={website}
                  onChange={(event) => setWebsite(event.target.value)}
                  maxLength={255}
                />
              </FormField>
            </div>

            <div className="flex items-center gap-2">
              <Button type="submit" loading={creating} icon={<Plus className="size-4" />}>
                Create client
              </Button>
              <Button variant="ghost" onClick={() => setShowCreate(false)}>
                Cancel
              </Button>
            </div>
          </form>
        </Card>
      ) : null}

      <Card className="p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search clients or contacts"
              aria-label="Search clients"
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter clients by status"
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as "ALL" | ClientStatus)}
            className="sm:w-44"
          >
            <option value="ALL">All statuses</option>
            <option value="ACTIVE">Active</option>
            <option value="ARCHIVED">Archived</option>
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((index) => (
            <div
              key={index}
              className="h-44 animate-pulse rounded-xl border border-cream-200 bg-white"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title={clients.length === 0 ? "No clients yet" : "No clients match those filters"}
            description={
              clients.length === 0
                ? "Create your first client to start organizing projects and client review."
                : "Try a different search term or status filter."
            }
            action={
              clients.length === 0 && canManageClients ? (
                <Button onClick={() => setShowCreate(true)} icon={<Plus className="size-4" />}>
                  New client
                </Button>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((client) => (
            <Link
              key={client.id}
              to={`/orgs/${membership.organization.id}/clients/${client.id}`}
              className="group rounded-xl border border-cream-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-cream-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
                    <Building2 className="size-5" aria-hidden="true" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-display text-lg leading-tight text-ink-900">
                      {client.name}
                    </p>
                    <p className="truncate text-xs text-ink-500">
                      {client.contactName ?? "No contact named"}
                    </p>
                  </div>
                </div>
                <ClientStatusBadge status={client.status} />
              </div>

              <div className="mt-4 space-y-2 text-xs text-ink-500">
                <p className="flex items-center gap-2">
                  <Mail className="size-3.5 text-ink-400" aria-hidden="true" />
                  <span className="truncate">{client.email ?? "No contact email"}</span>
                </p>
                <div className="flex items-center gap-4">
                  <span className="flex items-center gap-1.5">
                    <FolderKanban className="size-3.5 text-ink-400" aria-hidden="true" />
                    {client.projectCount} {client.projectCount === 1 ? "project" : "projects"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Users className="size-3.5 text-ink-400" aria-hidden="true" />
                    {client.memberCount} portal {client.memberCount === 1 ? "contact" : "contacts"}
                  </span>
                </div>
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-cream-200 pt-3">
                <span className="text-[11px] font-medium uppercase tracking-[0.12em] text-ink-400">
                  Open client
                </span>
                <ArrowRight className="size-4 text-ink-400 transition group-hover:translate-x-0.5 group-hover:text-accent-600" />
              </div>
            </Link>
          ))}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading clients…
        </div>
      ) : null}
    </div>
  );
}
