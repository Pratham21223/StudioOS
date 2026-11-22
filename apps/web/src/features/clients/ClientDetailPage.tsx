import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Archive,
  Building2,
  CalendarClock,
  Check,
  Copy,
  FolderKanban,
  Mail,
  MailPlus,
  RotateCcw,
  Save,
  ShieldAlert,
  Users,
} from "lucide-react";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
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
  Spinner,
  Textarea,
} from "../../components/ui";
import { ClientStatusBadge, ProjectStatusBadge } from "../../components/status";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type { Client, ClientMember, Invitation, Project } from "../../lib/types";
import { formatDate } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type ClientResponse = { client: Client };
type MemberResponse = { members: ClientMember[] };
type InvitationResponse = { invitations: Invitation[] };
type ProjectResponse = { projects: Project[] };
type InvitationCreateResponse = { invitation: Invitation; inviteUrl?: string };

const emptyForm = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  notes: "",
  brandGuidelines: "",
};

export function ClientDetailPage() {
  const { clientId = "" } = useParams<{ clientId: string }>();
  const { user } = useAuth();
  const membership = useActiveMembership();
  const organizationId = membership?.organization.id;
  const canViewClients = membership
    ? hasPermission(membership.role, PERMISSIONS.CLIENTS_VIEW)
    : false;
  const canManageClients = membership
    ? hasPermission(membership.role, PERMISSIONS.CLIENTS_MANAGE)
    : false;

  const [client, setClient] = useState<Client | null>(null);
  const [members, setMembers] = useState<ClientMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    inviteUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!organizationId || !clientId || !canViewClients) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setLoadError(null);
    try {
      const [clientResponse, memberResponse, invitationResponse, projectResponse] =
        await Promise.all([
          api.get<ClientResponse>(`/organizations/${organizationId}/clients/${clientId}`),
          api.get<MemberResponse>(`/organizations/${organizationId}/clients/${clientId}/members`),
          api.get<InvitationResponse>(
            `/organizations/${organizationId}/clients/${clientId}/invitations`,
          ),
          api.get<ProjectResponse>(
            `/organizations/${organizationId}/projects?clientId=${clientId}`,
          ),
        ]);

      setClient(clientResponse.client);
      setMembers(memberResponse.members);
      setInvitations(invitationResponse.invitations);
      setProjects(projectResponse.projects);
      setForm({
        name: clientResponse.client.name,
        contactName: clientResponse.client.contactName ?? "",
        email: clientResponse.client.email ?? "",
        phone: clientResponse.client.phone ?? "",
        website: clientResponse.client.website ?? "",
        notes: clientResponse.client.notes ?? "",
        brandGuidelines: clientResponse.client.brandGuidelines ?? "",
      });
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [organizationId, clientId, canViewClients]);

  useEffect(() => {
    void load();
  }, [load]);

  async function handleSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setSaving(true);
    setSaveError(null);
    setFieldErrors({});
    setNotice(null);

    try {
      const response = await api.patch<ClientResponse>(
        `/organizations/${organizationId}/clients/${clientId}`,
        form,
      );
      setClient(response.client);
      setNotice("Client profile saved.");
    } catch (error) {
      setSaveError(getErrorMessage(error));
      setFieldErrors(getFieldErrors(error));
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!organizationId || !client) return;
    const nextStatus = client.status === "ACTIVE" ? "ARCHIVED" : "ACTIVE";
    if (
      nextStatus === "ARCHIVED" &&
      !window.confirm(
        "Archive this client? Existing projects stay intact, but new projects and portal invitations will be blocked.",
      )
    ) {
      return;
    }

    setArchiving(true);
    setSaveError(null);
    setNotice(null);
    try {
      const response = await api.patch<ClientResponse>(
        `/organizations/${organizationId}/clients/${clientId}`,
        { status: nextStatus },
      );
      setClient(response.client);
      setNotice(
        nextStatus === "ARCHIVED"
          ? "Client archived. New projects and invitations are blocked."
          : "Client restored to active.",
      );
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setArchiving(false);
    }
  }

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setInviting(true);
    setInviteError(null);
    setNotice(null);
    try {
      const response = await api.post<InvitationCreateResponse>(
        `/organizations/${organizationId}/clients/${clientId}/invitations`,
        { email: inviteEmail },
      );
      setLastInvite({
        email: response.invitation.email,
        inviteUrl: response.inviteUrl,
      });
      setNotice(`Client portal invitation prepared for ${response.invitation.email}.`);
      setInviteEmail("");
      setCopied(false);
      await load();
    } catch (error) {
      setInviteError(getErrorMessage(error));
    } finally {
      setInviting(false);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setInviteError("Could not copy automatically. Select the link and copy it manually.");
    }
  }

  async function updateMember(member: ClientMember) {
    if (!organizationId) return;
    const nextStatus = member.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE";
    if (
      nextStatus === "DEACTIVATED" &&
      !window.confirm(
        `Deactivate portal access for ${member.user.name}? They will lose access to this client immediately.`,
      )
    ) {
      return;
    }

    setBusyMemberId(member.id);
    setNotice(null);
    setSaveError(null);
    try {
      const response = await api.patch<{ member: ClientMember }>(
        `/organizations/${organizationId}/clients/${clientId}/members/${member.id}`,
        { status: nextStatus },
      );
      setMembers((current) =>
        current.map((item) => (item.id === response.member.id ? response.member : item)),
      );
      setNotice(
        nextStatus === "ACTIVE"
          ? `${response.member.user.name}'s portal access was restored.`
          : `${response.member.user.name}'s portal access was deactivated.`,
      );
    } catch (error) {
      setSaveError(getErrorMessage(error));
    } finally {
      setBusyMemberId(null);
    }
  }

  if (!membership || !user) return null;

  if (!canViewClients) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Client directory" title="Client details" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Client details are restricted"
            description="Only admins and project managers can view client profiles and portal contacts."
          />
        </Card>
      </div>
    );
  }

  if (!loading && (loadError || !client)) {
    return (
      <div className="space-y-6">
        <Link
          to={`/orgs/${membership.organization.id}/clients`}
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
        >
          <ArrowLeft className="size-4" /> Back to clients
        </Link>
        <Card>
          <EmptyState
            icon={<Building2 className="size-5" />}
            title="Client not available"
            description={loadError ?? "This client could not be found in the current workspace."}
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

  if (loading || !client) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner /> Loading client…
      </div>
    );
  }

  const activeMembers = members.filter((member) => member.status === "ACTIVE").length;

  return (
    <div className="space-y-6">
      <Link
        to={`/orgs/${membership.organization.id}/clients`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to clients
      </Link>

      <PageHeader
        eyebrow="Client profile"
        title={client.name}
        description={client.email ?? "No primary contact email on file."}
        actions={
          <div className="flex items-center gap-2">
            <ClientStatusBadge status={client.status} />
            {canManageClients ? (
              <Button
                variant={client.status === "ACTIVE" ? "danger" : "secondary"}
                loading={archiving}
                onClick={() => void toggleArchive()}
                icon={
                  client.status === "ACTIVE" ? (
                    <Archive className="size-4" />
                  ) : (
                    <RotateCcw className="size-4" />
                  )
                }
              >
                {client.status === "ACTIVE" ? "Archive" : "Restore"}
              </Button>
            ) : null}
          </div>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {saveError ? <Alert tone="error">{saveError}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">Client profile</h2>
              <p className="text-xs text-ink-500">
                Contact details and brand context used by the production team.
              </p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSave}>
            <FormField label="Client name" htmlFor="client-name" error={fieldErrors.name}>
              <Input
                id="client-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                maxLength={160}
                required
              />
            </FormField>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                label="Contact name"
                htmlFor="client-contact"
                error={fieldErrors.contactName}
              >
                <Input
                  id="client-contact"
                  value={form.contactName}
                  onChange={(event) => setForm({ ...form, contactName: event.target.value })}
                  maxLength={120}
                />
              </FormField>
              <FormField label="Contact email" htmlFor="client-email" error={fieldErrors.email}>
                <Input
                  id="client-email"
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                  maxLength={320}
                />
              </FormField>
              <FormField label="Phone" htmlFor="client-phone" error={fieldErrors.phone}>
                <Input
                  id="client-phone"
                  value={form.phone}
                  onChange={(event) => setForm({ ...form, phone: event.target.value })}
                  maxLength={40}
                />
              </FormField>
              <FormField label="Website" htmlFor="client-website" error={fieldErrors.website}>
                <Input
                  id="client-website"
                  type="url"
                  value={form.website}
                  onChange={(event) => setForm({ ...form, website: event.target.value })}
                  maxLength={255}
                />
              </FormField>
            </div>
            <FormField label="Internal notes" htmlFor="client-notes" error={fieldErrors.notes}>
              <Textarea
                id="client-notes"
                value={form.notes}
                onChange={(event) => setForm({ ...form, notes: event.target.value })}
                maxLength={10_000}
                placeholder="Account context, key stakeholders, working preferences…"
              />
            </FormField>
            <FormField
              label="Brand guidelines"
              htmlFor="client-brand"
              error={fieldErrors.brandGuidelines}
              hint="Visible to internal members only. Client portal access is separate."
            >
              <Textarea
                id="client-brand"
                value={form.brandGuidelines}
                onChange={(event) => setForm({ ...form, brandGuidelines: event.target.value })}
                maxLength={20_000}
                placeholder="Tone, colours, typography, do's and don'ts…"
              />
            </FormField>

            <div className="flex items-center gap-2 border-t border-cream-200 pt-4">
              <Button
                type="submit"
                loading={saving}
                icon={<Save className="size-4" />}
                disabled={!canManageClients}
              >
                Save profile
              </Button>
              {!canManageClients ? (
                <span className="text-xs text-ink-500">Read-only for your role.</span>
              ) : null}
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Client snapshot</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <FolderKanban className="size-4 text-ink-400" /> Projects
                </dt>
                <dd className="font-medium text-ink-900">{client.projectCount}</dd>
              </div>
              <div className="flex items-center justify-between gap-3 border-b border-cream-200 pb-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <Users className="size-4 text-ink-400" /> Portal contacts
                </dt>
                <dd className="font-medium text-ink-900">{activeMembers}</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="flex items-center gap-2 text-ink-500">
                  <CalendarClock className="size-4 text-ink-400" /> Added
                </dt>
                <dd className="text-ink-800">{formatDate(client.createdAt)}</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <Mail className="size-4 text-ink-400" aria-hidden="true" />
              <h2 className="font-display text-xl tracking-tight text-ink-900">Portal access</h2>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Client contacts can only see this client&apos;s projects and submitted deliverables.
            </p>

            {canManageClients ? (
              <form className="mt-4 space-y-3" onSubmit={handleInvite}>
                <FormField label="Invite a contact" htmlFor="portal-email">
                  <Input
                    id="portal-email"
                    type="email"
                    placeholder="client@company.com"
                    value={inviteEmail}
                    onChange={(event) => setInviteEmail(event.target.value)}
                    required
                    disabled={client.status !== "ACTIVE"}
                  />
                </FormField>
                {inviteError ? <Alert tone="error">{inviteError}</Alert> : null}
                {client.status !== "ACTIVE" ? (
                  <p className="text-xs text-ink-500">
                    Restore this client before inviting portal contacts.
                  </p>
                ) : (
                  <Button
                    type="submit"
                    variant="secondary"
                    loading={inviting}
                    icon={<MailPlus className="size-4" />}
                    className="w-full"
                  >
                    Create portal invite
                  </Button>
                )}
              </form>
            ) : null}

            {lastInvite ? (
              <div className="mt-4 rounded-lg border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-3">
                <p className="text-xs font-medium text-ink-800">{lastInvite.email}</p>
                {lastInvite.inviteUrl ? (
                  <div className="mt-2 space-y-2">
                    <Input
                      readOnly
                      value={lastInvite.inviteUrl}
                      aria-label="Client invitation link"
                      className="font-mono text-[11px]"
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={() => void copyInviteLink(lastInvite.inviteUrl!)}
                      icon={copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                ) : (
                  <p className="mt-1 text-[11px] text-ink-500">
                    Invite created. Email delivery arrives in a later milestone.
                  </p>
                )}
              </div>
            ) : null}

            <div className="mt-5 border-t border-cream-200 pt-4">
              <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
                Contacts
              </h3>
              {members.length === 0 ? (
                <p className="mt-2 text-xs text-ink-500">No portal contacts yet.</p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {members.map((member) => (
                    <li
                      key={member.id}
                      className="flex items-center gap-2.5 rounded-lg border border-cream-200 px-2.5 py-2"
                    >
                      <Avatar name={member.user.name} className="size-7 text-[10px]" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-xs font-medium text-ink-800">
                          {member.user.name}
                        </p>
                        <p className="truncate text-[10px] text-ink-500">{member.user.email}</p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        <Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>
                          {member.status === "ACTIVE" ? "Active" : "Off"}
                        </Badge>
                        {canManageClients ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="px-1.5"
                            disabled={busyMemberId === member.id}
                            onClick={() => void updateMember(member)}
                          >
                            {busyMemberId === member.id ? (
                              <Spinner className="size-3.5" />
                            ) : member.status === "ACTIVE" ? (
                              "Disable"
                            ) : (
                              "Enable"
                            )}
                          </Button>
                        ) : null}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {invitations.length > 0 ? (
              <div className="mt-5 border-t border-cream-200 pt-4">
                <h3 className="text-xs font-semibold uppercase tracking-[0.12em] text-ink-400">
                  Pending invitations
                </h3>
                <ul className="mt-2 space-y-1.5">
                  {invitations.map((invitation) => (
                    <li
                      key={invitation.id}
                      className="flex items-center justify-between gap-2 text-xs text-ink-600"
                    >
                      <span className="truncate">{invitation.email}</span>
                      <span className="shrink-0 text-[10px] text-ink-400">
                        {formatDate(invitation.expiresAt)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink-900">Projects</h2>
            <p className="text-xs text-ink-500">
              {projects.length} {projects.length === 1 ? "project" : "projects"} for this client
            </p>
          </div>
          {canManageClients && client.status === "ACTIVE" ? (
            <Link
              to={`/orgs/${membership.organization.id}/projects?clientId=${client.id}`}
              className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3.5 py-2 text-xs font-medium text-cream-50 transition hover:bg-ink-800"
            >
              New project <ArrowRight className="size-3.5" />
            </Link>
          ) : null}
        </div>

        {projects.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="size-5" />}
            title="No projects for this client"
            description="Create a project from the projects workspace to begin production."
          />
        ) : (
          <ul className="divide-y divide-cream-200">
            {projects.map((project) => (
              <li key={project.id}>
                <Link
                  to={`/orgs/${membership.organization.id}/projects/${project.id}`}
                  className="flex flex-col gap-2 px-5 py-3.5 transition hover:bg-cream-50 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-500">
                      <FolderKanban className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-ink-900">{project.name}</p>
                      <p className="text-xs text-ink-500">
                        {project.memberCount} team{" "}
                        {project.memberCount === 1 ? "member" : "members"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 pl-11 sm:pl-0">
                    {project.deadline ? (
                      <span className="text-xs text-ink-500">
                        Due {formatDate(project.deadline)}
                      </span>
                    ) : null}
                    <ProjectStatusBadge status={project.status} />
                    <ArrowRight className="size-4 text-ink-400" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
