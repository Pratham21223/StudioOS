import { Router } from "express";
import { optionalAuthenticate } from "../../middleware/auth.js";
import { invitationAcceptLimiter } from "../../middleware/rate-limit.js";
import { validateBody, validateParams } from "../../shared/validation.js";
import { getInvitationByToken, postAcceptInvitation } from "./invitation.controller.js";
import { acceptInvitationSchema, invitationTokenParamsSchema } from "./invitation.validation.js";

export const publicInvitationRouter = Router();

publicInvitationRouter.get(
  "/:token",
  validateParams(invitationTokenParamsSchema),
  getInvitationByToken,
);

publicInvitationRouter.post(
  "/accept",
  invitationAcceptLimiter,
  optionalAuthenticate,
  validateBody(acceptInvitationSchema),
  postAcceptInvitation,
);
