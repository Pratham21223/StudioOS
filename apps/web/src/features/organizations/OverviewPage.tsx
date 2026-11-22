import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Circle,
  Clapperboard,
  Clock3,
  FolderKanban,
  MailPlus,
  ShieldCheck,
  Users,
} from "lucide-react";
import { ORG_ROLES, ORG_ROLE_DESCRIPTIONS, PERMISSIONS, hasPermission } from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import { Avatar, Badge, Card } from "../../components/ui";
import { api } from "../../lib/api";
import type { Invitation, Member, Project } from "../../lib/types";
import { cn, firstName, greet, roleLabel } from "../../lib/utils";
import { useActiveMembership } from "./useActiveMembership";

type MemberListResponse = { members: Member[] };
type InvitationListResponse = { invitations: Invitation[] };
type ProjectListResponse = { projects: Project[] };

const foundation = [
  {
    title: "Secure sessions",
    body: "Opaque session tokens hashed at rest, HTTP-only cookies, CSRF checks.",
    done: true,
  },
  {
    title: "Tenant isolation",
    body: "Every workspace request re-resolves membership and role server-side.",
    done: true,
  },
  {
    title: "Invitations & roles",
    body: "Hashed single-use invites, last-admin safeguards, audited role changes.",
    done: true,
  },
  {
    title: "Clients & projects",
    body: "Client profiles, portal contacts, project scopes, and production teams.",
    done: true,
  },
  {
    title: "Content workflow",
    body: "Fixed brief-to-publish state machine with transactional transition history.",
    done: true,
  },
  {
    title: "Tasks & Kanban",
    body: "Assignments, statuses, priorities, filters, and overdue views.",
    done: true,
  },
  {
    title: "Assets & approvals",
    body: "Uploads, client portal review, and version-aware approval.",
    done: false,
  },
];

