import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { PERMISSIONS } from "@studioos/shared";
import { validateBody, validateParams } from "../../shared/validation.js";
import { listOrganizationMembers, patchOrganizationMember } from "./membership.controller.js";
import { membershipIdParamsSchema, updateMembershipSchema } from "./membership.validation.js";

export const membershipRouter = Router({ mergeParams: true });

membershipRouter.get("/", requirePermission(PERMISSIONS.MEMBERS_VIEW), listOrganizationMembers);

membershipRouter.patch(
  "/:membershipId",
  requirePermission(PERMISSIONS.MEMBERS_MANAGE),
  validateParams(membershipIdParamsSchema),
  validateBody(updateMembershipSchema),
  patchOrganizationMember,
);
