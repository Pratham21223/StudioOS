import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { invitationCreateLimiter } from "../../middleware/rate-limit.js";
import { validateBody } from "../../shared/validation.js";
import {
  listOrganizationInvitations,
  postOrganizationInvitation,
} from "./invitation.controller.js";
import { createInvitationSchema } from "./invitation.validation.js";

export const organizationInvitationRouter = Router({ mergeParams: true });

organizationInvitationRouter.get(
  "/",
  requirePermission(PERMISSIONS.MEMBERS_VIEW),
  listOrganizationInvitations,
);

organizationInvitationRouter.post(
  "/",
  requirePermission(PERMISSIONS.MEMBERS_INVITE),
  invitationCreateLimiter,
  validateBody(createInvitationSchema),
  postOrganizationInvitation,
);
