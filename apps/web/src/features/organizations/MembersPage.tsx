import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Check, Copy, MailPlus, RefreshCw, ShieldAlert, UserPlus, Users } from "lucide-react";
import { ORG_ROLES, PERMISSIONS, hasPermission, type OrgRole } from "@studioos/shared";
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
} from "../../components/ui";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type { CreateInvitationResponse, Invitation, Member } from "../../lib/types";
import { formatDate, roleLabel } from "../../lib/utils";
import { useActiveMembership } from "./useActiveMembership";

type MemberListResponse = { members: Member[] };
type InvitationListResponse = { invitations: Invitation[] };

const ROLE_ORDER: Record<OrgRole, number> = {
  ADMIN: 0,
  PROJECT_MANAGER: 1,
  PRODUCER: 2,
  EDITOR: 3,
};

function sortMembers(members: Member[]): Member[] {
  return [...members].sort((left, right) => {
    if (left.status !== right.status) return left.status === "ACTIVE" ? -1 : 1;
    const roleDifference = ROLE_ORDER[left.role] - ROLE_ORDER[right.role];
    if (roleDifference !== 0) return roleDifference;
    return left.user.name.localeCompare(right.user.name);
  });
}

export function MembersPage() {
  const { user, refresh } = useAuth();
  const membership = useActiveMembership();
  const organizationId = membership?.organization.id;
  const canViewMembers = membership
    ? hasPermission(membership.role, PERMISSIONS.MEMBERS_VIEW)
    : false;
  const canInvite = membership ? hasPermission(membership.role, PERMISSIONS.MEMBERS_INVITE) : false;
  const canManage = membership ? hasPermission(membership.role, PERMISSIONS.MEMBERS_MANAGE) : false;

  const [members, setMembers] = useState<Member[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<OrgRole>("EDITOR");
  const [inviting, setInviting] = useState(false);
  const [inviteErrors, setInviteErrors] = useState<Record<string, string>>({});
  const [lastInvite, setLastInvite] = useState<{
    email: string;
    role: OrgRole;
    inviteUrl?: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    if (!organizationId || !canViewMembers) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const [memberResponse, invitationResponse] = await Promise.all([
        api.get<MemberListResponse>(`/organizations/${organizationId}/members`),
        api.get<InvitationListResponse>(`/organizations/${organizationId}/invitations`),
      ]);
      setMembers(sortMembers(memberResponse.members));
      setInvitations(invitationResponse.invitations);
    } catch (error) {
      setLoadError(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  }, [organizationId, canViewMembers]);

  useEffect(() => {
    void load();
  }, [load]);

  const activeCount = useMemo(
    () => members.filter((member) => member.status === "ACTIVE").length,
    [members],
  );

  async function handleInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!organizationId) return;

    setInviting(true);
    setInviteErrors({});
    setActionError(null);
    setNotice(null);

    try {
      const response = await api.post<CreateInvitationResponse>(
        `/organizations/${organizationId}/invitations`,
        { email: inviteEmail, role: inviteRole },
      );
      setLastInvite({
        email: response.invitation.email,
        role: response.invitation.role ?? inviteRole,
        inviteUrl: response.inviteUrl,
      });
      setNotice(`Invitation prepared for ${response.invitation.email}.`);
      setInviteEmail("");
      setCopied(false);
      await load();
    } catch (error) {
      setActionError(getErrorMessage(error));
      setInviteErrors(getFieldErrors(error));
    } finally {
      setInviting(false);
    }
  }

  async function resendInvitation(invitation: Invitation) {
    if (!organizationId || !invitation.role) return;
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.post<CreateInvitationResponse>(
        `/organizations/${organizationId}/invitations`,
        { email: invitation.email, role: invitation.role },
      );
      setLastInvite({
        email: response.invitation.email,
        role: response.invitation.role ?? invitation.role,
        inviteUrl: response.inviteUrl,
      });
      setNotice(`A fresh invitation link was created for ${response.invitation.email}.`);
      setCopied(false);
      await load();
    } catch (error) {
      setActionError(getErrorMessage(error));
    }
  }

  async function updateMember(
    member: Member,
    patch: { role?: OrgRole; status?: "ACTIVE" | "DEACTIVATED" },
  ) {
    if (!organizationId) return;
    if (
      patch.status === "DEACTIVATED" &&
      !window.confirm(
        `Deactivate ${member.user.name}? They will lose access to this workspace immediately.`,
      )
    ) {
      return;
    }

    setBusyMemberId(member.id);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.patch<{ member: Member }>(
        `/organizations/${organizationId}/members/${member.id}`,
        patch,
      );
      setMembers((current) =>
        sortMembers(
          current.map((item) => (item.id === response.member.id ? response.member : item)),
        ),
      );
      setNotice(
        patch.status === "DEACTIVATED"
          ? `${response.member.user.name}'s access was deactivated.`
          : patch.status === "ACTIVE"
            ? `${response.member.user.name}'s access was restored.`
            : `${response.member.user.name}'s role is now ${roleLabel(response.member.role)}.`,
      );
      if (response.member.user.id === user?.id) {
        await refresh();
      }
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setBusyMemberId(null);
    }
  }

  async function copyInviteLink(url: string) {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError("Could not copy automatically. Select the link and copy it manually.");
    }
  }

  if (!membership || !user) return null;

  if (!canViewMembers) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace directory"
          title="Members"
          description="Team access is managed by workspace admins and project managers."
        />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Member directory is restricted"
            description="Your role doesn't include access to the internal member directory. Ask an admin if you need to review team access."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace directory"
        title="Members"
        description="Manage internal access, roles, and pending invitations. Every change is authorized on the server."
        actions={
          <Badge tone="success">
            <Users className="size-3" aria-hidden="true" />
            {activeCount} active
          </Badge>
        }
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      {canInvite ? (
        <Card className="p-5">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
              <UserPlus className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">
                Invite a teammate
              </h2>
              <p className="text-xs leading-relaxed text-ink-500">
                They&apos;ll join this workspace with the role you choose. Invitations expire and
                can only be used once.
              </p>
            </div>
          </div>

          <form
            className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_11rem_auto] sm:items-start"
            onSubmit={handleInvite}
          >
            <FormField label="Email address" htmlFor="invite-email" error={inviteErrors.email}>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                placeholder="teammate@studio.com"
                value={inviteEmail}
                onChange={(event) => setInviteEmail(event.target.value)}
                required
              />
            </FormField>

            <FormField label="Role" htmlFor="invite-role" error={inviteErrors.role}>
              <Select
                id="invite-role"
                value={inviteRole}
                onChange={(event) => setInviteRole(event.target.value as OrgRole)}
              >
                {ORG_ROLES.map((role) => (
                  <option key={role} value={role}>
                    {roleLabel(role)}
                  </option>
                ))}
              </Select>
            </FormField>

            <div className="sm:pt-[1.625rem]">
              <Button
                type="submit"
                className="w-full sm:w-auto"
                loading={inviting}
                icon={<MailPlus className="size-4" />}
              >
                Create invite
              </Button>
            </div>
          </form>

          {lastInvite ? (
            <div className="mt-4 rounded-lg border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-3.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-ink-800">
                  Invitation for {lastInvite.email} · {roleLabel(lastInvite.role)}
                </p>
                <Badge tone="accent">Single use</Badge>
              </div>
              {lastInvite.inviteUrl ? (
                <>
                  <p className="mt-1 text-xs text-ink-500">
                    Share this single-use link with the invitee. It expires automatically.
                  </p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <Input
                      readOnly
                      value={lastInvite.inviteUrl}
                      aria-label="Invitation link"
                      className="font-mono text-xs"
                      onFocus={(event) => event.target.select()}
                    />
                    <Button
                      variant="secondary"
                      onClick={() => void copyInviteLink(lastInvite.inviteUrl!)}
                      icon={copied ? <Check className="size-4" /> : <Copy className="size-4" />}
                    >
                      {copied ? "Copied" : "Copy link"}
                    </Button>
                  </div>
                </>
              ) : (
                <p className="mt-1 text-xs leading-relaxed text-ink-500">
                  Invitation created and email queued for delivery.
                </p>
              )}
            </div>
          ) : null}
        </Card>
      ) : (
        <Alert tone="info">
          Project managers can review the member directory. Only workspace admins can invite or
          change access.
        </Alert>
      )}

      {loadError ? (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" size="sm" onClick={() => void load()}>
              Retry
            </Button>
          }
        >
          {loadError}
        </Alert>
      ) : null}

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink-900">Team</h2>
            <p className="text-xs text-ink-500">
              {members.length} {members.length === 1 ? "membership" : "memberships"} in this
              workspace
            </p>
          </div>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void load()}
            disabled={loading}
            icon={<RefreshCw className={loading ? "size-3.5 animate-spin" : "size-3.5"} />}
          >
            Refresh
          </Button>
        </div>

        {loading ? (
          <div className="space-y-3 p-5">
            {[0, 1, 2].map((row) => (
              <div key={row} className="flex animate-pulse items-center gap-3">
                <div className="size-9 rounded-full bg-cream-100" />
                <div className="h-4 flex-1 rounded bg-cream-100" />
                <div className="h-4 w-24 rounded bg-cream-100" />
              </div>
            ))}
          </div>
        ) : loadError ? (
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Couldn't load the team"
            description="The member directory could not be loaded. Check your connection and retry."
            action={
              <Button variant="secondary" size="sm" onClick={() => void load()}>
                Retry
              </Button>
            }
          />
        ) : members.length === 0 ? (
          <EmptyState
            icon={<Users className="size-5" />}
            title="No members yet"
            description="Invite your first teammate to start collaborating."
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-sm">
              <thead>
                <tr className="border-b border-cream-200 bg-cream-50/70 text-[10px] uppercase tracking-[0.14em] text-ink-400">
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Member
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Role
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Status
                  </th>
                  <th scope="col" className="px-5 py-3 font-semibold">
                    Joined
                  </th>
                  {canManage ? (
                    <th scope="col" className="px-5 py-3 text-right font-semibold">
                      Access
                    </th>
                  ) : null}
                </tr>
              </thead>
              <tbody className="divide-y divide-cream-200">
                {members.map((member) => {
                  const isSelf = member.user.id === user.id;
                  const busy = busyMemberId === member.id;
                  return (
                    <tr key={member.id} className="bg-white transition hover:bg-cream-50/50">
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <Avatar name={member.user.name} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-2">
                              <p className="truncate font-medium text-ink-900">
                                {member.user.name}
                              </p>
                              {isSelf ? <Badge tone="accent">You</Badge> : null}
                            </div>
                            <p className="truncate text-xs text-ink-500">{member.user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        {canManage ? (
                          <Select
                            aria-label={`Role for ${member.user.name}`}
                            value={member.role}
                            disabled={busy}
                            onChange={(event) =>
                              void updateMember(member, {
                                role: event.target.value as OrgRole,
                              })
                            }
                            className="h-9 w-44 py-1.5 text-xs"
                          >
                            {ORG_ROLES.map((role) => (
                              <option key={role} value={role}>
                                {roleLabel(role)}
                              </option>
                            ))}
                          </Select>
                        ) : (
                          <span className="text-sm text-ink-700">{roleLabel(member.role)}</span>
                        )}
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={member.status === "ACTIVE" ? "success" : "neutral"}>
                          {member.status === "ACTIVE" ? "Active" : "Deactivated"}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-xs text-ink-500">
                        {formatDate(member.createdAt)}
                      </td>
                      {canManage ? (
                        <td className="px-5 py-3.5 text-right">
                          <Button
                            variant={member.status === "ACTIVE" ? "danger" : "secondary"}
                            size="sm"
                            disabled={busy}
                            onClick={() =>
                              void updateMember(member, {
                                status: member.status === "ACTIVE" ? "DEACTIVATED" : "ACTIVE",
                              })
                            }
                          >
                            {busy ? (
                              <Spinner className="size-3.5" />
                            ) : member.status === "ACTIVE" ? (
                              "Deactivate"
                            ) : (
                              "Reactivate"
                            )}
                          </Button>
                        </td>
                      ) : null}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card className="overflow-hidden">
        <div className="flex items-center justify-between gap-3 border-b border-cream-200 px-5 py-4">
          <div>
            <h2 className="font-display text-xl tracking-tight text-ink-900">
              Pending invitations
            </h2>
            <p className="text-xs text-ink-500">
              Unaccepted invitations that haven&apos;t expired yet
            </p>
          </div>
          <Badge tone={invitations.length > 0 ? "warning" : "neutral"}>
            {invitations.length} pending
          </Badge>
        </div>

        {loading ? (
          <div className="h-24 animate-pulse bg-cream-50" />
        ) : loadError ? (
          <div className="px-5 py-6 text-sm text-ink-500">
            Pending invitations are unavailable until the directory loads.
          </div>
        ) : invitations.length === 0 ? (
          <EmptyState
            icon={<MailPlus className="size-5" />}
            title="No pending invitations"
            description="New invitations will appear here until they are accepted or expire."
          />
        ) : (
          <ul className="divide-y divide-cream-200">
            {invitations.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-col gap-2 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ink-800">{invitation.email}</p>
                  <p className="text-xs text-ink-500">
                    {invitation.role ? roleLabel(invitation.role) : "Member"} · expires{" "}
                    {formatDate(invitation.expiresAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge tone="warning">Pending</Badge>
                  {canInvite ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void resendInvitation(invitation)}
                    >
                      New link
                    </Button>
                  ) : null}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
