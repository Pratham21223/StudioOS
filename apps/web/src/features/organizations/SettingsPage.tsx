import { useEffect, useState, type FormEvent } from "react";
import { Building2, CheckCircle2, ShieldCheck } from "lucide-react";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  PageHeader,
} from "../../components/ui";
import { api, getErrorMessage, getFieldErrors } from "../../lib/api";
import type { Organization } from "../../lib/types";
import { formatDate, roleLabel } from "../../lib/utils";
import { useActiveMembership } from "./useActiveMembership";

export function SettingsPage() {
  const { user, refresh } = useAuth();
  const membership = useActiveMembership();
  const canManage = membership
    ? hasPermission(membership.role, PERMISSIONS.ORGANIZATION_MANAGE)
    : false;

  const [name, setName] = useState(membership?.organization.name ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    setName(membership?.organization.name ?? "");
  }, [membership?.organization.name]);

  if (!membership || !user) return null;

  if (!canManage) {
    return (
      <div className="space-y-6">
        <PageHeader
          eyebrow="Workspace"
          title="Settings"
          description="Workspace settings are restricted to administrators."
        />
        <Card>
          <EmptyState
            icon={<ShieldCheck className="size-5" />}
            title="Admin access required"
            description="You can keep working in projects and content, but only workspace admins can change organization settings."
          />
        </Card>
      </div>
    );
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!membership) return;
    setSaving(true);
    setError(null);
    setFieldErrors({});
    setSaved(false);

    try {
      const response = await api.patch<{ organization: Organization }>(
        `/organizations/${membership.organization.id}`,
        { name },
      );
      setName(response.organization.name);
      setSaved(true);
      await refresh();
    } catch (submitError) {
      setError(getErrorMessage(submitError));
      setFieldErrors(getFieldErrors(submitError));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Workspace"
        title="Settings"
        description="Manage how your production workspace appears to your team."
        actions={<Badge tone="accent">{roleLabel(membership.role)}</Badge>}
      />

      {saved ? (
        <Alert tone="success" title="Workspace updated">
          Your workspace name was saved.
        </Alert>
      ) : null}
      {error ? <Alert tone="error">{error}</Alert> : null}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <Card className="p-5 sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
              <Building2 className="size-4" aria-hidden="true" />
            </span>
            <div>
              <h2 className="font-display text-xl tracking-tight text-ink-900">
                Organization profile
              </h2>
              <p className="text-xs text-ink-500">
                The name appears in the workspace switcher, invitations, and member views.
              </p>
            </div>
          </div>

          <form className="mt-5 space-y-4" onSubmit={handleSubmit}>
            <FormField label="Workspace name" htmlFor="organization-name" error={fieldErrors.name}>
              <Input
                id="organization-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={160}
                required
              />
            </FormField>

            <FormField
              label="Workspace slug"
              htmlFor="organization-slug"
              hint="The workspace slug is permanent."
            >
              <Input
                id="organization-slug"
                readOnly
                value={membership.organization.slug}
                className="bg-cream-50 font-medium"
              />
            </FormField>

            <div className="flex items-center gap-2 border-t border-cream-200 pt-4">
              <Button type="submit" loading={saving} icon={<CheckCircle2 className="size-4" />}>
                Save changes
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setName(membership.organization.name);
                  setError(null);
                  setFieldErrors({});
                  setSaved(false);
                }}
              >
                Reset
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Workspace details</h2>
            <dl className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-4 border-b border-cream-200 pb-3">
                <dt className="text-ink-500">Status</dt>
                <dd>
                  <Badge tone={membership.organization.status === "ACTIVE" ? "success" : "danger"}>
                    {membership.organization.status === "ACTIVE" ? "Active" : "Deactivated"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-cream-200 pb-3">
                <dt className="text-ink-500">Created</dt>
                <dd className="text-ink-800">{formatDate(membership.organization.createdAt)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4 border-b border-cream-200 pb-3">
                <dt className="text-ink-500">Your role</dt>
                <dd className="text-ink-800">{roleLabel(membership.role)}</dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-ink-500">Membership</dt>
                <dd className="font-mono text-[11px] text-ink-500">{membership.id.slice(0, 8)}…</dd>
              </div>
            </dl>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <ShieldCheck className="size-4 text-moss-500" aria-hidden="true" />
              <h2 className="font-display text-lg tracking-tight text-ink-900">Security notes</h2>
            </div>
            <ul className="mt-3 space-y-2.5 text-xs leading-relaxed text-ink-500">
              <li>Organization and role data are always resolved on the server.</li>
              <li>Deactivated members lose workspace access on their next request.</li>
              <li>At least one active admin is required at all times.</li>
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
