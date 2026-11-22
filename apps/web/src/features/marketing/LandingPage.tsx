import { useState } from "react";
import { Link } from "react-router-dom";
import {
  ArrowRight,
  Building2,
  CalendarClock,
  Check,
  CheckCircle2,
  Clapperboard,
  FileText,
  FolderKanban,
  History,
  ListChecks,
  Lock,
  Menu,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Badge } from "../../components/ui";
import { Logo } from "../../components/Logo";
import { cn } from "../../lib/utils";

const navigation = [
  { href: "#product", label: "Product" },
  { href: "#workflow", label: "Workflow" },
  { href: "#portal", label: "Client portal" },
  { href: "#security", label: "Privacy" },
];

const features = [
  {
    icon: FolderKanban,
    title: "Clients and projects in one place",
    body: "Keep briefs, contacts, scopes, dates, and project teams connected from the first kickoff.",
  },
  {
    icon: Clapperboard,
    title: "A production workflow that holds",
    body: "Move every deliverable through a clear, fixed path from brief and script to edit and approval.",
  },
  {
    icon: FileText,
    title: "Files, feedback, and review history",
    body: "Share the right cut, collect feedback against the right version, and keep every decision visible.",
  },
  {
    icon: ListChecks,
    title: "Tasks and deadlines without chasing",
    body: "See what is in motion, who owns it, and what needs attention before a deadline slips.",
  },
];

const workflowStages = [
  "Brief",
  "Script",
  "Shoot",
  "Editing",
  "Internal review",
  "Client approval",
  "Ready to publish",
];

const securityPoints = [
  {
    icon: Lock,
    title: "Your own creative space",
    body: "Every creator, producer, and client has a clear place to work.",
  },
  {
    icon: Users,
    title: "The right people, together",
    body: "Invite collaborators to the projects they need, without extra noise.",
  },
  {
    icon: ShieldCheck,
    title: "Files shared thoughtfully",
    body: "Deliverables move through private links instead of public folders.",
  },
  {
    icon: History,
    title: "Every idea remembered",
    body: "Feedback, revisions, and approvals stay attached to the work.",
  },
];

