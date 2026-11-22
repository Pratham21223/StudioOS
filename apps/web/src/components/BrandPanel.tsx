import { Check, ShieldCheck, Sparkles } from "lucide-react";
import { Logo } from "./Logo";

const highlights = [
  "One source of truth for every deliverable",
  "Client review without email chaos",
  "Roles and tenant boundaries enforced server-side",
];

export function BrandPanel() {
  return (
    <aside className="studio-grid relative hidden overflow-hidden bg-ink-900 px-10 py-10 text-cream-50 lg:flex lg:flex-col xl:px-14">
      <div className="studio-glow pointer-events-none absolute inset-0" aria-hidden="true" />
      <div className="relative z-10 flex h-full flex-col">
        <Logo tone="light" to="/login" />

        <div className="mt-auto max-w-lg space-y-8 pb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-cream-200">
            <Sparkles className="size-3.5 text-accent-400" aria-hidden="true" />
            Built for production teams
          </div>

          <h2 className="font-display text-5xl leading-[1.02] tracking-tight text-cream-50 xl:text-6xl">
            The quiet engine behind
            <span className="block text-accent-400">great content.</span>
          </h2>

          <p className="max-w-md text-[15px] leading-relaxed text-ink-300">
            Briefs, shoots, edits, feedback, and client approvals — organized in one workspace
            instead of scattered across inboxes and drives.
          </p>

          <ul className="space-y-3">
            {highlights.map((highlight) => (
              <li key={highlight} className="flex items-start gap-3 text-sm text-cream-200">
                <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full border border-accent-400/30 bg-accent-500/10">
                  <Check className="size-3 text-accent-400" aria-hidden="true" />
                </span>
                {highlight}
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-auto flex items-center gap-2 border-t border-white/10 pt-5 text-[11px] text-ink-400">
          <ShieldCheck className="size-4 text-moss-100/70" aria-hidden="true" />
          Private by default · Session-based auth · Tenant-isolated data
        </div>
      </div>
    </aside>
  );
}
