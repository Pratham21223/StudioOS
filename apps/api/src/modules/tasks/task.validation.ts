import { TASK_PRIORITIES, TASK_STATUSES } from "@studioos/shared";
import { z } from "zod";
import { uuidSchema } from "../../shared/validation.js";
import { dateOnlySchema } from "../content/content.validation.js";

const nullableDate = z.union([dateOnlySchema, z.null()]);
const optionalText = (max: number) => z.string().trim().max(max).optional();

export const createTaskSchema = z
  .object({
    projectId: uuidSchema,
    contentItemId: z.union([uuidSchema, z.null()]).optional(),
    title: z.string().trim().min(1, "Task title is required.").max(200),
    description: optionalText(20_000),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.union([uuidSchema, z.null()]).optional(),
    dueDate: nullableDate.optional(),
  })
  .strict();

export const updateTaskSchema = z
  .object({
    contentItemId: z.union([uuidSchema, z.null()]).optional(),
    title: z.string().trim().min(1, "Task title is required.").max(200).optional(),
    description: optionalText(20_000),
    status: z.enum(TASK_STATUSES).optional(),
    priority: z.enum(TASK_PRIORITIES).optional(),
    assigneeId: z.union([uuidSchema, z.null()]).optional(),
    dueDate: nullableDate.optional(),
  })
  .strict()
  .refine((data) => Object.values(data).some((value) => value !== undefined), {
    message: "Provide at least one field to update.",
    path: ["title"],
  });

export const updateTaskStatusSchema = z
  .object({
    status: z.enum(TASK_STATUSES),
  })
  .strict();

export const taskListQuerySchema = z.object({
  status: z.enum(TASK_STATUSES).optional(),
  priority: z.enum(TASK_PRIORITIES).optional(),
  projectId: uuidSchema.optional(),
  contentItemId: uuidSchema.optional(),
  assigneeId: z.union([uuidSchema, z.literal("me")]).optional(),
  overdue: z.enum(["true", "false"]).optional(),
  search: z.string().trim().max(120).optional(),
});

export const taskParamsSchema = z.object({
  taskId: uuidSchema,
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
export type UpdateTaskStatusInput = z.infer<typeof updateTaskStatusSchema>;
export type TaskListQuery = z.infer<typeof taskListQuerySchema>;
