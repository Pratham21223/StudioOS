import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { getOrganizationDashboard } from "./dashboard.controller.js";

export const dashboardRouter = Router({ mergeParams: true });

dashboardRouter.get("/", requirePermission(PERMISSIONS.DASHBOARD_VIEW), getOrganizationDashboard);
