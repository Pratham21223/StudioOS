import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateBody, validateParams, validateQuery } from "../../shared/validation.js";
import {
  getClientById,
  getClientMembers,
  getClients,
  patchClient,
  patchClientMember,
  postClient,
} from "./client.controller.js";
import {
  clientListQuerySchema,
  clientMembershipParamsSchema,
  clientParamsSchema,
  createClientSchema,
  updateClientMembershipSchema,
  updateClientSchema,
} from "./client.validation.js";
import { clientInvitationRouter } from "../invitations/invitation.routes.js";

export const clientRouter = Router({ mergeParams: true });

clientRouter.get(
  "/",
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  validateQuery(clientListQuerySchema),
  getClients,
);

clientRouter.post(
  "/",
  requirePermission(PERMISSIONS.CLIENTS_MANAGE),
  validateBody(createClientSchema),
  postClient,
);

clientRouter.get(
  "/:clientId",
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  validateParams(clientParamsSchema),
  getClientById,
);

clientRouter.patch(
  "/:clientId",
  requirePermission(PERMISSIONS.CLIENTS_MANAGE),
  validateParams(clientParamsSchema),
  validateBody(updateClientSchema),
  patchClient,
);

clientRouter.get(
  "/:clientId/members",
  requirePermission(PERMISSIONS.CLIENTS_VIEW),
  validateParams(clientParamsSchema),
  getClientMembers,
);

clientRouter.patch(
  "/:clientId/members/:membershipId",
  requirePermission(PERMISSIONS.CLIENTS_MANAGE),
  validateParams(clientMembershipParamsSchema),
  validateBody(updateClientMembershipSchema),
  patchClientMember,
);

clientRouter.use("/:clientId/invitations", clientInvitationRouter);
