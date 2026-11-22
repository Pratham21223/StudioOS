import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, Building2, LayoutDashboard, LogOut, Menu, X } from "lucide-react";
import { useAuth } from "../app/AuthProvider";
import { Logo } from "./Logo";
import { Avatar, Badge, Spinner } from "./ui";
import { cn } from "../lib/utils";

export function PortalShell() {
  const { user, clientMemberships, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  if (!user) return null;

  const clients = Array.from(
    new Map(clientMemberships.map((membership) => [membership.client.id, membership])).values(),
  );

  async function handleSignOut() {
    setSigningOut(true);
    try {
      await logout();
      navigate("/login", { replace: true });
    } finally {
      setSigningOut(false);
    }
  }

  const navigation = [
    { to: "/portal", label: "Overview", icon: LayoutDashboard, end: true },
    { to: "/portal/notifications", label: "Notifications", icon: Bell, end: false },
  ];

  const sidebar = (
    <div className="flex h-full flex-col bg-ink-900 text-cream-100">
      <div className="flex items-center justify-between px-5 pb-4 pt-6">
        <Logo tone="light" to="/portal" onClick={() => setMobileOpen(false)} />
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
        <Badge tone="accent" className="border-accent-400/20 bg-accent-500/10 text-accent-400">
          Client portal
        </Badge>
        <div className="mt-4 space-y-2">
          {clients.map((membership) => (
            <div
              key={membership.id}
              className="flex items-center gap-2.5 rounded-lg border border-white/[0.07] bg-white/[0.03] px-3 py-2.5"
            >
              <Building2 className="size-4 shrink-0 text-ink-400" aria-hidden="true" />
              <div className="min-w-0">
                <p className="truncate text-xs font-medium text-cream-100">
                  {membership.client.name}
                </p>
                <p className="truncate text-[10px] text-ink-400">{membership.organization.name}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      <nav className="mt-6 space-y-1 px-3" aria-label="Client portal">
        {navigation.map((item) => (
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
        <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-ink-400">
          Review access
        </p>
        <p className="mt-2 text-xs leading-relaxed text-ink-300">
          You can view submitted deliverables, download files, approve work, or request revisions.
          Internal notes and other clients stay private.
        </p>
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
    <div className="flex min-h-screen flex-col bg-cream-50">
      <a
        href="#portal-content"
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

      <div className="flex flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-cream-200 bg-cream-50/90 px-4 backdrop-blur sm:px-6 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="grid size-9 place-items-center rounded-lg border border-cream-200 bg-white text-ink-700"
            aria-label="Open navigation"
          >
            <Menu className="size-5" />
          </button>
          <p className="text-sm font-medium text-ink-900">Client portal</p>
          <Avatar name={user.name} />
        </header>

        <main
          id="portal-content"
          className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8 lg:py-10"
        >
          <Outlet />
        </main>

        <footer className="mx-auto flex w-full max-w-7xl flex-col gap-2 border-t border-cream-200 px-4 py-6 text-[11px] text-ink-400 sm:flex-row sm:items-center sm:justify-between sm:px-6 lg:px-8">
          <span>© {new Date().getFullYear()} StudioOS</span>
          <span>Private to your client account</span>
        </footer>
      </div>
    </div>
  );
}
