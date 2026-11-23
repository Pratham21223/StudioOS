import { env } from "../../config/env.js";

export type OAuthProviderId = "google" | "github";
export type OAuthProviderEnum = "GOOGLE" | "GITHUB";

export type OAuthProviderConfig = {
  id: OAuthProviderId;
  provider: OAuthProviderEnum;
  label: string;
  clientID: string;
  clientSecret: string;
  callbackURL: string;
  scope: string[];
};

function googleConfig(): OAuthProviderConfig | null {
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET || !env.GOOGLE_CALLBACK_URL) {
    return null;
  }
  return {
    id: "google",
    provider: "GOOGLE",
    label: "Google",
    clientID: env.GOOGLE_CLIENT_ID,
    clientSecret: env.GOOGLE_CLIENT_SECRET,
    callbackURL: env.GOOGLE_CALLBACK_URL,
    scope: ["email", "profile"],
  };
}

function githubConfig(): OAuthProviderConfig | null {
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.GITHUB_CALLBACK_URL) {
    return null;
  }
  return {
    id: "github",
    provider: "GITHUB",
    label: "GitHub",
    clientID: env.GITHUB_CLIENT_ID,
    clientSecret: env.GITHUB_CLIENT_SECRET,
    callbackURL: env.GITHUB_CALLBACK_URL,
    scope: ["user:email"],
  };
}

const configs: Record<OAuthProviderId, () => OAuthProviderConfig | null> = {
  google: googleConfig,
  github: githubConfig,
};

export function oauthProviderIds(): OAuthProviderId[] {
  return ["google", "github"];
}

export function parseOAuthProvider(value: string | undefined): OAuthProviderId | null {
  return value === "google" || value === "github" ? value : null;
}

export function getOAuthProviderConfig(provider: OAuthProviderId): OAuthProviderConfig | null {
  return configs[provider]();
}

export function enabledOAuthProviders(): OAuthProviderConfig[] {
  return oauthProviderIds()
    .map((provider) => getOAuthProviderConfig(provider))
    .filter((config): config is OAuthProviderConfig => config !== null);
}