export function LandingPage() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen scroll-smooth bg-cream-50 text-ink-900">
      <a
        href="#main"
        className="sr-only z-50 rounded-lg bg-ink-900 px-4 py-2 text-sm font-medium text-cream-50 focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-cream-200/80 bg-cream-50/90 backdrop-blur-xl">
        <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between px-5 sm:px-8">
          <Logo />
          <nav className="hidden items-center gap-7 md:flex" aria-label="Marketing">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-sm font-medium text-ink-500 transition hover:text-ink-900"
              >
                {item.label}
              </a>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link
              to="/login"
              className="rounded-lg px-3.5 py-2 text-sm font-medium text-ink-700 transition hover:bg-cream-100"
            >
              Sign in
            </Link>
            <Link
              to="/register"
              className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 shadow-sm transition hover:bg-ink-800"
            >
              Start free
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            className="grid size-9 place-items-center rounded-lg border border-cream-200 bg-white text-ink-700 md:hidden"
            onClick={() => setMobileOpen((value) => !value)}
            aria-expanded={mobileOpen}
            aria-controls="marketing-menu"
            aria-label={mobileOpen ? "Close menu" : "Open menu"}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>

        {mobileOpen ? (
          <div
            id="marketing-menu"
            className="border-t border-cream-200 bg-cream-50 px-5 py-4 md:hidden"
          >
            <nav className="space-y-1" aria-label="Marketing mobile">
              {navigation.map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  className="block rounded-lg px-3 py-2.5 text-sm font-medium text-ink-700 hover:bg-cream-100"
                >
                  {item.label}
                </a>
              ))}
            </nav>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <Link
                to="/login"
                className="rounded-lg border border-cream-300 bg-white px-3 py-2.5 text-center text-sm font-medium text-ink-800"
              >
                Sign in
              </Link>
              <Link
                to="/register"
                className="rounded-lg bg-ink-900 px-3 py-2.5 text-center text-sm font-medium text-cream-50"
              >
                Start free
              </Link>
            </div>
          </div>
        ) : null}
      </header>

      <main id="main">
        <section className="relative overflow-hidden">
          <div className="pointer-events-none absolute -right-40 -top-40 size-[38rem] rounded-full bg-accent-500/10 blur-3xl" />
          <div className="pointer-events-none absolute -left-48 top-40 size-[32rem] rounded-full bg-moss-100/70 blur-3xl" />

          <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-16 sm:px-8 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] lg:pb-28 lg:pt-24">
            <div className="space-y-7">
              <div className="inline-flex items-center gap-2 rounded-full border border-cream-300 bg-white/80 px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-ink-600 shadow-sm">
                <Sparkles className="size-3.5 text-accent-500" aria-hidden="true" />
                Content production, organized
              </div>
              <div className="space-y-5">
                <h1 className="max-w-2xl font-display text-5xl leading-[1.02] tracking-tight sm:text-6xl xl:text-7xl">
                  Every deliverable.
                  <span className="block text-accent-500">One clear path to publish.</span>
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-ink-500 sm:text-lg">
                  StudioOS brings clients, projects, files, tasks, and approvals into one calm
                  workspace — so your team can move from brief to publish without the email chase.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-sm font-semibold text-white shadow-lg shadow-accent-500/20 transition hover:bg-accent-600"
                >
                  Start your workspace
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-cream-300 bg-white px-5 py-3.5 text-sm font-semibold text-ink-800 shadow-sm transition hover:bg-cream-100"
                >
                  Sign in
                </Link>
              </div>
              <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-ink-500">
                {[
                  "Built for creators and their teams",
                  "Client-ready review",
                  "Your work stays yours",
                ].map((item) => (
                  <span key={item} className="flex items-center gap-1.5">
                    <Check className="size-3.5 text-moss-500" aria-hidden="true" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <HeroMockup />
          </div>
        </section>

        <section id="product" className="border-y border-cream-200 bg-white/60 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
                Built for the work between kickoff and launch
              </p>
              <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                Less production admin. More finished work.
              </h2>
              <p className="text-sm leading-relaxed text-ink-500 sm:text-base">
                Replace scattered briefs, drive links, status threads, and approval emails with one
                workspace your whole production chain can trust.
              </p>
            </div>

            <div className="mt-12 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              {features.map((feature) => (
                <article
                  key={feature.title}
                  className="group rounded-2xl border border-cream-200 bg-cream-50 p-6 transition hover:-translate-y-1 hover:border-cream-300 hover:bg-white hover:shadow-card"
                >
                  <span className="grid size-11 place-items-center rounded-xl bg-ink-900 text-cream-50 transition group-hover:bg-accent-500">
                    <feature.icon className="size-5" aria-hidden="true" />
                  </span>
                  <h3 className="mt-5 font-display text-2xl leading-tight tracking-tight">
                    {feature.title}
                  </h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{feature.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="studio-grid relative overflow-hidden rounded-3xl bg-ink-900 px-6 py-10 text-cream-50 shadow-card sm:px-10 sm:py-14">
              <div
                className="studio-glow pointer-events-none absolute inset-0"
                aria-hidden="true"
              />
              <div className="relative z-10 grid gap-10 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] lg:items-center">
                <div className="space-y-4">
                  <Badge
                    tone="accent"
                    className="border-accent-400/20 bg-accent-500/10 text-accent-400"
                  >
                    One production language
                  </Badge>
                  <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                    A workflow everyone can see.
                  </h2>
                  <p className="max-w-md text-sm leading-relaxed text-ink-300 sm:text-base">
                    Every deliverable follows the same seven stages. Internal review can send work
                    back to editing, and clients get one clear approval moment — not a thread of
                    conflicting notes.
                  </p>
                  <div className="flex items-center gap-2 pt-2 text-xs text-ink-300">
                    <CheckCircle2 className="size-4 text-accent-400" aria-hidden="true" />
                    Status, ownership, and history stay in one place.
                  </div>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 sm:p-5">
                  <div className="flex items-center justify-between border-b border-white/10 pb-3">
                    <span className="text-xs font-medium text-cream-100">Production workflow</span>
                    <span className="rounded-full border border-white/10 px-2 py-0.5 text-[10px] text-ink-300">
                      7 stages
                    </span>
                  </div>
                  <ol className="mt-4 grid gap-2 sm:grid-cols-2">
                    {workflowStages.map((stage, index) => (
                      <li
                        key={stage}
                        className={cn(
                          "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-xs",
                          stage === "Client approval"
                            ? "border-accent-400/30 bg-accent-500/10 text-cream-50"
                            : "border-white/10 bg-white/[0.03] text-ink-300",
                        )}
                      >
                        <span
                          className={cn(
                            "grid size-6 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                            stage === "Client approval"
                              ? "bg-accent-500 text-white"
                              : "bg-white/10 text-cream-100",
                          )}
                        >
                          {index + 1}
                        </span>
                        {stage}
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 flex items-center justify-between rounded-xl border border-white/10 bg-ink-950/40 px-3 py-2.5 text-[11px] text-ink-300">
                    <span className="flex items-center gap-2">
                      <MessageSquare className="size-3.5 text-accent-400" aria-hidden="true" />
                      Revision requested
                    </span>
                    <span>Back to editing</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="portal" className="border-y border-cream-200 bg-white/60 py-20 sm:py-24">
          <div className="mx-auto grid max-w-7xl items-center gap-12 px-5 sm:px-8 lg:grid-cols-2">
            <div className="order-2 lg:order-1">
              <PortalMockup />
            </div>
            <div className="order-1 space-y-5 lg:order-2">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
                A better client review
              </p>
              <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                Give clients clarity, not another login maze.
              </h2>
              <p className="text-sm leading-relaxed text-ink-500 sm:text-base">
                Client contacts get a focused portal with the submitted cut, the feedback history,
                and one decisive next step: approve or request a revision.
              </p>
              <ul className="space-y-3">
                {[
                  "Only client-visible deliverables appear in the portal",
                  "Every approval records the reviewed version",
                  "Revision feedback returns work to editing with a clear trail",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3 text-sm text-ink-600">
                    <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-moss-100 text-moss-500">
                      <Check className="size-3" aria-hidden="true" />
                    </span>
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                to="/register"
                className="inline-flex items-center gap-2 text-sm font-semibold text-accent-600 transition hover:text-accent-700"
              >
                Set up client review
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        </section>

        <section id="security" className="py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)] lg:items-start">
              <div className="space-y-3 lg:sticky lg:top-28">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
                  Made for creative teams
                </p>
                <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                  Your ideas stay yours.
                </h2>
                <p className="max-w-md text-sm leading-relaxed text-ink-500 sm:text-base">
                  A calm, private home for creators and their teams to shape ideas, share cuts, and
                  move work forward together.
                </p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {securityPoints.map((point) => (
                  <article
                    key={point.title}
                    className="rounded-2xl border border-cream-200 bg-white p-6 shadow-card"
                  >
                    <span className="grid size-10 place-items-center rounded-xl bg-moss-100 text-moss-500">
                      <point.icon className="size-5" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 text-sm font-semibold text-ink-900">{point.title}</h3>
                    <p className="mt-1.5 text-xs leading-relaxed text-ink-500">{point.body}</p>
                  </article>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-cream-200 bg-white/60 py-20 sm:py-24">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="max-w-2xl space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-600">
                One workspace, every role
              </p>
              <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                Built around how production actually moves.
              </h2>
            </div>

            <div className="mt-12 grid gap-4 lg:grid-cols-3">
              {[
                {
                  icon: Building2,
                  title: "Creators and studio leads",
                  body: "See active projects, pending approvals, and overdue work without asking for a status update.",
                },
                {
                  icon: Clapperboard,
                  title: "Producers and editors",
                  body: "Work the board, own assigned tasks, upload cuts, and move deliverables through the next valid stage.",
                },
                {
                  icon: Users,
                  title: "Clients and stakeholders",
                  body: "Review only what was submitted, download the right file, and approve or request changes clearly.",
                },
              ].map((role) => (
                <article
                  key={role.title}
                  className="rounded-2xl border border-cream-200 bg-cream-50 p-7"
                >
                  <role.icon className="size-6 text-accent-500" aria-hidden="true" />
                  <h3 className="mt-5 font-display text-2xl tracking-tight">{role.title}</h3>
                  <p className="mt-2 text-sm leading-relaxed text-ink-500">{role.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="px-5 py-20 sm:px-8 sm:py-24">
          <div className="studio-grid relative mx-auto max-w-7xl overflow-hidden rounded-3xl bg-ink-900 px-6 py-12 text-cream-50 shadow-card sm:px-12 sm:py-16">
            <div className="studio-glow pointer-events-none absolute inset-0" aria-hidden="true" />
            <div className="relative z-10 flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
              <div className="max-w-xl space-y-3">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-accent-400">
                  Your next production, in one place
                </p>
                <h2 className="font-display text-4xl leading-tight tracking-tight sm:text-5xl">
                  Start with a clean brief and a clear path.
                </h2>
                <p className="text-sm leading-relaxed text-ink-300">
                  Create your workspace, invite your team, and move the first deliverable from brief
                  to published without losing the thread.
                </p>
              </div>
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/register"
                  className="inline-flex items-center gap-2 rounded-xl bg-accent-500 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-accent-600"
                >
                  Start free
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 rounded-xl border border-white/15 bg-white/5 px-5 py-3.5 text-sm font-semibold text-cream-100 transition hover:bg-white/10"
                >
                  Sign in
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-cream-200 bg-cream-50">
        <div className="mx-auto grid max-w-7xl gap-8 px-5 py-10 sm:px-8 md:grid-cols-[1fr_auto] md:items-start">
          <div className="space-y-4">
            <Logo />
            <p className="max-w-sm text-xs leading-relaxed text-ink-500">
              A workspace for creators and the teams behind their content: ideas, files, feedback,
              and approvals in one private place.
            </p>
            <p className="text-[11px] text-ink-400">© {new Date().getFullYear()} StudioOS</p>
          </div>
          <div className="grid grid-cols-2 gap-x-10 gap-y-2 text-xs sm:grid-cols-3">
            {navigation.map((item) => (
              <a
                key={item.href}
                href={item.href}
                className="text-ink-500 transition hover:text-ink-900"
              >
                {item.label}
              </a>
            ))}
            <Link to="/login" className="text-ink-500 transition hover:text-ink-900">
              Sign in
            </Link>
            <Link to="/register" className="text-ink-500 transition hover:text-ink-900">
              Start free
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeroMockup() {
  return (
    <div className="relative">
      <div className="absolute -right-4 top-10 hidden rotate-2 rounded-2xl border border-cream-200 bg-white p-3.5 shadow-card sm:block">
        <div className="flex items-center gap-2">
          <span className="grid size-8 place-items-center rounded-full bg-moss-100 text-moss-500">
            <CheckCircle2 className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-ink-900">Client approved</p>
            <p className="text-[10px] text-ink-500">Launch film · v4</p>
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-cream-200 bg-white shadow-[0_30px_80px_-30px_rgba(25,23,20,0.28)]">
        <div className="flex items-center justify-between border-b border-cream-200 bg-cream-50 px-4 py-3">
          <div className="flex items-center gap-1.5">
            <span className="size-2 rounded-full bg-cream-300" />
            <span className="size-2 rounded-full bg-cream-300" />
            <span className="size-2 rounded-full bg-cream-300" />
          </div>
          <div className="rounded-md border border-cream-200 bg-white px-4 py-1 text-[10px] text-ink-400">
            studioos.app
          </div>
          <span className="size-2" />
        </div>

        <div className="grid grid-cols-[4.5rem_minmax(0,1fr)]">
          <div className="border-r border-cream-200 bg-ink-900 px-2 py-4">
            <div className="mx-auto size-7 rounded-lg bg-cream-50/10" />
            <div className="mt-5 space-y-2">
              {[0, 1, 2, 3].map((item) => (
                <div
                  key={item}
                  className={cn(
                    "h-6 rounded-md",
                    item === 1 ? "bg-accent-500/70" : "bg-white/[0.06]",
                  )}
                />
              ))}
            </div>
          </div>

          <div className="min-w-0 bg-cream-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-display text-lg leading-tight text-ink-900">Content board</p>
                <p className="text-[10px] text-ink-500">Season launch · 6 deliverables</p>
              </div>
              <span className="rounded-md bg-ink-900 px-2 py-1 text-[9px] font-medium text-cream-50">
                + New
              </span>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              {[
                { title: "Brief", count: 2, tone: "bg-cream-200" },
                { title: "Editing", count: 2, tone: "bg-amber-100" },
                { title: "Approval", count: 1, tone: "bg-rust-100" },
              ].map((column, index) => (
                <div key={column.title} className="rounded-lg border border-cream-200 bg-white p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[8px] font-semibold uppercase tracking-[0.1em] text-ink-500">
                      {column.title}
                    </span>
                    <span className={cn("rounded-full px-1 text-[8px] text-ink-600", column.tone)}>
                      {column.count}
                    </span>
                  </div>
                  <div className="mt-2 space-y-1.5">
                    {[0, 1].slice(0, index === 2 ? 1 : 2).map((item) => (
                      <div key={item} className="rounded-md border border-cream-200 p-1.5">
                        <div className="h-1.5 w-3/4 rounded-full bg-ink-800/80" />
                        <div className="mt-1 h-1 w-1/2 rounded-full bg-cream-300" />
                        <div className="mt-1.5 flex items-center justify-between">
                          <div className="h-2.5 w-2.5 rounded-full bg-cream-200" />
                          <div className="h-1 w-5 rounded-full bg-cream-200" />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-accent-500/20 bg-white p-2.5">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="grid size-6 place-items-center rounded-md bg-accent-500/10 text-accent-600">
                    <Clapperboard className="size-3" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-[9px] font-semibold text-ink-900">Launch film · v4</p>
                    <p className="text-[8px] text-ink-500">Awaiting client approval</p>
                  </div>
                </div>
                <span className="rounded-full bg-rust-100 px-1.5 py-0.5 text-[8px] font-semibold text-rust-700">
                  Review
                </span>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-2 rounded-lg border border-cream-200 bg-white p-2">
              <CalendarClock className="size-3.5 text-ink-400" aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="h-1.5 w-2/3 rounded-full bg-ink-800/70" />
                <div className="mt-1 h-1 w-1/3 rounded-full bg-cream-300" />
              </div>
              <span className="text-[8px] text-ink-400">Due Fri</span>
            </div>
          </div>
        </div>
      </div>

      <div className="absolute -bottom-5 -left-3 hidden rounded-2xl border border-cream-200 bg-white p-3 shadow-card sm:block">
        <div className="flex items-center gap-2.5">
          <span className="grid size-8 place-items-center rounded-lg bg-accent-500/10 text-accent-600">
            <FileText className="size-4" aria-hidden="true" />
          </span>
          <div>
            <p className="text-[11px] font-semibold text-ink-900">Final cut uploaded</p>
            <p className="text-[10px] text-ink-500">2.4 GB · signed access</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function PortalMockup() {
  return (
    <div className="relative mx-auto max-w-xl">
      <div className="absolute -right-4 -top-4 hidden rounded-xl border border-cream-200 bg-white px-3 py-2 shadow-card sm:block">
        <p className="text-[10px] font-semibold text-ink-900">Private portal</p>
        <p className="text-[9px] text-ink-500">Client-visible only</p>
      </div>

      <div className="rounded-3xl border border-cream-200 bg-white p-4 shadow-[0_30px_80px_-35px_rgba(25,23,20,0.25)] sm:p-5">
        <div className="flex items-center justify-between border-b border-cream-200 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-8 place-items-center rounded-lg bg-cream-100 text-ink-500">
              <Clapperboard className="size-4" aria-hidden="true" />
            </span>
            <div>
              <p className="text-xs font-semibold text-ink-900">Launch film</p>
              <p className="text-[10px] text-ink-500">Client review · version 4</p>
            </div>
          </div>
          <Badge tone="danger">Client approval</Badge>
        </div>

        <div className="mt-4 rounded-xl border border-cream-200 bg-cream-50 p-3">
          <div className="flex items-center gap-2">
            <FileText className="size-4 text-ink-400" aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[11px] font-medium text-ink-900">launch-film-final.mp4</p>
              <p className="text-[9px] text-ink-500">Signed link · download or preview</p>
            </div>
            <span className="rounded-md border border-cream-300 bg-white px-2 py-1 text-[9px] text-ink-600">
              Download
            </span>
          </div>
        </div>

        <div className="mt-3 space-y-2">
          <div className="rounded-lg border border-cream-200 p-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-semibold text-ink-800">Feedback</span>
              <span className="text-[8px] text-ink-400">v4</span>
            </div>
            <p className="mt-1 text-[10px] leading-relaxed text-ink-500">
              Opening is approved. Please tighten the lower third before publishing.
            </p>
          </div>
          <div className="rounded-lg border border-moss-500/20 bg-moss-100 p-2.5">
            <p className="flex items-center gap-1.5 text-[10px] font-semibold text-moss-500">
              <CheckCircle2 className="size-3" aria-hidden="true" />
              Approved by client
            </p>
          </div>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="rounded-lg border border-cream-300 bg-white px-3 py-2 text-center text-[10px] font-medium text-ink-700">
            Request revision
          </div>
          <div className="rounded-lg bg-ink-900 px-3 py-2 text-center text-[10px] font-medium text-cream-50">
            Approve for publishing
          </div>
        </div>
      </div>
    </div>
  );
}