export function OverviewPage() {
  const { user } = useAuth();
  const membership = useActiveMembership();
  const [members, setMembers] = useState<Member[] | null>(null);
  const [invitations, setInvitations] = useState<Invitation[] | null>(null);
  const [projects, setProjects] = useState<Project[] | null>(null);

  const canViewMembers = membership
    ? hasPermission(membership.role, PERMISSIONS.MEMBERS_VIEW)
    : false;
  const canInvite = membership ? hasPermission(membership.role, PERMISSIONS.MEMBERS_INVITE) : false;
  const canViewProjects = membership
    ? hasPermission(membership.role, PERMISSIONS.PROJECTS_VIEW)
    : false;
  const canManageProjects = membership
    ? hasPermission(membership.role, PERMISSIONS.PROJECTS_MANAGE)
    : false;
  const canViewContent = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;

  const organizationId = membership?.organization.id;

  useEffect(() => {
    if (!organizationId || !canViewMembers) return;
    let active = true;

    Promise.all([
      api.get<MemberListResponse>(`/organizations/${organizationId}/members`),
      api.get<InvitationListResponse>(`/organizations/${organizationId}/invitations`),
    ])
      .then(([memberResponse, invitationResponse]) => {
        if (!active) return;
        setMembers(memberResponse.members);
        setInvitations(invitationResponse.invitations);
      })
      .catch(() => {
        if (active) {
          setMembers(null);
          setInvitations(null);
        }
      });

    return () => {
      active = false;
    };
  }, [organizationId, canViewMembers]);

  useEffect(() => {
    if (!organizationId || !canViewProjects) return;
    let active = true;

    api
      .get<ProjectListResponse>(`/organizations/${organizationId}/projects`)
      .then((response) => {
        if (active) setProjects(response.projects);
      })
      .catch(() => {
        if (active) setProjects(null);
      });

    return () => {
      active = false;
    };
  }, [organizationId, canViewProjects]);

  if (!user || !membership) return null;

  const activeMembers = members?.filter((member) => member.status === "ACTIVE").length;
  const pendingInvitations = invitations?.length;
  const activeProjects = projects?.filter((project) => project.status === "ACTIVE").length;

  return (
    <div className="space-y-7">
      <section className="studio-grid relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-7 text-cream-50 shadow-card sm:px-8 sm:py-9">
        <div className="studio-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-2xl space-y-4">
            <Badge tone="accent" className="border-accent-400/20 bg-accent-500/10 text-accent-400">
              Milestone 3 · Workflow & tasks live
            </Badge>
            <div className="space-y-2">
              <h1 className="font-display text-4xl leading-[1.05] tracking-tight sm:text-5xl">
                {greet()}, {firstName(user.name)}.
              </h1>
              <p className="max-w-xl text-sm leading-relaxed text-ink-300">
                Deliverables move through a fixed production workflow while tasks keep the team
                aligned. Assets, client review, and approvals are next.
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
            ) : canViewProjects ? (
              <Link
                to={`/orgs/${membership.organization.id}/projects`}
                className="inline-flex items-center gap-2 rounded-lg border border-white/15 bg-white/5 px-4 py-2.5 text-sm font-medium text-cream-100 transition hover:bg-white/10"
              >
                <FolderKanban className="size-4" aria-hidden="true" />
                View projects
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
              Active team
            </p>
            <span className="grid size-8 place-items-center rounded-lg bg-cream-100 text-ink-500">
              <Users className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-display text-4xl tracking-tight text-ink-900">
            {canViewMembers ? (activeMembers ?? "—") : "Private"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {canViewMembers
              ? "Active internal members in this workspace"
              : "Member directory is limited to admins and project managers"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
              Active projects
            </p>
            <span className="grid size-8 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
              <FolderKanban className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-display text-4xl tracking-tight text-ink-900">
            {activeProjects ?? "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">
            {canManageProjects ? "In production across all clients" : "Projects assigned to you"}
          </p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
              Pending invitations
            </p>
            <span className="grid size-8 place-items-center rounded-lg bg-amber-100 text-amber-700">
              <Clock3 className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-display text-4xl tracking-tight text-ink-900">
            {canViewMembers ? (pendingInvitations ?? "—") : "—"}
          </p>
          <p className="mt-1 text-xs text-ink-500">Unaccepted, unexpired workspace invites</p>
        </Card>

        <Card className="p-5">
          <div className="flex items-start justify-between">
            <p className="text-xs font-medium uppercase tracking-[0.12em] text-ink-400">
              Your access
            </p>
            <span className="grid size-8 place-items-center rounded-lg bg-moss-100 text-moss-500">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </span>
          </div>
          <p className="mt-3 font-display text-2xl tracking-tight text-ink-900">
            {roleLabel(membership.role)}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            {ORG_ROLE_DESCRIPTIONS[membership.role]}
          </p>
        </Card>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between border-b border-cream-200 px-5 py-4">
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">
                Foundation status
              </h2>
              <p className="text-xs text-ink-500">What this milestone delivered</p>
            </div>
            <Badge tone="success">Verified</Badge>
          </div>
          <ul className="divide-y divide-cream-200">
            {foundation.map((item) => (
              <li key={item.title} className="flex items-start gap-3 px-5 py-4">
                {item.done ? (
                  <CheckCircle2
                    className="mt-0.5 size-5 shrink-0 text-moss-500"
                    aria-hidden="true"
                  />
                ) : (
                  <Circle className="mt-0.5 size-5 shrink-0 text-cream-300" aria-hidden="true" />
                )}
                <div className="space-y-0.5">
                  <p
                    className={cn(
                      "text-sm font-medium",
                      item.done ? "text-ink-800" : "text-ink-500",
                    )}
                  >
                    {item.title}
                  </p>
                  <p className="text-xs leading-relaxed text-ink-500">{item.body}</p>
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card className="min-w-0 p-5">
          <div className="flex items-center gap-2">
            <Building2 className="size-4 text-ink-400" aria-hidden="true" />
            <h2 className="font-display text-xl tracking-tight text-ink-900">Access model</h2>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-ink-500">
            Roles are resolved from your membership on every request. The browser never supplies its
            own permissions.
          </p>
          <div className="mt-4 space-y-2.5">
            {ORG_ROLES.map((role) => (
              <div
                key={role}
                className={cn(
                  "flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5",
                  role === membership.role
                    ? "border-accent-500/20 bg-accent-500/[0.05]"
                    : "border-cream-200 bg-cream-50/60",
                )}
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <Avatar name={roleLabel(role)} className="size-7 text-[10px]" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink-800">{roleLabel(role)}</p>
                    <p className="line-clamp-2 text-[10px] leading-snug text-ink-400">
                      {ORG_ROLE_DESCRIPTIONS[role]}
                    </p>
                  </div>
                </div>
                {role === membership.role ? (
                  <Badge tone="accent" className="shrink-0">
                    You
                  </Badge>
                ) : null}
              </div>
            ))}
          </div>
          {canInvite ? (
            <Link
              to={`/orgs/${membership.organization.id}/members`}
              className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-accent-600 transition hover:text-accent-700"
            >
              Manage roles and invitations
              <ArrowRight className="size-3.5" aria-hidden="true" />
            </Link>
          ) : null}
        </Card>
      </div>
    </div>
  );
}
