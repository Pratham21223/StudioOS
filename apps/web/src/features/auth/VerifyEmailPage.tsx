import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, ArrowRight, MailCheck } from "lucide-react";
import { AuthLayout } from "../../components/AuthLayout";
import { Alert, Button, FormField, Input } from "../../components/ui";
import { getErrorMessage, getFieldErrors } from "../../lib/api";
import { useAuth } from "../../app/AuthProvider";

type VerifyLocationState = {
  email?: string;
  devCode?: string;
  expiresInMinutes?: number;
  resendAfterSeconds?: number;
};

export function VerifyEmailPage() {
  const { verifyEmail, resendVerification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const state = (location.state as VerifyLocationState | null) ?? {};

  const [email, setEmail] = useState(state.email ?? searchParams.get("email") ?? "");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState(state.devCode);
  const [cooldown, setCooldown] = useState(state.resendAfterSeconds ?? 0);
  const [submitting, setSubmitting] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    setFieldErrors({});

    try {
      const destination = await verifyEmail({ email, code });
      navigate(destination ?? "/no-workspace", { replace: true });
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setFieldErrors(getFieldErrors(submitError));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResend() {
    setResending(true);
    setError(null);
    setNotice(null);

    try {
      const result = await resendVerification(email);
      setDevCode(result.devCode ?? devCode);
      setCooldown(result.resendAfterSeconds);
      setNotice(result.message);
    } catch (resendError) {
      setError(getErrorMessage(resendError));
    } finally {
      setResending(false);
    }
  }

  return (
    <AuthLayout>
      <div className="space-y-7">
        <div className="space-y-2">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-600">
            Verify your email
          </p>
          <h1 className="font-display text-4xl tracking-tight text-ink-900">Check your inbox.</h1>
          <p className="text-sm leading-relaxed text-ink-500">
            {email ? (
              <>
                We sent a 6-digit code to <span className="font-medium text-ink-800">{email}</span>.
                Enter it to finish creating your workspace.
              </>
            ) : (
              "Enter the email address you signed up with and the 6-digit code we sent you."
            )}
          </p>
        </div>

        {error ? <Alert tone="error">{error}</Alert> : null}
        {notice ? <Alert tone="success">{notice}</Alert> : null}

        {devCode ? (
          <div className="rounded-xl border border-dashed border-accent-500/30 bg-accent-500/[0.04] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-600">
              Development verification code
            </p>
            <p className="mt-1 font-mono text-2xl tracking-[0.35em] text-ink-900">{devCode}</p>
            <p className="mt-1 text-xs leading-relaxed text-ink-500">
              Email delivery is queued locally. Use this code to finish signup.
            </p>
          </div>
        ) : null}

        <form className="space-y-4" onSubmit={handleSubmit}>
          {!state.email && !searchParams.get("email") ? (
            <FormField label="Email address" htmlFor="email" error={fieldErrors.email}>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@studio.com"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </FormField>
          ) : null}

          <FormField
            label="Verification code"
            htmlFor="code"
            error={fieldErrors.code}
            hint={
              state.expiresInMinutes
                ? `The code expires in ${state.expiresInMinutes} minutes.`
                : "Enter the 6-digit code from your email."
            }
          >
            <Input
              id="code"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))}
              pattern="[0-9]{6}"
              maxLength={6}
              className="text-center font-mono text-xl tracking-[0.4em]"
              required
              autoFocus
            />
          </FormField>

          <Button
            type="submit"
            className="w-full"
            loading={submitting}
            icon={<MailCheck className="size-4" />}
          >
            Verify email
          </Button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-cream-200 pt-5">
          <p className="text-xs text-ink-500">Didn&apos;t receive a code?</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => void handleResend()}
            disabled={resending || cooldown > 0 || !email}
            loading={resending}
          >
            {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 font-medium text-ink-600 transition hover:text-accent-600"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to sign in
          </Link>
          <Link
            to="/register"
            className="inline-flex items-center gap-2 font-medium text-ink-600 transition hover:text-accent-600"
          >
            Use a different email
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </AuthLayout>
  );
}
