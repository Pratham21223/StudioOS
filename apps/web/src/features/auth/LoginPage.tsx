import { useState, type FormEvent } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, FormField, Input, PasswordInput } from "../../components/ui";
import { getErrorMessage, getFieldErrors } from "../../lib/api";
import { safeNextPath } from "../../lib/utils";
import { useAuth } from "../../app/AuthProvider";

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const destination = await login({ email, password });
      const next = safeNextPath(searchParams.get("next"));
      navigate(next ?? destination ?? "/no-workspace", {
        replace: true,
      });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setFieldErrors(getFieldErrors(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-7">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Workspace sign in
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">Welcome back.</h1>
          <p className="text-sm leading-relaxed text-ink-500">
            Sign in to manage your studio&apos;s clients, projects, and production pipeline.
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Email address" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              autoFocus
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
            hint={
              <span className="flex justify-end">
                <Link
                  to="/forgot-password"
                  className="font-medium text-ink-600 underline decoration-cream-300 underline-offset-4 transition hover:text-accent-600"
                >
                  Forgot password?
                </Link>
              </span>
            }
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
            />
          </FormField>

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            icon={<ArrowRight className="size-4" />}
          >
            Sign in
          </Button>
        </form>

        <p className="text-sm text-ink-500">
          New to StudioOS?{" "}
          <Link
            to="/register"
            className="font-medium text-ink-900 underline decoration-cream-300 underline-offset-4 transition hover:text-accent-600"
          >
            Create a workspace
          </Link>
        </p>

        <div className="border-t border-cream-200 pt-5 text-xs leading-relaxed text-ink-400">
          Sessions use secure, HTTP-only cookies. Access is always checked against your active
          workspace membership.
        </div>
      </div>
    </AuthLayout>
  );
}
