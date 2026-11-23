import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, FormField, Input, PasswordInput } from "../../components/ui";
import { getErrorMessage, getFieldErrors } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";
import { OAuthButtons } from "./OAuthButtons";

export function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [organizationName, setOrganizationName] = useState("");
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
      const pending = await register({ name, email, password, organizationName });
      navigate("/verify-email", {
        replace: true,
        state: {
          email: pending.email,
          devCode: pending.devCode,
          expiresInMinutes: pending.expiresInMinutes,
          resendAfterSeconds: pending.resendAfterSeconds,
        },
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
            New workspace
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">
            Start your studio&apos;s operating system.
          </h1>
          <p className="text-sm leading-relaxed text-ink-500">
            Create the workspace and become its first admin. You can invite the rest of your team
            next.
          </p>
        </div>

        <OAuthButtons action="Sign up" />

        {error ? <Alert tone="error">{error}</Alert> : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          <FormField label="Your name" htmlFor="name" error={fieldErrors.name}>
            <Input
              id="name"
              name="name"
              autoComplete="name"
              placeholder="Alex Rivera"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              autoFocus
            />
          </FormField>

          <FormField
            label="Workspace name"
            htmlFor="organizationName"
            error={fieldErrors.organizationName}
            hint="Your agency or production company. The workspace URL is generated from this."
          >
            <Input
              id="organizationName"
              name="organizationName"
              autoComplete="organization"
              placeholder="Your studio or agency"
              value={organizationName}
              onChange={(event) => setOrganizationName(event.target.value)}
              minLength={2}
              maxLength={160}
              required
            />
          </FormField>

          <FormField label="Work email" htmlFor="email" error={fieldErrors.email}>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@studio.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </FormField>

          <FormField
            label="Password"
            htmlFor="password"
            error={fieldErrors.password}
            hint="At least 12 characters. Stored only as an Argon2id hash."
          >
            <PasswordInput
              id="password"
              name="password"
              autoComplete="new-password"
              placeholder="Create a strong password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={12}
              required
            />
          </FormField>

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            icon={<ArrowRight className="size-4" />}
          >
            Create workspace
          </Button>
        </form>

        <p className="text-sm text-ink-500">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-ink-900 underline decoration-cream-300 underline-offset-4 transition hover:text-accent-600"
          >
            Sign in
          </Link>
        </p>
      </div>
    </AuthLayout>
  );
}
