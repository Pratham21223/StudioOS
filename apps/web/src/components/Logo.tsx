import { Link } from "react-router-dom";
import { cn } from "../lib/utils";

export function Logo({
  tone = "dark",
  to = "/",
  className,
  onClick,
}: {
  tone?: "dark" | "light";
  to?: string;
  className?: string;
  onClick?: () => void;
}) {
  const isDark = tone === "dark";
  return (
    <Link
      to={to}
      onClick={onClick}
      className={cn("group inline-flex items-center gap-2.5", className)}
      aria-label="StudioOS home"
    >
      <span
        className={cn(
          "grid size-9 place-items-center rounded-xl transition group-hover:rotate-3",
          isDark ? "bg-ink-900" : "bg-cream-50",
        )}
      >
        <svg viewBox="0 0 64 64" className="size-6" aria-hidden="true">
          <path
            d="M18 22h20a8 8 0 0 1 0 16H26a7 7 0 0 0 0 14h20"
            fill="none"
            stroke={isDark ? "#f4f0e8" : "#191714"}
            strokeWidth="6.5"
            strokeLinecap="round"
          />
          <circle cx="45" cy="22" r="4" fill="#e2562f" />
        </svg>
      </span>
      <span className="flex flex-col leading-none">
        <span
          className={cn(
            "font-display text-[21px] tracking-tight",
            isDark ? "text-ink-900" : "text-cream-50",
          )}
        >
          StudioOS
        </span>
        <span
          className={cn(
            "mt-1 text-[9px] font-semibold uppercase tracking-[0.22em]",
            isDark ? "text-ink-400" : "text-ink-300",
          )}
        >
          Production operations
        </span>
      </span>
    </Link>
  );
}
