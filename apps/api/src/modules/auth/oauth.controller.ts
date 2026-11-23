import type { User } from "@prisma/client";
import type { RequestHandler, Response } from "express";
import passport from "passport";
import { env } from "../../config/env.js";
import { logger } from "../../config/logger.js";
import {
  clearOAuthStateCookie,
  issueCsrfToken,
  readOAuthStateCookie,
  setOAuthStateCookie,
  setSessionCookie,
} from "../../shared/cookies.js";
import { randomToken, safeEqual } from "../../shared/crypto.js";
import { AppError } from "../../shared/errors.js";
import { getRequestMeta } from "../../shared/request-meta.js";
import * as authService from "./auth.service.js";
import {
  enabledOAuthProviders,
  getOAuthProviderConfig,
  parseOAuthProvider,
  type OAuthProviderId,
} from "./oauth.config.js";

function providerFromRequest(
  params: Record<string, string | string[] | undefined>,
): OAuthProviderId | null {
  const value = params.provider;
  const provider = Array.isArray(value) ? value[0] : value;
  return parseOAuthProvider(provider);
}

function redirectFailure(res: Response, code: string): void {
  const target = new URL("/login", env.WEB_ORIGIN);
  target.searchParams.set("oauthError", code);
  res.redirect(302, target.toString());
}

export const listOAuthProviders: RequestHandler = (_req, res) => {
  res.status(200).json({
    providers: enabledOAuthProviders().map((provider) => ({
      id: provider.id,
      label: provider.label,
    })),
  });
};

export const startOAuth: RequestHandler = (req, res, next) => {
  const provider = providerFromRequest(req.params);
  if (!provider || !getOAuthProviderConfig(provider)) {
    res.status(404).json({
      error: {
        code: "OAUTH_PROVIDER_UNAVAILABLE",
        message: "That sign-in provider is not configured.",
        requestId: req.requestId,
      },
    });
    return;
  }

  const state = randomToken();
  setOAuthStateCookie(res, provider, state);

  // The state is also validated against an HTTP-only cookie in the callback.
  passport.authenticate(provider, { session: false, state })(req, res, next);
};

export const oauthCallback: RequestHandler = (req, res, next) => {
  const provider = providerFromRequest(req.params);
  if (!provider || !getOAuthProviderConfig(provider)) {
    redirectFailure(res, "OAUTH_PROVIDER_UNAVAILABLE");
    return;
  }

  const expected = readOAuthStateCookie(req);
  const providedState = typeof req.query.state === "string" ? req.query.state : "";

  if (
    !expected ||
    expected.provider !== provider ||
    providedState.length === 0 ||
    !safeEqual(expected.state, providedState)
  ) {
    clearOAuthStateCookie(res);
    redirectFailure(res, "OAUTH_STATE_INVALID");
    return;
  }

  clearOAuthStateCookie(res);

  passport.authenticate(
    provider,
    { session: false },
    (error: unknown, user?: Express.User | false | null) => {
      if (error || !user) {
        const code = error instanceof AppError ? error.code : "OAUTH_FAILED";
        logger.warn({ provider, code, requestId: req.requestId }, "oauth.callback_failed");
        redirectFailure(res, code);
        return;
      }

      const authenticated = user as User;
      void authService
        .establishSession(authenticated.id, getRequestMeta(req))
        .then((sessionToken) => {
          setSessionCookie(res, sessionToken);
          issueCsrfToken(req, res);
          res.redirect(302, env.WEB_ORIGIN);
        })
        .catch(next);
    },
  )(req, res, next);
};
