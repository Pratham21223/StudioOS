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
import { clientRouter } from "../clients/client.routes.js";
import { contentRouter } from "../content/content.routes.js";
import { assetRouter } from "../assets/asset.routes.js";
import { projectRouter } from "../projects/project.routes.js";
import { taskRouter } from "../tasks/task.routes.js";
import { reviewRouter } from "../reviews/review.routes.js";
import { dashboardRouter } from "../dashboard/dashboard.routes.js";

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
organizationRouter.use("/:orgId/clients", clientRouter);
organizationRouter.use("/:orgId/projects", projectRouter);
organizationRouter.use("/:orgId/content-items", contentRouter);
organizationRouter.use("/:orgId/assets", assetRouter);
organizationRouter.use("/:orgId/tasks", taskRouter);
organizationRouter.use("/:orgId/reviews", reviewRouter);
organizationRouter.use("/:orgId/dashboard", dashboardRouter);
organizationRouter.use("/:orgId/invitations", organizationInvitationRouter);
