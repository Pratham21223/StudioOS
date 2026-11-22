import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, FormField, Input } from "../../components/ui";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";

type ForgotResponse = {
  message: string;
  resetUrl?: string;
};

export function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ForgotResponse | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const response = await api.post<ForgotResponse>("/auth/password/forgot", { email });
      setResult(response);
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
            Account recovery
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">
            Reset your password.
          </h1>
          <p className="text-sm leading-relaxed text-ink-500">
            Enter the email tied to your StudioOS account. If it exists, we&apos;ll send a
            single-use reset link.
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}

        {result ? (
          <div className="space-y-4">
            <Alert tone="success" title="Request received">
              {result.message}
            </Alert>

            {result.resetUrl ? (
              <div className="rounded-xl border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-4">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
                  Development helper
                </p>
                <p className="mt-1 text-sm leading-relaxed text-ink-600">
                  Email delivery is not enabled in this milestone. Use this local link to finish the
                  reset flow.
                </p>
                <a
                  href={result.resetUrl}
                  className="mt-3 inline-flex items-center gap-2 rounded-lg bg-ink-900 px-3.5 py-2 text-sm font-medium text-cream-50 transition hover:bg-ink-800"
                >
                  Open reset link
                </a>
              </div>
            ) : null}

            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </div>
        ) : (
          <form className="space-y-4" onSubmit={handleSubmit}>
            <FormField label="Email address" htmlFor="email" error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@studio.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
                autoFocus
              />
            </FormField>

            <Button
              type="submit"
              className="w-full"
              loading={submitting}
              icon={<Mail className="size-4" />}
            >
              Send reset link
            </Button>

            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 transition hover:text-accent-600"
            >
              <ArrowLeft className="size-4" aria-hidden="true" />
              Back to sign in
            </Link>
          </form>
        )}
      </div>
    </AuthLayout>
  );
}
