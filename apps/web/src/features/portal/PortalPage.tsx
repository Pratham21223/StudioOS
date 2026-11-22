import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Building2, CalendarClock, Clapperboard, FolderKanban } from "lucide-react";
import { useAuth } from "../../app/AuthProvider";
import { Alert, Badge, Card, EmptyState, Spinner } from "../../components/ui";
import { ProjectStatusBadge } from "../../components/status";
import { api, getErrorMessage } from "../../lib/api";
import type { PortalProject } from "../../lib/types";
import { formatDate } from "../../lib/utils";

type PortalProjectsResponse = { projects: PortalProject[] };

export function PortalPage() {
  const { user, clientMemberships } = useAuth();
  const [projects, setProjects] = useState<PortalProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api
      .get<PortalProjectsResponse>("/client-portal/projects")
      .then((response) => {
        if (active) setProjects(response.projects);
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
  }, []);

  if (!user) return null;

  const awaiting = projects.reduce((total, project) => total + project.awaitingReviewCount, 0);
  const clients = Array.from(new Set(clientMemberships.map((item) => item.client.name)));

  return (
    <div className="space-y-6">
      <section className="studio-grid relative overflow-hidden rounded-2xl bg-ink-900 px-6 py-7 text-cream-50 shadow-card sm:px-8">
        <div className="studio-glow pointer-events-none absolute inset-0" aria-hidden="true" />
        <div className="relative z-10 max-w-2xl space-y-3">
          <Badge tone="accent" className="border-accent-400/20 bg-accent-500/10 text-accent-400">
            Client review portal
          </Badge>
          <h1 className="font-display text-3xl leading-tight tracking-tight sm:text-4xl">
            Welcome, {user.name.split(" ")[0]}.
          </h1>
          <p className="text-sm leading-relaxed text-ink-300">
            {clients.length > 0
              ? `Reviewing work for ${clients.join(", ")}. Approve deliverables or send clear revision feedback.`
              : "Review submitted deliverables, approve work, and request revisions."}
          </p>
        </div>
      </section>

      {error ? <Alert tone="error">{error}</Alert> : null}

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading your projects…
        </div>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Projects
              </p>
              <p className="mt-1 font-display text-3xl text-ink-900">{projects.length}</p>
            </Card>
            <Card className="p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Awaiting your review
              </p>
              <p className="mt-1 font-display text-3xl text-ink-900">{awaiting}</p>
            </Card>
            <Card className="col-span-2 p-4 sm:col-span-1">
              <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-ink-400">
                Deliverables shared
              </p>
              <p className="mt-1 font-display text-3xl text-ink-900">
                {projects.reduce((total, project) => total + project.visibleContentCount, 0)}
              </p>
            </Card>
          </div>

          {projects.length === 0 ? (
            <Card>
              <EmptyState
                icon={<FolderKanban className="size-5" />}
                title="No projects shared yet"
                description="Your studio will share projects and submitted deliverables here."
              />
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/portal/projects/${project.id}`}
                  className="group rounded-xl border border-cream-200 bg-white p-5 shadow-card transition hover:-translate-y-0.5 hover:border-cream-300 hover:shadow-lg"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-600">
                        <FolderKanban className="size-5" aria-hidden="true" />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-display text-xl leading-tight text-ink-900">
                          {project.name}
                        </p>
                        <p className="flex items-center gap-1.5 text-xs text-ink-500">
                          <Building2 className="size-3.5" aria-hidden="true" />
                          {project.client.name}
                        </p>
                      </div>
                    </div>
                    <ProjectStatusBadge status={project.status} />
                  </div>

                  <p className="mt-3 line-clamp-2 min-h-9 text-xs leading-relaxed text-ink-500">
                    {project.description ?? "No project brief shared."}
                  </p>

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-cream-200 pt-3 text-[11px] text-ink-500">
                    <span className="flex items-center gap-1.5">
                      <Clapperboard className="size-3.5 text-ink-400" aria-hidden="true" />
                      {project.visibleContentCount} shared{" "}
                      {project.visibleContentCount === 1 ? "deliverable" : "deliverables"}
                    </span>
                    {project.deadline ? (
                      <span className="flex items-center gap-1.5">
                        <CalendarClock className="size-3.5 text-ink-400" aria-hidden="true" />
                        Due {formatDate(project.deadline)}
                      </span>
                    ) : null}
                    {project.awaitingReviewCount > 0 ? (
                      <Badge tone="danger">{project.awaitingReviewCount} awaiting review</Badge>
                    ) : null}
                    <span className="ml-auto inline-flex items-center gap-1 font-medium text-ink-500 transition group-hover:text-accent-600">
                      Open project
                      <ArrowRight className="size-3.5" aria-hidden="true" />
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
