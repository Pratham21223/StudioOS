import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateBody, validateParams, validateQuery } from "../../shared/validation.js";
import {
  deleteProjectMember,
  getProjectById,
  getProjectMembers,
  getProjects,
  patchProject,
  postProject,
  postProjectMembers,
} from "./project.controller.js";
import {
  assignProjectMembersSchema,
  createProjectSchema,
  projectListQuerySchema,
  projectMemberParamsSchema,
  projectParamsSchema,
  updateProjectSchema,
} from "./project.validation.js";
import { projectContentRouter } from "../content/content.routes.js";

export const projectRouter = Router({ mergeParams: true });

projectRouter.get(
  "/",
  requirePermission(PERMISSIONS.PROJECTS_VIEW),
  validateQuery(projectListQuerySchema),
  getProjects,
);

projectRouter.post(
  "/",
  requirePermission(PERMISSIONS.PROJECTS_MANAGE),
  validateBody(createProjectSchema),
  postProject,
);

projectRouter.get(
  "/:projectId",
  requirePermission(PERMISSIONS.PROJECTS_VIEW),
  validateParams(projectParamsSchema),
  getProjectById,
);

projectRouter.patch(
  "/:projectId",
  requirePermission(PERMISSIONS.PROJECTS_MANAGE),
  validateParams(projectParamsSchema),
  validateBody(updateProjectSchema),
  patchProject,
);

projectRouter.get(
  "/:projectId/members",
  requirePermission(PERMISSIONS.PROJECTS_VIEW),
  validateParams(projectParamsSchema),
  getProjectMembers,
);

projectRouter.post(
  "/:projectId/members",
  requirePermission(PERMISSIONS.PROJECTS_MANAGE),
  validateParams(projectParamsSchema),
  validateBody(assignProjectMembersSchema),
  postProjectMembers,
);

projectRouter.delete(
  "/:projectId/members/:userId",
  requirePermission(PERMISSIONS.PROJECTS_MANAGE),
  validateParams(projectMemberParamsSchema),
  deleteProjectMember,
);

projectRouter.use("/:projectId/content-items", projectContentRouter);
