import { useState, type ButtonHTMLAttributes, type ComponentProps, type ReactNode } from "react";
import { AlertCircle, CheckCircle2, Eye, EyeOff, Info, Loader2, TriangleAlert } from "lucide-react";
import { cn, initials } from "../lib/utils";

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn("size-4 animate-spin", className)} aria-hidden="true" />;
}

type ButtonVariant = "primary" | "dark" | "secondary" | "ghost" | "danger";

const buttonVariants: Record<ButtonVariant, string> = {
  primary:
    "bg-accent-500 text-white shadow-sm hover:bg-accent-600 active:bg-accent-700 disabled:bg-accent-500/60",
  dark: "bg-ink-900 text-cream-50 shadow-sm hover:bg-ink-800 active:bg-ink-700",
  secondary:
    "border border-cream-300 bg-white text-ink-800 shadow-sm hover:border-cream-300/80 hover:bg-cream-100",
  ghost: "text-ink-600 hover:bg-cream-100 hover:text-ink-900",
  danger: "border border-rust-100 bg-white text-rust-700 hover:bg-rust-100",
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  loading?: boolean;
  icon?: ReactNode;
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  className,
  children,
  disabled,
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-lg font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70",
        size === "md" ? "min-h-10 px-4 text-sm" : "min-h-8 px-3 text-xs",
        buttonVariants[variant],
        className,
      )}
      {...props}
    >
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function FormField({
  label,
  htmlFor,
  hint,
  error,
  children,
  className,
}: {
  label: string;
  htmlFor: string;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <label htmlFor={htmlFor} className="block text-sm font-medium text-ink-800">
        {label}
      </label>
      {children}
      {error ? (
        <p className="text-xs font-medium text-rust-700" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-ink-500">{hint}</p>
      ) : null}
    </div>
  );
}

const controlClasses =
  "w-full rounded-lg border border-cream-300 bg-white px-3.5 py-2.5 text-sm text-ink-900 shadow-sm outline-none transition placeholder:text-ink-400 focus:border-accent-500 focus:ring-4 focus:ring-accent-500/10 disabled:cursor-not-allowed disabled:bg-cream-100 disabled:text-ink-500";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cn(controlClasses, className)} {...props} />;
}

export function Select({ className, children, ...props }: ComponentProps<"select">) {
  return (
    <select className={cn(controlClasses, "cursor-pointer pr-8", className)} {...props}>
      {children}
    </select>
  );
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cn(controlClasses, "min-h-24 resize-y", className)} {...props} />;
}

export function PasswordInput({ className, ...props }: ComponentProps<"input">) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input type={visible ? "text" : "password"} className={cn("pr-11", className)} {...props} />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center rounded-r-lg text-ink-400 transition hover:text-ink-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-500/40"
        aria-label={visible ? "Hide password" : "Show password"}
        tabIndex={-1}
      >
        {visible ? (
          <EyeOff className="size-4" aria-hidden="true" />
        ) : (
          <Eye className="size-4" aria-hidden="true" />
        )}
      </button>
    </div>
  );
}

type AlertTone = "info" | "success" | "warning" | "error";

const alertTones: Record<AlertTone, { wrapper: string; icon: ReactNode }> = {
  info: {
    wrapper: "border-sky-200 bg-sky-50 text-sky-900",
    icon: <Info className="size-4 shrink-0" aria-hidden="true" />,
  },
  success: {
    wrapper: "border-moss-500/20 bg-moss-100 text-moss-500",
    icon: <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />,
  },
  warning: {
    wrapper: "border-amber-700/15 bg-amber-100 text-amber-700",
    icon: <TriangleAlert className="size-4 shrink-0" aria-hidden="true" />,
  },
  error: {
    wrapper: "border-rust-700/15 bg-rust-100 text-rust-700",
    icon: <AlertCircle className="size-4 shrink-0" aria-hidden="true" />,
  },
};

export function Alert({
  tone = "info",
  title,
  children,
  action,
}: {
  tone?: AlertTone;
  title?: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  const style = alertTones[tone];
  return (
    <div
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        style.wrapper,
      )}
      role={tone === "error" ? "alert" : "status"}
    >
      <span className="mt-0.5">{style.icon}</span>
      <div className="min-w-0 flex-1 space-y-1">
        {title ? <p className="font-semibold">{title}</p> : null}
        {children ? <div className="text-sm leading-relaxed opacity-95">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0 self-center">{action}</div> : null}
    </div>
  );
}

const badgeTones = {
  neutral: "border-cream-300 bg-cream-100 text-ink-600",
  accent: "border-accent-500/15 bg-accent-500/10 text-accent-700",
  success: "border-moss-500/15 bg-moss-100 text-moss-500",
  warning: "border-amber-700/15 bg-amber-100 text-amber-700",
  danger: "border-rust-700/15 bg-rust-100 text-rust-700",
} as const;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: keyof typeof badgeTones;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-semibold tracking-wide",
        badgeTones[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Avatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={cn(
        "grid size-9 shrink-0 place-items-center rounded-full border border-cream-200 bg-cream-100 text-xs font-semibold text-ink-600",
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export function Card({
  children,
  className,
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  as?: "div" | "section" | "article";
}) {
  return (
    <Tag className={cn("rounded-xl border border-cream-200 bg-white shadow-card", className)}>
      {children}
    </Tag>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-12 text-center">
      {icon ? (
        <span className="grid size-10 place-items-center rounded-full bg-cream-100 text-ink-500">
          {icon}
        </span>
      ) : null}
      <div className="space-y-1">
        <p className="font-medium text-ink-900">{title}</p>
        <p className="max-w-sm text-sm leading-relaxed text-ink-500">{description}</p>
      </div>
      {action}
    </div>
  );
}

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="space-y-1.5">
        {eyebrow ? (
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            {eyebrow}
          </p>
        ) : null}
        <h1 className="font-display text-3xl tracking-tight text-ink-900 sm:text-4xl">{title}</h1>
        {description ? (
          <p className="max-w-2xl text-sm leading-relaxed text-ink-500">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
    </div>
  );
}
