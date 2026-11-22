import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { issueCsrfToken, setSessionCookie } from "../../shared/cookies.js";
import {
  presentClientMembershipWithClient,
  presentMembershipWithOrganization,
  presentUser,
} from "../../shared/presenters.js";
import { getRequestMeta } from "../../shared/request-meta.js";
import {
  acceptInvitation,
  createClientInvitation,
  createInvitation,
  getInvitationPreview,
  listPendingClientInvitations,
  listPendingInvitations,
  presentInvitation,
} from "./invitation.service.js";
import type {
  AcceptInvitationInput,
  CreateClientInvitationInput,
  CreateInvitationInput,
} from "./invitation.validation.js";

function inviteUrlForToken(token: string): string | undefined {
  return env.isProduction ? undefined : `${env.INVITATION_BASE_URL}/${encodeURIComponent(token)}`;
}

export const listOrganizationInvitations: RequestHandler = async (req, res) => {
  const invitations = await listPendingInvitations(req.tenant!);
  res.status(200).json({ invitations: invitations.map(presentInvitation) });
};

export const postOrganizationInvitation: RequestHandler = async (req, res) => {
  const result = await createInvitation(
    req.tenant!,
    req.auth!.userId,
    req.body as CreateInvitationInput,
  );

  const inviteUrl = inviteUrlForToken(result.token);

  res.status(201).json({
    invitation: presentInvitation(result.invitation),
    ...(inviteUrl ? { inviteUrl } : {}),
  });
};

export const listClientInvitations: RequestHandler = async (req, res) => {
  const invitations = await listPendingClientInvitations(
    req.tenant!,
    req.params.clientId as string,
  );
  res.status(200).json({ invitations: invitations.map(presentInvitation) });
};

export const postClientInvitation: RequestHandler = async (req, res) => {
  const result = await createClientInvitation(
    req.tenant!,
    req.auth!.userId,
    req.params.clientId as string,
    req.body as CreateClientInvitationInput,
  );

  const inviteUrl = inviteUrlForToken(result.token);

  res.status(201).json({
    invitation: presentInvitation(result.invitation),
    ...(inviteUrl ? { inviteUrl } : {}),
  });
};

export const getInvitationByToken: RequestHandler = async (req, res) => {
  const token = req.params.token as string;
  const invitation = await getInvitationPreview(token);
  res.status(200).json({ invitation });
};

export const postAcceptInvitation: RequestHandler = async (req, res) => {
  const result = await acceptInvitation(
    req.body as AcceptInvitationInput,
    req.auth,
    getRequestMeta(req),
  );

  setSessionCookie(res, result.sessionToken);
  const csrfToken = issueCsrfToken(req, res);

  const memberships =
    result.kind === "INTERNAL"
      ? [
          presentMembershipWithOrganization({
            ...result.membership,
            organization: result.organization,
          }),
        ]
      : [];

  const clientMemberships =
    result.kind === "CLIENT"
      ? [
          presentClientMembershipWithClient({
            ...result.clientMembership,
            client: result.client,
            organization: result.organization,
          }),
        ]
      : [];

  res.status(200).json({
    user: presentUser(result.user),
    memberships,
    clientMemberships,
    csrfToken,
  });
};
