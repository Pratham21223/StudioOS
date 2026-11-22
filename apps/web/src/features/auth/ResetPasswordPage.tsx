import { useState, type FormEvent } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowRight, ShieldCheck } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, FormField, PasswordInput } from "../../components/ui";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [complete, setComplete] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setFieldErrors({});

    if (password !== confirmPassword) {
      setFieldErrors({ confirmPassword: "Passwords do not match." });
      return;
    }

    if (!token) {
      setError("This reset link is missing its token.");
      return;
    }

    setSubmitting(true);
    try {
      await api.post("/auth/password/reset", { token, password });
      try {
        await api.initCsrf();
      } catch {
        // The sign-in page can request a fresh token if this fails.
      }
      setComplete(true);
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setFieldErrors(getFieldErrors(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  if (!token) {
    return (
      <AuthLayout>
        <div className="space-y-5">
          <h1 className="font-display text-4xl tracking-tight text-ink-900">Invalid reset link.</h1>
          <Alert tone="error">
            This link is missing a token. Request a new password reset email from the sign-in page.
          </Alert>
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-2 text-sm font-medium text-ink-900 underline decoration-cream-300 underline-offset-4"
          >
            Request a new link
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <div className="space-y-7">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Account recovery
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">
            Choose a new password.
          </h1>
          <p className="text-sm leading-relaxed text-ink-500">
            Resetting your password signs out every active StudioOS session.
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {complete ? (
          <div className="space-y-4">
            <Alert tone="success" title="Password updated">
              Your password has been changed. Sign in with the new password to continue.
            </Alert>
            <Link
              to="/login"
              className="inline-flex items-center gap-2 rounded-lg bg-ink-900 px-4 py-2.5 text-sm font-medium text-cream-50 transition hover:bg-ink-800"
            >
              Go to sign in
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField
              label="New password"
              htmlFor="password"
              error={fieldErrors.password}
              hint="At least 12 characters."
            >
              <PasswordInput
                id="password"
                autoComplete="new-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                minLength={12}
                required
                autoFocus
              />
            </FormField>

            <FormField
              label="Confirm new password"
              htmlFor="confirmPassword"
              error={fieldErrors.confirmPassword}
            >
              <PasswordInput
                id="confirmPassword"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                minLength={12}
                required
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              icon={<ShieldCheck className="size-4" />}
            >
              Update password
            </Button>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
