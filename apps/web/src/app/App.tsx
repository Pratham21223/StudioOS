import { lazy, Suspense, useEffect, type ReactNode } from "react";
import { Link, Navigate, Route, Routes, useLocation, useNavigate } from "react-router-dom";
import { AlertCircle, ArrowRight, Loader2, RefreshCw } from "lucide-react";
import { Button } from "../components/ui";
import { safeNextPath } from "../lib/utils";
import { useAuth } from "./AuthProvider";
import { ProtectedRoute } from "./ProtectedRoute";

const AppShell = lazy(() =>
  import("../components/AppShell").then((module) => ({ default: module.AppShell })),
);
const AcceptInvitationPage = lazy(() =>
  import("../features/auth/AcceptInvitationPage").then((module) => ({
    default: module.AcceptInvitationPage,
  })),
);
const ForgotPasswordPage = lazy(() =>
  import("../features/auth/ForgotPasswordPage").then((module) => ({
    default: module.ForgotPasswordPage,
  })),
);
const LoginPage = lazy(() =>
  import("../features/auth/LoginPage").then((module) => ({ default: module.LoginPage })),
);
const RegisterPage = lazy(() =>
  import("../features/auth/RegisterPage").then((module) => ({ default: module.RegisterPage })),
);
const ResetPasswordPage = lazy(() =>
  import("../features/auth/ResetPasswordPage").then((module) => ({
    default: module.ResetPasswordPage,
  })),
);
const MembersPage = lazy(() =>
  import("../features/organizations/MembersPage").then((module) => ({
    default: module.MembersPage,
  })),
);
const OverviewPage = lazy(() =>
  import("../features/organizations/OverviewPage").then((module) => ({
    default: module.OverviewPage,
  })),
);
const SettingsPage = lazy(() =>
  import("../features/organizations/SettingsPage").then((module) => ({
    default: module.SettingsPage,
  })),
);

function BootScreen() {
  return (
    <div className="grid min-h-screen place-items-center bg-cream-50 px-6">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="grid size-12 place-items-center rounded-2xl bg-ink-900">
          <svg viewBox="0 0 64 64" className="size-7" aria-hidden="true">
            <path
              d="M18 22h20a8 8 0 0 1 0 16H26a7 7 0 0 0 0 14h20"
              fill="none"
              stroke="#f4f0e8"
              strokeWidth="6.5"
              strokeLinecap="round"
            />
            <circle cx="45" cy="22" r="4" fill="#e2562f" />
          </svg>
        </span>
        <div className="space-y-1">
          <p className="font-display text-xl text-ink-900">StudioOS</p>
          <p className="flex items-center gap-2 text-sm text-ink-500">
            <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
            Opening your workspace
          </p>
        </div>
      </div>
    </div>
  );
}

function BootError({ message, onRetry }: { message: string; onRetry: () => Promise<void> }) {
  return (
    <div className="grid min-h-screen place-items-center bg-cream-50 px-6">
      <div className="w-full max-w-md rounded-xl border border-cream-200 bg-white p-7 shadow-card">
        <span className="grid size-10 place-items-center rounded-full bg-rust-100 text-rust-700">
          <AlertCircle className="size-5" aria-hidden="true" />
        </span>
        <h1 className="mt-4 font-display text-2xl text-ink-900">Unable to reach StudioOS</h1>
        <p className="mt-2 text-sm leading-relaxed text-ink-500">{message}</p>
        <Button
          className="mt-5"
          onClick={() => void onRetry()}
          icon={<RefreshCw className="size-4" />}
        >
          Try again
        </Button>
      </div>
    </div>
  );
}

function HomeRedirect() {
  const { user, memberships, loading } = useAuth();

  if (loading) return <BootScreen />;
  if (!user) return <Navigate to="/login" replace />;
  if (memberships.length === 0) return <Navigate to="/no-workspace" replace />;
  return <Navigate to={`/orgs/${memberships[0]!.organization.id}`} replace />;
}

function NoWorkspacePage() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="grid min-h-screen place-items-center bg-cream-50 px-6">
      <div className="w-full max-w-lg rounded-xl border border-cream-200 bg-white p-8 shadow-card">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
          No workspace access
        </p>
        <h1 className="mt-2 font-display text-3xl tracking-tight text-ink-900">
          You&apos;re signed in, but there&apos;s no workspace here.
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-ink-500">
          Your memberships may have been deactivated or removed. Ask a workspace admin to restore
          access, or sign in with another account.
        </p>
        <div className="mt-6 flex flex-wrap gap-2">
          <Button
            variant="dark"
            onClick={() => {
              void logout().then(() => navigate("/login", { replace: true }));
            }}
          >
            Sign out
          </Button>
        </div>
      </div>
    </div>
  );
}

function NotFoundPage() {
  const { user, memberships } = useAuth();
  const fallback = user && memberships[0] ? `/orgs/${memberships[0].organization.id}` : "/login";

  return (
    <div className="grid min-h-screen place-items-center bg-cream-50 px-6">
      <div className="max-w-md text-center">
        <p className="font-display text-7xl text-cream-300">404</p>
        <h1 className="mt-2 font-display text-3xl text-ink-900">This page moved backstage.</h1>
        <p className="mt-2 text-sm text-ink-500">
          The link may be wrong, or you may not have access to this part of the workspace.
        </p>
        <Link
          to={fallback}
          className="mt-5 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-ink-800"
        >
          Back to StudioOS
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function SessionRedirect({ children }: { children: ReactNode }) {
  const { user, memberships } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!user) return;
    const next = safeNextPath(new URLSearchParams(location.search).get("next"));
    if (next) {
      navigate(next, { replace: true });
    } else if (memberships.length === 0) {
      navigate("/no-workspace", { replace: true });
    } else {
      navigate(`/orgs/${memberships[0]!.organization.id}`, { replace: true });
    }
  }, [user, memberships, navigate, location.search]);

  if (user) return null;
  return <>{children}</>;
}

export function App() {
  const { loading, bootstrapError, retryBootstrap } = useAuth();

  if (loading) return <BootScreen />;
  if (bootstrapError) {
    return <BootError message={bootstrapError} onRetry={retryBootstrap} />;
  }

  return (
    <Suspense fallback={<BootScreen />}>
      <Routes>
        <Route
          path="/login"
          element={
            <SessionRedirect>
              <LoginPage />
            </SessionRedirect>
          }
        />
        <Route
          path="/register"
          element={
            <SessionRedirect>
              <RegisterPage />
            </SessionRedirect>
          }
        />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/password/reset" element={<ResetPasswordPage />} />
        <Route path="/invitations/:token" element={<AcceptInvitationPage />} />
        <Route path="/no-workspace" element={<NoWorkspacePage />} />
        <Route
          path="/orgs/:orgId"
          element={
            <ProtectedRoute>
              <AppShell />
            </ProtectedRoute>
          }
        >
          <Route index element={<OverviewPage />} />
          <Route path="members" element={<MembersPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
        <Route path="/" element={<HomeRedirect />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </Suspense>
  );
}
