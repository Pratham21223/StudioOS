import { PERMISSIONS } from "@studioos/shared";
import { Router } from "express";
import { requirePermission } from "../../middleware/authorization.js";
import { validateBody, validateParams, validateQuery } from "../../shared/validation.js";
import { getTaskById, getTasks, patchTask, patchTaskStatus, postTask } from "./task.controller.js";
import {
  createTaskSchema,
  taskListQuerySchema,
  taskParamsSchema,
  updateTaskSchema,
  updateTaskStatusSchema,
} from "./task.validation.js";

export const taskRouter = Router({ mergeParams: true });

taskRouter.get(
  "/",
  requirePermission(PERMISSIONS.TASKS_VIEW),
  validateQuery(taskListQuerySchema),
  getTasks,
);

taskRouter.post(
  "/",
  requirePermission(PERMISSIONS.TASKS_CREATE),
  validateBody(createTaskSchema),
  postTask,
);

taskRouter.get(
  "/:taskId",
  requirePermission(PERMISSIONS.TASKS_VIEW),
  validateParams(taskParamsSchema),
  getTaskById,
);

taskRouter.patch(
  "/:taskId",
  requirePermission(PERMISSIONS.TASKS_CREATE),
  validateParams(taskParamsSchema),
  validateBody(updateTaskSchema),
  patchTask,
);

taskRouter.patch(
  "/:taskId/status",
  requirePermission(PERMISSIONS.TASKS_VIEW),
  validateParams(taskParamsSchema),
  validateBody(updateTaskStatusSchema),
  patchTaskStatus,
);
