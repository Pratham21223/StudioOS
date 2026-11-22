import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  ChevronDown,
  FolderKanban,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Users,
  X,
} from "lucide-react";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { useAuth } from "../app/AuthProvider";
import { Logo } from "./Logo";
import { Avatar, Badge, Spinner } from "./ui";
import { cn, roleLabel } from "../lib/utils";
import { useActiveMembership } from "../features/organizations/useActiveMembership";

const roadmap = [
  { label: "Clients & projects", milestone: "M2" },
  { label: "Content workflow", milestone: "M3" },
  { label: "Assets & approvals", milestone: "M4" },
];

export function AppShell() {
  const { user, memberships, logout } = useAuth();
  const membership = useActiveMembership();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  if (!membership) {
    return (
      <div className="grid min-h-screen place-items-center bg-cream-50 px-6">
        <div className="w-full max-w-lg rounded-xl border border-cream-200 bg-white p-8 shadow-card">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Workspace access
          </p>
          <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">
            That workspace isn&apos;t available to you.
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-ink-500">
            You may have been removed, your membership may be inactive, or the link is incorrect.
          </p>
          <button
            type="button"
            onClick={() =>
              navigate(memberships[0] ? `/orgs/${memberships[0].organization.id}` : "/no-workspace")
            }
            className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-ink-800"
          >
            {memberships[0] ? "Go to my workspace" : "Continue"}
          </button>
        </div>
      </div>
    );
  }

  const canViewMembers = hasPermission(membership.role, PERMISSIONS.MEMBERS_VIEW);
  const canManageSettings = hasPermission(membership.role, PERMISSIONS.ORGANIZATION_MANAGE);

  const navigation = [
    {
      to: `/orgs/${membership.organization.id}`,
      label: "Overview",
      icon: LayoutDashboard,
      end: true,
      visible: true,
    },
    {
      to: `/orgs/${membership.organization.id}/members`,
      label: "Members",
      icon: Users,
      end: false,
      visible: canViewMembers,
    },
    {
      to: `/orgs/${membership.organization.id}/settings`,
      label: "Settings",
      icon: Settings,
      end: false,
      visible: canManageSettings,
    },
  ];

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 text-cream-100">
      <div className="flex items-center justify-between px-5 pb-5 pt-6">
        <Logo
          tone="light"
          to={`/orgs/${membership.organization.id}`}
          onClick={() => setMobileOpen(false)}
        />
        <button
          type="button"
          className="grid size-8 place-items-center rounded-lg text-ink-300 hover:bg-white/5 hover:text-cream-50 lg:hidden"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        >
          <X className="size-5" />
        </button>
      </div>

      <div className="px-4">
        <label
          htmlFor="workspace-switcher"
          className="mb-1.5 block px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-400"
        >
          Workspace
        </label>
        <div className="relative">
          <select
            id="workspace-switcher"
            value={membership.organization.id}
            onChange={(event) => {
              navigate(`/orgs/${event.target.value}`);
              setMobileOpen(false);
            }}
            className="w-full cursor-pointer appearance-none rounded-lg border border-white/10 bg-white/[0.06] py-2.5 pl-3 pr-9 text-sm font-medium text-cream-50 outline-none transition hover:bg-white/[0.09] focus:border-accent-400/60 focus:ring-4 focus:ring-accent-500/10"
          >
            {memberships.map((item) => (
              <option
                key={item.organization.id}
                value={item.organization.id}
                className="text-ink-900"
              >
                {item.organization.name}
              </option>
            ))}
          </select>
          <ChevronDown
            className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-ink-300"
            aria-hidden="true"
          />
        </div>
        <div className="mt-2 flex items-center justify-between px-1">
          <span className="text-[11px] text-ink-400">{membership.organization.slug}</span>
          <Badge tone="accent" className="border-accent-400/20 bg-accent-500/10 text-accent-400">
            {roleLabel(membership.role)}
          </Badge>
        </div>
      </div>

      <nav className="mt-6 space-y-1 px-3" aria-label="Workspace">
        {navigation
          .filter((item) => item.visible)
          .map((item) => (
            <NavLink
              key={item.label}
              to={item.to}
              end={item.end}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) =>
                cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition",
                  isActive
                    ? "bg-white/[0.09] text-cream-50 shadow-[inset_2px_0_0_0_var(--color-accent-500)]"
                    : "text-ink-300 hover:bg-white/[0.05] hover:text-cream-100",
                )
              }
            >
              <item.icon className="size-4" aria-hidden="true" />
              {item.label}
            </NavLink>
          ))}
      </nav>

      <div className="mx-4 mt-7 rounded-xl border border-white/[0.07] bg-white/[0.03] p-3.5">
        <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          <FolderKanban className="size-3.5" aria-hidden="true" />
          Product roadmap
        </div>
        <ul className="mt-3 space-y-2.5">
          {roadmap.map((item) => (
            <li key={item.label} className="flex items-center justify-between gap-2 text-xs">
              <span className="text-ink-300">{item.label}</span>
              <span className="rounded border border-white/10 px-1.5 py-0.5 text-[10px] font-medium text-ink-400">
                {item.milestone}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-auto border-t border-white/[0.07] p-4">
        <div className="flex items-center gap-3">
          <Avatar name={user.name} className="border-white/10 bg-white/10 text-cream-100" />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-cream-50">{user.name}</p>
            <p className="truncate text-[11px] text-ink-400">{user.email}</p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          className="mt-3 flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-xs font-medium text-ink-300 transition hover:bg-white/[0.05] hover:text-cream-50 disabled:opacity-60"
        >
          {signingOut ? <Spinner className="size-3.5" /> : <LogOut className="size-3.5" />}
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-cream-50">
      <a
        href="#main-content"
        className="sr-only z-50 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-cream-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 lg:block">{sidebar}</aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button
            type="button"
            className="absolute inset-0 bg-ink-950/50 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-label="Close navigation"
          />
          <div className="absolute inset-y-0 left-0 w-[min(18rem,85vw)] animate-rise">
            {sidebar}
          </div>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-cream-200 bg-cream-50/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg border border-cream-200 bg-white text-ink-700"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <div className="min-w-0 text-center">
            <p className="truncate text-sm font-medium text-ink-900">
              {membership.organization.name}
            </p>
            <p className="text-[10px] uppercase tracking-[0.16em] text-ink-400">
              {roleLabel(membership.role)}
            </p>
          </div>
          <Avatar name={user.name} />
        </header>

        <main
          id="main-content"
          className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-6xl flex-col gap-2 border-t border-cream-200 px-4 py-6 text-[11px] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>StudioOS · Milestone 1 · Secure multi-tenant foundation</span>
          <span>Session-based auth · Server-enforced permissions</span>
        </footer>
      </div>
    </div>
  );
}
