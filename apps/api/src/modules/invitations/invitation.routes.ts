import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { z } from "zod";
import { requirePermission } from "../../middleware/authorization.js";
import { invitationCreateLimiter } from "../../middleware/rate-limit.js";
import { uuidSchema, validateBody, validateParams } from "../../shared/validation.js";
import {
  listClientInvitations,
  listOrganizationInvitations,
  postClientInvitation,
  postOrganizationInvitation,
} from "./invitation.controller.js";
import { createClientInvitationSchema, createInvitationSchema } from "./invitation.validation.js";

const clientParams = z.object({ clientId: uuidSchema });

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

export const clientInvitationRouter = Router({ mergeParams: true });

clientInvitationRouter.get(
  "/",
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  validateParams(clientParams),
  listClientInvitations,
);

clientInvitationRouter.post(
  "/",
  requirePermission(PERMISSIONS.CLIENTS_MANAGE),
  invitationCreateLimiter,
  validateParams(clientParams),
  validateBody(createClientInvitationSchema),
  postClientInvitation,
);
