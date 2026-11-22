import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowRight, CalendarClock, LogOut, Mail, ShieldCheck, Users } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import {
  Alert,
  Badge,
  Button,
  FormField,
  Input,
  PasswordInput,
  Spinner,
} from "../../components/ui";
import { api, getErrorMessage, getFieldErrors, isApiError } from "../../lib/api";
import type { InvitationPreview } from "../../lib/types";
import { formatDate, roleLabel } from "../../lib/utils";
import { useAuth } from "../../app/AuthProvider";

type PreviewResponse = {
  invitation: InvitationPreview;
};

export function AcceptInvitationPage() {
  const { token = "" } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { user, acceptInvitation, logout } = useAuth();
  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [signInRequired, setSignInRequired] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const nextPath = `/invitations/${token}`;
  const signInHref = `/login?next=${encodeURIComponent(nextPath)}`;

  useEffect(() => {
    let active = true;
    if (!token) {
      setLoading(false);
      setLoadError("This invitation link is missing its token.");
      return;
    }

    api
      .get<PreviewResponse>(`/invitations/${encodeURIComponent(token)}`)
      .then((response) => {
        if (active) setPreview(response.invitation);
      })
      .catch((loadFailure: unknown) => {
        if (active) setLoadError(getErrorMessage(loadFailure));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [token]);

  async function handleAccept(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!preview) return;

    setSubmitting(true);
    setError(null);
    setSignInRequired(false);
    setFieldErrors({});

    try {
      const organizationId = await acceptInvitation({
        token,
        ...(user ? {} : { name, password }),
      });
      navigate(organizationId ? `/orgs/${organizationId}` : "/no-workspace", { replace: true });
    } catch (acceptError) {
      setError(getErrorMessage(acceptError));
      setFieldErrors(getFieldErrors(acceptError));
      if (isApiError(acceptError) && acceptError.code === "SIGN_IN_REQUIRED") {
        setSignInRequired(true);
      }
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSignOut() {
    setSigningOut(true);
    setError(null);
    try {
      await logout();
    } catch (signOutError) {
      setError(getErrorMessage(signOutError));
    } finally {
      setSigningOut(false);
    }
  }

  if (loading) {
    return (
      <AuthLayout>
        <div className="flex items-center gap-3 text-sm text-ink-500">
          <Spinner className="size-4" />
          Checking this invitation…
        </div>
      </AuthLayout>
    );
  }

  if (loadError || !preview) {
    return (
      <AuthLayout>
        <div className="space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Invitation
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">
            This invitation isn&apos;t available.
          </h1>
          <Alert tone="error">{loadError ?? "The invitation could not be loaded."}</Alert>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-900 underline decoration-cream-300 underline-offset-4"
          >
            Go to sign in
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const statusCopy: Record<
    Exclude<InvitationPreview["status"], "PENDING">,
    { title: string; body: string }
  > = {
    ACCEPTED: {
      title: "This invitation was already accepted.",
      body: "Sign in with the invited email address to open the workspace.",
    },
    EXPIRED: {
      title: "This invitation has expired.",
      body: "Ask a workspace admin to send a fresh invitation.",
    },
    REVOKED: {
      title: "This invitation was revoked.",
      body: "Ask a workspace admin if you still need access.",
    },
  };

  if (preview.status !== "PENDING") {
    const copy = statusCopy[preview.status];
    return (
      <AuthLayout>
        <div className="space-y-5">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Invitation
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">{copy.title}</h1>
          <p className="text-sm leading-relaxed text-ink-500">{copy.body}</p>
          <Link
            to="/login"
            className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-ink-800"
          >
            Sign in
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </AuthLayout>
    );
  }

  const emailMismatch = Boolean(user && user.email.toLowerCase() !== preview.email.toLowerCase());

  return (
    <AuthLayout>
      <div className="space-y-6">
        <div className="space-y-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Workspace invitation
          </p>
          <h1 className="font-display text-4xl leading-tight tracking-tight text-ink-900">
            Join {preview.organization.name}.
          </h1>
          <p className="text-sm leading-relaxed text-ink-500">
            You&apos;ve been invited to collaborate in StudioOS. Accept the invitation to open the
            workspace.
          </p>
        </div>

        <div className="space-y-3 rounded-xl border border-cream-200 bg-white p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm text-ink-700">
              <Mail className="size-4 text-ink-400" aria-hidden="true" />
              {preview.email}
            </div>
            <Badge tone="accent">{roleLabel(preview.role)}</Badge>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <Users className="size-4 text-ink-400" aria-hidden="true" />
            {preview.organization.name}
            <span className="text-ink-300">/</span>
            <span>{preview.organization.slug}</span>
          </div>
          <div className="flex items-center gap-2 text-sm text-ink-500">
            <CalendarClock className="size-4 text-ink-400" aria-hidden="true" />
            Expires {formatDate(preview.expiresAt)}
          </div>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {emailMismatch && user ? (
          <div className="space-y-4">
            <Alert tone="warning" title="Signed in with a different account">
              You&apos;re signed in as <span className="font-medium">{user.email}</span>, but this
              invitation belongs to <span className="font-medium">{preview.email}</span>.
            </Alert>
            <Button
              variant="secondary"
              onClick={() => void handleSignOut()}
              loading={signingOut}
              icon={<LogOut className="size-4" />}
            >
              Sign out and continue
            </Button>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleAccept}>
            {!user ? (
              <>
                <FormField label="Your name" htmlFor="name" error={fieldErrors.name}>
                  <Input
                    id="name"
                    autoComplete="name"
                    placeholder="Priya Sharma"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    required
                  />
                </FormField>
                <FormField
                  label="Create a password"
                  htmlFor="password"
                  error={fieldErrors.password}
                  hint="At least 12 characters. You'll use this to sign in next time."
                >
                  <PasswordInput
                    id="password"
                    autoComplete="new-password"
                    placeholder="Create a strong password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    minLength={12}
                    required
                  />
                </FormField>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm text-ink-500">
                <ShieldCheck className="size-4 text-moss-500" aria-hidden="true" />
                Signed in as <span className="font-medium text-ink-800">{user.email}</span>
              </div>
            )}

            {signInRequired ? (
              <Link
                to={signInHref}
                className="inline-flex items-center gap-2 text-sm font-medium text-accent-600 underline decoration-accent-500/30 underline-offset-4"
              >
                Sign in to this account instead
              </Link>
            ) : null}

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              icon={<ArrowRight className="size-4" />}
            >
              {user ? "Accept invitation" : "Create account and join"}
            </Button>

            {!user ? (
              <p className="text-center text-sm text-ink-500">
                Already have an account?{" "}
                <Link
                  to={signInHref}
                  className="font-medium text-ink-900 underline decoration-cream-300 underline-offset-4 transition hover:text-accent-600"
                >
                  Sign in
                </Link>
              </p>
            ) : null}
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
