import type { CookieOptions, Request, Response } from "express";
import { env } from "../config/env.js";
import { randomToken } from "../shared/crypto.js";

const SESSION_MAX_AGE_MS = env.SESSION_TTL_HOURS * 60 * 60 * 1000;

const baseCookieOptions: CookieOptions = {
  httpOnly: true,
  secure: env.isProduction,
  sameSite: "lax",
  path: "/",
};

export function getSessionToken(req: Request): string | null {
  const token = req.cookies?.[env.SESSION_COOKIE_NAME];
  return typeof token === "string" && token.length > 0 ? token : null;
}

export function setSessionCookie(res: Response, token: string): void {
  res.cookie(env.SESSION_COOKIE_NAME, token, {
    ...baseCookieOptions,
    maxAge: SESSION_MAX_AGE_MS,
  });
}

/**
 * Issues a double-submit CSRF token. The cookie is intentionally readable by
 * the SPA, which mirrors it in the X-CSRF-Token header; the server requires both
 * values to match on unsafe methods.
 */
export function issueCsrfToken(req: Request, res: Response): string {
  const existing = req.cookies?.[env.CSRF_COOKIE_NAME];
  const token =
    typeof existing === "string" && existing.length > 0 && existing.length <= 128
      ? existing
      : randomToken();

  res.cookie(env.CSRF_COOKIE_NAME, token, {
    ...baseCookieOptions,
    httpOnly: false,
    maxAge: SESSION_MAX_AGE_MS,
  });
  return token;
}

export function clearAuthCookies(res: Response): void {
  res.clearCookie(env.SESSION_COOKIE_NAME, baseCookieOptions);
  res.clearCookie(env.CSRF_COOKIE_NAME, { ...baseCookieOptions, httpOnly: false });
}
