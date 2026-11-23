import { useEffect, useState, type ReactElement } from "react";
import { api, apiBaseUrl } from "../../lib/api";
import type { OAuthProviderSummary, OAuthProvidersResponse } from "../../lib/types";

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M23.49 12.27c0-.79-.07-1.54-.19-2.27H12v4.51h6.47a5.54 5.54 0 0 1-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82Z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96H1.29v3.09A11.99 11.99 0 0 0 12 24Z"
      />
      <path
        fill="#FBBC05"
        d="M5.27 14.29A7.2 7.2 0 0 1 4.89 12c0-.8.14-1.57.38-2.29V6.62H1.29a11.99 11.99 0 0 0 0 10.76l3.98-3.09Z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.7 0 3.99 2.47 1.29 6.62l3.98 3.09C6.22 6.86 8.87 4.75 12 4.75Z"
      />
    </svg>
  );
}

function GitHubMark() {
  return (
    <svg viewBox="0 0 24 24" className="size-4" fill="currentColor" aria-hidden="true">
      <path d="M12 .5A11.5 11.5 0 0 0 .5 12a11.5 11.5 0 0 0 7.86 10.92c.58.1.79-.25.79-.55v-2.1c-3.2.7-3.88-1.37-3.88-1.37-.52-1.33-1.28-1.69-1.28-1.69-1.05-.71.08-.7.08-.7 1.16.08 1.77 1.19 1.77 1.19 1.03 1.77 2.7 1.26 3.36.96.1-.75.4-1.26.73-1.55-2.56-.29-5.26-1.28-5.26-5.7 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .96-.31 3.15 1.18a10.95 10.95 0 0 1 5.74 0c2.18-1.49 3.14-1.18 3.14-1.18.63 1.59.23 2.76.12 3.05.74.81 1.18 1.84 1.18 3.1 0 4.43-2.7 5.4-5.27 5.69.42.36.79 1.07.79 2.16v3.2c0 .3.2.66.8.55A11.5 11.5 0 0 0 23.5 12 11.5 11.5 0 0 0 12 .5Z" />
    </svg>
  );
}

const icons: Record<OAuthProviderSummary["id"], () => ReactElement> = {
  google: GoogleMark,
  github: GitHubMark,
};

export function OAuthButtons({ action = "Continue" }: { action?: string }) {
  const [providers, setProviders] = useState<OAuthProviderSummary[]>([]);

  useEffect(() => {
    let active = true;
    api
      .get<OAuthProvidersResponse>("/auth/oauth/providers")
      .then((response) => {
        if (active) setProviders(response.providers);
      })
      .catch(() => {
        if (active) setProviders([]);
      });
    return () => {
      active = false;
    };
  }, []);

  if (providers.length === 0) return null;

  return (
    <div className="space-y-5">
      <div className="grid gap-2">
        {providers.map((provider) => {
          const Icon = icons[provider.id] ?? GoogleMark;
          return (
            <a
              key={provider.id}
              href={`${apiBaseUrl}/auth/oauth/${provider.id}`}
              className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-cream-300 bg-white px-4 text-sm font-medium text-ink-800 shadow-sm transition hover:bg-cream-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-500/40 focus-visible:ring-offset-2"
            >
              <Icon />
              {action} with {provider.label}
            </a>
          );
        })}
      </div>

      <div className="relative">
        <div className="absolute inset-0 flex items-center" aria-hidden="true">
          <div className="w-full border-t border-cream-200" />
        </div>
        <div className="relative flex justify-center">
          <span className="bg-cream-50 px-3 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-400">
            or use email
          </span>
        </div>
      </div>
    </div>
  );
}
