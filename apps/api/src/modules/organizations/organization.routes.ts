import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { authenticate } from "../../middleware/auth.js";
import { requirePermission } from "../../middleware/authorization.js";
import { resolveTenant } from "../../middleware/tenant.js";
import { validateBody } from "../../shared/validation.js";
import {
  getOrganizationById,
  listOrganizations,
  patchOrganization,
} from "./organization.controller.js";
import { updateOrganizationSchema } from "./organization.validation.js";
import { membershipRouter } from "../memberships/membership.routes.js";
import { organizationInvitationRouter } from "../invitations/invitation.routes.js";

export const organizationRouter = Router();

organizationRouter.use(authenticate);
organizationRouter.get("/", listOrganizations);

// Every nested route below resolves the tenant from the authenticated session.
organizationRouter.use("/:orgId", resolveTenant);

organizationRouter.get(
  "/:orgId",
  requirePermission(PERMISSIONS.ORGANIZATION_VIEW),
  getOrganizationById,
);

organizationRouter.patch(
  "/:orgId",
  requirePermission(PERMISSIONS.ORGANIZATION_MANAGE),
  validateBody(updateOrganizationSchema),
  patchOrganization,
);

organizationRouter.use("/:orgId/members", membershipRouter);
organizationRouter.use("/:orgId/invitations", organizationInvitationRouter);
