import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft,
  CheckCircle2,
  Download,
  Eye,
  FileText,
  MessageSquare,
  RotateCcw,
  ShieldCheck,
} from "lucide-react";
import { CONTENT_TYPE_LABELS, REVIEW_DECISION_LABELS } from "@studioos/shared";
import {
  Alert,
  Badge,
  Button,
  Card,
  EmptyState,
  FormField,
  PageHeader,
  Select,
  Spinner,
  Textarea,
} from "../../components/ui";
import { ContentStatusBadge } from "../../components/status";
import { api, getErrorMessage } from "../../lib/api";
import type { PortalContent, PortalReview } from "../../lib/types";
import { formatBytes, formatDate, formatDateTime } from "../../lib/utils";

type PortalContentResponse = { content: PortalContent };
type DecisionResponse = {
  review: PortalReview;
  content: { id: string; status: PortalContent["status"]; version: number };
};

export function PortalContentPage() {
  const { contentId = "" } = useParams<{ contentId: string }>();
  const navigate = useNavigate();
  const [content, setContent] = useState<PortalContent | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState("");
  const [assetId, setAssetId] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [approving, setApproving] = useState(false);
  const [revising, setRevising] = useState(false);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setLoadError(null);
    api
      .get<PortalContentResponse>(`/client-portal/content-items/${contentId}`)
      .then((response) => {
        if (active) setContent(response.content);
      })
      .catch((requestError: unknown) => {
        if (active) setLoadError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [contentId]);

  async function download(assetIdToDownload: string, disposition: "attachment" | "inline") {
    setDownloadingId(assetIdToDownload);
    setActionError(null);
    try {
      const response = await api.post<{ url: string }>(
        `/client-portal/assets/${assetIdToDownload}/download-url`,
        { disposition },
      );
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setDownloadingId(null);
    }
  }

  async function approve() {
    if (!content) return;
    if (
      !window.confirm(
        "Approve this deliverable for publishing? The production team will be notified.",
      )
    ) {
      return;
    }
    setApproving(true);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.post<DecisionResponse>(
        `/client-portal/content-items/${content.id}/approve`,
        {
          expectedVersion: content.version,
          ...(assetId ? { assetId } : {}),
          ...(feedback.trim() ? { feedback: feedback.trim() } : {}),
        },
      );
      setContent({
        ...content,
        status: response.content.status,
        version: response.content.version,
        reviews: [...content.reviews, response.review],
      });
      setFeedback("");
      setNotice("Approved. The production team has been notified.");
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setApproving(false);
    }
  }

  async function requestRevision(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!content) return;
    if (!feedback.trim()) {
      setActionError("Add revision feedback before sending this back.");
      return;
    }
    setRevising(true);
    setActionError(null);
    setNotice(null);
    try {
      const response = await api.post<DecisionResponse>(
        `/client-portal/content-items/${content.id}/request-revision`,
        {
          expectedVersion: content.version,
          feedback: feedback.trim(),
          ...(assetId ? { assetId } : {}),
        },
      );
      setContent({
        ...content,
        status: response.content.status,
        version: response.content.version,
        reviews: [...content.reviews, response.review],
      });
      setFeedback("");
      setNotice(
        "Revision requested. The production team has been notified and will share a new version.",
      );
    } catch (requestError) {
      setActionError(getErrorMessage(requestError));
    } finally {
      setRevising(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner /> Loading deliverable…
      </div>
    );
  }

  if (loadError || !content) {
    return (
      <div className="space-y-6">
        <Link
          to="/portal"
          className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-accent-600"
        >
          <ArrowLeft className="size-4" /> Back to overview
        </Link>
        <Card>
          <EmptyState
            icon={<FileText className="size-5" />}
            title="Deliverable not available"
            description={
              loadError ?? "This deliverable is not currently shared with your client account."
            }
          />
        </Card>
      </div>
    );
  }

  const awaiting = content.status === "CLIENT_APPROVAL";

  return (
    <div className="space-y-6">
      <Link
        to={`/portal/projects/${content.project.id}`}
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-accent-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to project
      </Link>

      <PageHeader
        eyebrow={`${content.project.name} · ${content.project.client.name}`}
        title={content.title}
        description={`${CONTENT_TYPE_LABELS[content.type]} · version ${content.version}${
          content.deadline ? ` · due ${formatDate(content.deadline)}` : ""
        }`}
        actions={<ContentStatusBadge status={content.status} />}
      />

      {notice ? <Alert tone="success">{notice}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}
      {!awaiting && content.status === "READY_TO_PUBLISH" ? (
        <Alert tone="success" title="Approved for publishing">
          This deliverable is approved. No further action is needed.
        </Alert>
      ) : null}
      {!awaiting && content.status === "EDITING" ? (
        <Alert tone="info" title="Revision requested">
          The production team is working on your feedback. A new version will appear here for
          review.
        </Alert>
      ) : null}

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
        <div className="space-y-5">
          <Card className="p-5">
            <h2 className="font-display text-xl tracking-tight text-ink-900">Brief</h2>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-ink-600">
              {content.description ?? "No brief shared for this deliverable."}
            </p>
          </Card>

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <FileText className="size-4 text-ink-400" aria-hidden="true" />
              <h2 className="font-display text-xl tracking-tight text-ink-900">Files</h2>
              <Badge tone="neutral">{content.assets.length}</Badge>
            </div>
            {content.assets.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">
                No files have been shared with this deliverable.
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-cream-200">
                {content.assets.map((asset) => (
                  <li key={asset.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                    <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-500">
                      <FileText className="size-4" aria-hidden="true" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-ink-900">
                        {asset.originalFilename}
                      </p>
                      <p className="text-[11px] text-ink-500">
                        {formatBytes(asset.sizeBytes)} · {formatDate(asset.createdAt)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-1">
                      {/^(image|video|audio)\/|^application\/pdf$/.test(asset.mimeType) ? (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="px-2"
                          loading={downloadingId === asset.id}
                          onClick={() => void download(asset.id, "inline")}
                          aria-label={`Preview ${asset.originalFilename}`}
                          icon={<Eye className="size-3.5" />}
                        />
                      ) : null}
                      <Button
                        variant="secondary"
                        size="sm"
                        loading={downloadingId === asset.id}
                        onClick={() => void download(asset.id, "attachment")}
                        aria-label={`Download ${asset.originalFilename}`}
                        icon={<Download className="size-3.5" />}
                      >
                        Download
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-5">
          {awaiting ? (
            <Card className="p-5">
              <div className="flex items-center gap-2">
                <ShieldCheck className="size-4 text-accent-600" aria-hidden="true" />
                <h2 className="font-display text-xl tracking-tight text-ink-900">Your review</h2>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-ink-500">
                Approve this version or explain exactly what needs to change.
              </p>

              {content.assets.length > 0 ? (
                <FormField
                  label="File you reviewed"
                  htmlFor="portal-asset"
                  className="mt-4"
                  hint="Optional. Records the file referenced by your decision."
                >
                  <Select
                    id="portal-asset"
                    value={assetId}
                    onChange={(event) => setAssetId(event.target.value)}
                  >
                    <option value="">Whole deliverable</option>
                    {content.assets.map((asset) => (
                      <option key={asset.id} value={asset.id}>
                        {asset.originalFilename}
                      </option>
                    ))}
                  </Select>
                </FormField>
              ) : null}

              <form className="mt-4 space-y-3" onSubmit={requestRevision}>
                <FormField
                  label="Feedback"
                  htmlFor="portal-feedback"
                  hint="Required when requesting a revision. Optional for approval notes."
                >
                  <Textarea
                    id="portal-feedback"
                    value={feedback}
                    onChange={(event) => setFeedback(event.target.value)}
                    placeholder="What works, what needs to change, and any timing notes…"
                    maxLength={10_000}
                    className="min-h-28"
                  />
                </FormField>
                <Button
                  type="submit"
                  variant="danger"
                  className="w-full"
                  loading={revising}
                  disabled={approving || !feedback.trim()}
                  icon={<RotateCcw className="size-4" />}
                >
                  Request revision
                </Button>
              </form>

              <div className="mt-4 border-t border-cream-200 pt-4">
                <Button
                  variant="dark"
                  className="w-full"
                  loading={approving}
                  disabled={revising}
                  onClick={() => void approve()}
                  icon={<CheckCircle2 className="size-4" />}
                >
                  Approve for publishing
                </Button>
              </div>
            </Card>
          ) : (
            <Card className="p-5">
              <h2 className="font-display text-xl tracking-tight text-ink-900">Decision</h2>
              <p className="mt-1 text-sm leading-relaxed text-ink-500">
                {content.status === "READY_TO_PUBLISH"
                  ? "This deliverable is approved for publishing. No further action is needed."
                  : "Your revision request is with the production team. You'll be notified when a new version is ready."}
              </p>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => navigate("/portal")}
              >
                Back to overview
              </Button>
            </Card>
          )}

          <Card className="p-5">
            <div className="flex items-center gap-2">
              <MessageSquare className="size-4 text-ink-400" aria-hidden="true" />
              <h2 className="font-display text-xl tracking-tight text-ink-900">Review history</h2>
              <Badge tone="neutral">{content.reviews.length}</Badge>
            </div>
            {content.reviews.length === 0 ? (
              <p className="mt-3 text-sm text-ink-500">No decisions recorded yet.</p>
            ) : (
              <ul className="mt-4 space-y-3">
                {content.reviews.map((review) => (
                  <li key={review.id} className="rounded-lg border border-cream-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={review.decision === "CLIENT_APPROVED" ? "success" : "danger"}>
                        {REVIEW_DECISION_LABELS[review.decision]}
                      </Badge>
                      <span className="text-[10px] text-ink-400">
                        v{review.contentVersion} · {formatDateTime(review.createdAt)}
                      </span>
                    </div>
                    {review.feedback ? (
                      <p className="mt-2 whitespace-pre-wrap text-xs leading-relaxed text-ink-600">
                        {review.feedback}
                      </p>
                    ) : null}
                    <p className="mt-2 text-[10px] text-ink-400">
                      {review.reviewer?.name ?? "Client"}
                      {review.asset ? ` · ${review.asset.originalFilename}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}
