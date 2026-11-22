import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Download, FileText, Paperclip, Search, ShieldAlert } from "lucide-react";
import { PERMISSIONS, hasPermission } from "@studioos/shared";
import { useAuth } from "../../app/AuthProvider";
import {
  Alert,
  Button,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  Spinner,
} from "../../components/ui";
import { api, getErrorMessage } from "../../lib/api";
import type { Asset, Project } from "../../lib/types";
import { formatBytes, formatDate } from "../../lib/utils";
import { useActiveMembership } from "../organizations/useActiveMembership";

type AssetListResponse = { assets: Asset[] };
type ProjectListResponse = { projects: Project[] };

export function AssetsPage() {
  const { user } = useAuth();
  const membership = useActiveMembership();
  const [searchParams] = useSearchParams();
  const organizationId = membership?.organization.id;
  const canViewAssets = membership
    ? hasPermission(membership.role, PERMISSIONS.CONTENT_VIEW)
    : false;

  const [assets, setAssets] = useState<Asset[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [projectFilter, setProjectFilter] = useState(searchParams.get("projectId") ?? "");
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    if (!organizationId || !canViewAssets) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    setLoadError(null);

    Promise.all([
      api.get<AssetListResponse>(`/organizations/${organizationId}/assets`),
      api.get<ProjectListResponse>(`/organizations/${organizationId}/projects`),
    ])
      .then(([assetResponse, projectResponse]) => {
        if (!active) return;
        setAssets(assetResponse.assets);
        setProjects(projectResponse.projects);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(getErrorMessage(error));
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [organizationId, canViewAssets]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return assets.filter((asset) => {
      if (projectFilter && asset.project.id !== projectFilter) return false;
      if (!query) return true;
      return (
        asset.originalFilename.toLowerCase().includes(query) ||
        asset.project.name.toLowerCase().includes(query) ||
        (asset.contentItem?.title ?? "").toLowerCase().includes(query)
      );
    });
  }, [assets, search, projectFilter]);

  async function download(asset: Asset, disposition: "attachment" | "inline") {
    if (!organizationId) return;
    setDownloadingId(asset.id);
    setActionError(null);
    try {
      const response = await api.post<{ url: string }>(
        `/organizations/${organizationId}/assets/${asset.id}/download-url`,
        { disposition },
      );
      window.open(response.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setActionError(getErrorMessage(error));
    } finally {
      setDownloadingId(null);
    }
  }

  if (!membership || !user) return null;

  if (!canViewAssets) {
    return (
      <div className="space-y-6">
        <PageHeader eyebrow="Production files" title="Assets" />
        <Card>
          <EmptyState
            icon={<ShieldAlert className="size-5" />}
            title="Assets are restricted"
            description="Your role doesn't include file access in this workspace."
          />
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Production files"
        title="Asset library"
        description="Every uploaded deliverable and reference, with authorized signed downloads."
      />

      {loadError ? <Alert tone="error">{loadError}</Alert> : null}
      {actionError ? <Alert tone="error">{actionError}</Alert> : null}

      <Card className="p-4">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_14rem]">
          <div className="relative">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-400"
              aria-hidden="true"
            />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search files, projects, or content"
              aria-label="Search assets"
              className="pl-9"
            />
          </div>
          <Select
            aria-label="Filter assets by project"
            value={projectFilter}
            onChange={(event) => setProjectFilter(event.target.value)}
          >
            <option value="">All projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      </Card>

      {loading ? (
        <div className="flex min-h-[30vh] items-center justify-center gap-2 text-sm text-ink-500">
          <Spinner /> Loading assets…
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Paperclip className="size-5" />}
            title={assets.length === 0 ? "No assets yet" : "No assets match those filters"}
            description={
              assets.length === 0
                ? "Upload files from a content item to build the production library."
                : "Try another search term or project."
            }
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <ul className="divide-y divide-cream-200">
            {filtered.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-cream-100 text-ink-500">
                  <FileText className="size-4" aria-hidden="true" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-ink-900">
                    {asset.originalFilename}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-ink-500">
                    <span>{asset.project.name}</span>
                    {asset.contentItem ? (
                      <>
                        <span aria-hidden="true">·</span>
                        <Link
                          to={`/orgs/${membership.organization.id}/content/${asset.contentItem.id}`}
                          className="text-accent-600 hover:text-accent-700"
                        >
                          {asset.contentItem.title}
                        </Link>
                      </>
                    ) : null}
                    <span aria-hidden="true">·</span>
                    <span>{formatBytes(asset.sizeBytes)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(asset.createdAt)}</span>
                  </p>
                </div>
                <div className="flex items-center gap-2 sm:pl-3">
                  {/^(image|video|audio)\/|^application\/pdf$/.test(asset.mimeType) ? (
                    <Button
                      variant="secondary"
                      size="sm"
                      disabled={downloadingId === asset.id}
                      onClick={() => void download(asset, "inline")}
                    >
                      Preview
                    </Button>
                  ) : null}
                  <Button
                    variant="ghost"
                    size="sm"
                    loading={downloadingId === asset.id}
                    onClick={() => void download(asset, "attachment")}
                    icon={<Download className="size-3.5" />}
                  >
                    Download
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
