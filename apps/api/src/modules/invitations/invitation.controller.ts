import type { RequestHandler } from "express";
import { env } from "../../config/env.js";
import { issueCsrfToken, setSessionCookie } from "../../shared/cookies.js";
import { presentMembershipWithOrganization, presentUser } from "../../shared/presenters.js";
import { getRequestMeta } from "../../shared/request-meta.js";
import {
  acceptInvitation,
  createInvitation,
  getInvitationPreview,
  listPendingInvitations,
  presentInvitation,
} from "./invitation.service.js";
import type { AcceptInvitationInput, CreateInvitationInput } from "./invitation.validation.js";

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

  const inviteUrl = env.isProduction
    ? undefined
    : `${env.INVITATION_BASE_URL}/${encodeURIComponent(result.token)}`;

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

  res.status(200).json({
    user: presentUser(result.user),
    memberships: [
      presentMembershipWithOrganization({
        ...result.membership,
        organization: result.organization,
      }),
    ],
    csrfToken,
  });
};
