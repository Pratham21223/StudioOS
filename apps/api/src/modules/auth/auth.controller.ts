import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import {
  clearAuthCookies,
  getSessionToken,
  issueCsrfToken,
  setSessionCookie,
} from "../../shared/cookies.js";
import {
  presentClientMembershipWithClient,
  presentMembershipWithOrganization,
  presentUser,
} from "../../shared/presenters.js";
import { getRequestMeta } from "../../shared/request-meta.js";
import * as authService from "./auth.service.js";
import type {
  ForgotPasswordInput,
  LoginInput,
  RegisterInput,
  ResetPasswordInput,
} from "./auth.validation.js";

function authSessionPayload(
  user: Parameters<typeof presentUser>[0],
  memberships: Parameters<typeof presentMembershipWithOrganization>[0][],
  clientMemberships: Parameters<typeof presentClientMembershipWithClient>[0][],
  csrfToken: string,
) {
  return {
    user: presentUser(user),
    memberships: memberships.map(presentMembershipWithOrganization),
    clientMemberships: clientMemberships.map(presentClientMembershipWithClient),
    csrfToken,
  };
}

export const csrf: RequestHandler = (req, res) => {
  const csrfToken = issueCsrfToken(req, res);
  res.status(200).json({ csrfToken });
};

export const register: RequestHandler = async (req, res) => {
  const result = await authService.register(req.body as RegisterInput, getRequestMeta(req));

  setSessionCookie(res, result.sessionToken);
  const csrfToken = issueCsrfToken(req, res);

  res
    .status(201)
    .json(
      authSessionPayload(
        result.user,
        [{ ...result.membership, organization: result.organization }],
        [],
        csrfToken,
      ),
    );
};

export const login: RequestHandler = async (req, res) => {
  const result = await authService.login(
    req.body as LoginInput,
    getRequestMeta(req),
    getSessionToken(req),
  );

  setSessionCookie(res, result.sessionToken);
  const csrfToken = issueCsrfToken(req, res);

  res
    .status(200)
    .json(authSessionPayload(result.user, result.memberships, result.clientMemberships, csrfToken));
};

export const logout: RequestHandler = async (req, res) => {
  await authService.logout(getSessionToken(req));
  clearAuthCookies(res);
  res.status(204).send();
};

export const me: RequestHandler = async (req, res) => {
  const result = await authService.getMe(req.auth!.userId);
  res.status(200).json({
    user: presentUser(result.user),
    memberships: result.memberships.map(presentMembershipWithOrganization),
    clientMemberships: result.clientMemberships.map(presentClientMembershipWithClient),
  });
};

export const forgotPassword: RequestHandler = async (req, res) => {
  const result = await authService.requestPasswordReset(req.body as ForgotPasswordInput);

  const resetUrl =
    result && !env.isProduction
      ? `${env.PASSWORD_RESET_BASE_URL}?token=${encodeURIComponent(result.token)}`
      : undefined;

  res.status(200).json({
    message: "If an account exists for that email, a password reset link has been sent.",
    expiresInMinutes: env.PASSWORD_RESET_TTL_MINUTES,
    ...(resetUrl ? { resetUrl } : {}),
  });
};

export const resetPassword: RequestHandler = async (req, res) => {
  await authService.resetPassword(req.body as ResetPasswordInput);
  clearAuthCookies(res);
  res.status(200).json({
    message: "Your password has been updated. Sign in with your new password.",
  });
};
