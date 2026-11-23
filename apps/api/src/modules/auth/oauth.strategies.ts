import passport from "passport";
import type { Profile as GitHubProfile } from "passport-github2";
import { Strategy as GitHubStrategy } from "passport-github2";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import type OAuth2Strategy from "passport-oauth2";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import { AppError } from "../../shared/errors.js";
import { getOAuthProviderConfig } from "./oauth.config.js";
import { resolveOAuthUser } from "./oauth.service.js";

let initialized = false;

type GitHubEmail = {
  value: string;
  verified?: boolean;
  primary?: boolean;
};

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error("OAuth authentication failed.");
}

export function configureOAuthStrategies(): void {
  if (initialized) return;
  initialized = true;

  const google = getOAuthProviderConfig("google");
  if (google) {
    passport.use(
      new GoogleStrategy(
        {
          clientID: google.clientID,
          clientSecret: google.clientSecret,
          callbackURL: google.callbackURL,
          scope: google.scope,
        },
        async (_accessToken, _refreshToken, profile, done) => {
          try {
            const verifiedEmail = profile.emails?.find((email) => email.verified);
            const fallbackEmail =
              profile._json?.email_verified && profile._json.email
                ? profile._json.email
                : undefined;
            const email = verifiedEmail?.value ?? fallbackEmail;

            if (!profile.id || !email) {
              done(
                new AppError(
                  403,
                  "OAUTH_EMAIL_UNAVAILABLE",
                  "Google did not supply a verified email address.",
                ),
              );
              return;
            }

            const name =
              profile.displayName ||
              [profile.name?.givenName, profile.name?.familyName].filter(Boolean).join(" ");

            const user = await resolveOAuthUser({
              provider: "GOOGLE",
              providerAccountId: profile.id,
              email,
              name,
              emailVerified: Boolean(verifiedEmail || fallbackEmail),
            });
            done(null, user);
          } catch (error) {
            done(toError(error));
          }
        },
      ),
    );
  } else if (env.GOOGLE_CLIENT_ID || env.GOOGLE_CLIENT_SECRET || env.GOOGLE_CALLBACK_URL) {
    logger.warn("oauth.google_config_incomplete");
  }

  const github = getOAuthProviderConfig("github");
  if (github) {
    passport.use(
      new GitHubStrategy(
        {
          clientID: github.clientID,
          clientSecret: github.clientSecret,
          callbackURL: github.callbackURL,
          scope: github.scope,
          userAgent: "StudioOS",
          // Returns the full email list with GitHub's verified flags instead
          // of only the (possibly private) primary address.
          allRawEmails: true,
        },
        async (
          _accessToken: string,
          _refreshToken: string,
          profile: GitHubProfile,
          done: OAuth2Strategy.VerifyCallback,
        ) => {
          try {
            const emails = (profile.emails ?? []) as GitHubEmail[];
            const email = (
              emails.find((entry) => entry.verified && entry.primary) ??
              emails.find((entry) => entry.verified)
            )?.value;

            if (!profile.id || !email) {
              done(
                new AppError(
                  403,
                  "OAUTH_EMAIL_UNAVAILABLE",
                  "GitHub did not supply a verified email address.",
                ),
              );
              return;
            }

            const name =
              profile.displayName ||
              (profile as { username?: string }).username ||
              email.split("@")[0] ||
              "StudioOS member";

            const user = await resolveOAuthUser({
              provider: "GITHUB",
              providerAccountId: profile.id,
              email,
              name,
              emailVerified: true,
            });
            done(null, user);
          } catch (error) {
            done(toError(error));
          }
        },
      ),
    );
  } else if (env.GITHUB_CLIENT_ID || env.GITHUB_CLIENT_SECRET || env.GITHUB_CALLBACK_URL) {
    logger.warn("oauth.github_config_incomplete");
  }
}
