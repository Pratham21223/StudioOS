import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  CalendarClock,
  Clapperboard,
  FileText,
  FolderKanban,
} from "lucide-react";
import { Badge, Card, EmptyState, PageHeader, Spinner } from "../../components/ui";
import { ContentStatusBadge, ProjectStatusBadge } from "../../components/status";
import { api, getErrorMessage } from "../../lib/api";
import type { PortalContent, PortalProject } from "../../lib/types";
import { formatBytes, formatDate } from "../../lib/utils";
import { CONTENT_TYPE_LABELS } from "@studioos/shared";

type PortalProjectResponse = {
  project: PortalProject;
  content: PortalContent[];
};

export function PortalProjectPage() {
  const { projectId = "" } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<PortalProject | null>(null);
  const [content, setContent] = useState<PortalContent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<PortalProjectResponse>(`/client-portal/projects/${projectId}/content-items`)
      .then((response) => {
        if (!active) return;
        setProject(response.project);
        setContent(response.content);
      })
      .catch((requestError: unknown) => {
        if (active) setError(getErrorMessage(requestError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [projectId]);

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center gap-2 text-sm text-ink-500">
        <Spinner /> Loading project…
      </div>
    );
  }

  if (error || !project) {
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
            icon={<FolderKanban className="size-5" />}
            title="Project not available"
            description={error ?? "This project is not shared with your client account."}
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Link
        to="/portal"
        className="inline-flex items-center gap-2 text-sm font-medium text-ink-600 hover:text-accent-600"
      >
        <ArrowLeft className="size-4" aria-hidden="true" /> Back to overview
      </Link>

      <PageHeader
        eyebrow={project.client.name}
        title={project.name}
        description={project.description ?? "Submitted deliverables for your review."}
        actions={<ProjectStatusBadge status={project.status} />}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Shared deliverables
          </p>
          <p className="mt-1 font-display text-3xl text-ink-900">{content.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Awaiting review
          </p>
          <p className="mt-1 font-display text-3xl text-ink-900">
            {content.filter((item) => item.status === "CLIENT_APPROVAL").length}
          </p>
        </Card>
        <Card className="p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
            Project deadline
          </p>
          <p className="mt-2 text-sm font-medium text-ink-900">
            {project.deadline ? formatDate(project.deadline) : "Not set"}
          </p>
        </Card>
      </div>

      {content.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Clapperboard className="size-5" />}
            title="No deliverables shared yet"
            description="Your studio will publish work here when it is ready for client review."
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {content.map((item) => (
            <Link
              key={item.id}
              to={`/portal/content/${item.id}`}
              className="group rounded-xl border border-cream-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-cream-300 hover:shadow-lg"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-display text-xl leading-tight text-ink-900">
                    {item.title}
                  </p>
                  <p className="mt-0.5 text-xs text-ink-500">
                    {CONTENT_TYPE_LABELS[item.type]} · v{item.version}
                  </p>
                </div>
                <ContentStatusBadge status={item.status} />
              </div>

              <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-ink-500">
                {item.description ?? "No brief shared."}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-cream-200 pt-3 text-[11px] text-ink-500">
                <span className="flex items-center gap-1.5">
                  <FileText className="size-3.5 text-ink-400" aria-hidden="true" />
                  {item.assets.length} {item.assets.length === 1 ? "file" : "files"}
                  {item.assets[0] ? ` · ${formatBytes(item.assets[0].sizeBytes)}` : ""}
                </span>
                {item.deadline ? (
                  <span className="flex items-center gap-1.5">
                    <CalendarClock className="size-3.5 text-ink-400" aria-hidden="true" />
                    Due {formatDate(item.deadline)}
                  </span>
                ) : null}
                {item.status === "CLIENT_APPROVAL" ? (
                  <Badge tone="danger">Awaiting your review</Badge>
                ) : (
                  <Badge tone="success">Approved</Badge>
                )}
                <span className="ml-auto inline-flex items-center gap-1 font-medium text-ink-500 transition group-hover:text-accent-600">
                  Open
                  <ArrowRight className="size-3.5" aria-hidden="true" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
