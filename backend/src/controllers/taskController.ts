import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import {
  objectId,
  instant,
  calendarDate,
  parse,
  paged,
  paging,
} from "../shared/validation.js";
import { ownedTransaction } from "../shared/transaction.js";
import { ApiError } from "../shared/http.js";
import { validateDependencies } from "../modules/tasks/dependencies.js";
import { deleteTasks } from "../modules/tasks/delete.js";
import { ScheduleBlock } from "../modules/planning/models.js";

const taskDate = z.union([
  instant,
  calendarDate.transform((date) => new Date(date)),
]);

import Task from "../models/Task.js";
import Goal from "../models/Goal.js";
import Roadmap from "../models/Roadmap.js";

const createTaskSchema = z.object({
  goalId: objectId,
  roadmapId: objectId,
  milestoneId: objectId.optional(),
  dueAt: instant.optional(),
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150),
  description: z.string().trim().max(1000).optional(),
  scheduledDate: taskDate,
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "Estimated minutes must be at least 1")
    .max(1440),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z
    .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
    .default("pending"),
  isEssential: z.boolean().default(false),
  dependsOn: z
    .array(objectId)
    .max(100)
    .transform((ids) => [...new Set(ids)])
    .default([]),
});

const updateTaskSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150)
    .optional(),
  description: z.string().trim().max(1000).optional(),
  scheduledDate: taskDate.optional(),
  estimatedMinutes: z
    .number()
    .int()
    .min(1, "Estimated minutes must be at least 1")
    .max(1440)
    .optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
    .optional(),
  isEssential: z.boolean().optional(),
  dependsOn: z
    .array(objectId)
    .max(100)
    .transform((ids) => [...new Set(ids)])
    .optional(),
  dueAt: instant.nullable().optional(),
});

export const createTask = async (req: Request, res: Response) => {
  const parsed = createTaskSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid task information.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const input = parsed.data;
  const userId = req.userId!;
  const task = await ownedTransaction(userId, async () => {
    const goal = await Goal.exists({ _id: input.goalId, userId });
    const roadmap = await Roadmap.findOne({
      _id: input.roadmapId,
      userId,
      goalId: input.goalId,
    });
    if (!goal || !roadmap)
      throw new ApiError(
        404,
        "PLAN_UNAVAILABLE",
        "Associated goal or roadmap unavailable.",
      );
    if (
      input.milestoneId &&
      !roadmap.milestones.some((milestone) =>
        milestone._id?.equals(input.milestoneId),
      )
    ) {
      throw new ApiError(
        422,
        "INVALID_MILESTONE",
        "The milestone must belong to the selected roadmap.",
      );
    }
    await validateDependencies(userId, input.goalId, input.dependsOn);
    return Task.create({
      ...input,
      userId,
      completedAt: input.status === "completed" ? new Date() : undefined,
    });
  });
  return res.status(201).json({
    success: true,
    message: "Task created successfully.",
    task,
  });
};

export const getTasks = async (req: Request, res: Response) => {
  const {
    goalId,
    roadmapId,
    status,
    priority,
    isEssential,
    startDate,
    endDate,
    date,
    limit,
    before,
  } = parse(
    paging.extend({
      goalId: objectId.optional(),
      roadmapId: objectId.optional(),
      status: z
        .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
        .optional(),
      priority: z.enum(["low", "medium", "high", "critical"]).optional(),
      isEssential: z
        .enum(["true", "false"])
        .transform((value) => value === "true")
        .optional(),
      startDate: taskDate.optional(),
      endDate: taskDate.optional(),
      date: taskDate.optional(),
    }),
    req.query,
  );
  if (startDate && endDate && startDate > endDate)
    throw new ApiError(
      400,
      "INVALID_RANGE",
      "Start date must precede end date.",
    );
  const bounds = date
    ? {
        $gte: new Date(date.setUTCHours(0, 0, 0, 0)),
        $lt: new Date(date.getTime() + 86_400_000),
      }
    : {
        ...(startDate && { $gte: startDate }),
        ...(endDate && { $lte: endDate }),
      };
  const size = limit ?? (before ? 25 : undefined);
  const query = Task.find({
    userId: req.userId,
    ...(goalId && { goalId }),
    ...(roadmapId && { roadmapId }),
    ...(status && { status }),
    ...(priority && { priority }),
    ...(isEssential !== undefined && { isEssential }),
    ...(Object.keys(bounds).length && { scheduledDate: bounds }),
    ...(before && { _id: { $lt: before } }),
  })
    .populate({
      path: "goalId",
      select: "title category status",
      match: { userId: req.userId },
    })
    .populate({
      path: "roadmapId",
      select: "title version status",
      match: { userId: req.userId },
    })
    .populate({
      path: "dependsOn",
      select: "title status scheduledDate",
      match: { userId: req.userId },
    })
    .sort(size ? { _id: -1 } : { scheduledDate: 1, createdAt: -1 });
  if (size) query.limit(size + 1);
  const { items: tasks, nextCursor } = paged(await query, size);
  return res.json({
    success: true,
    count: tasks.length,
    tasks,
    ...(size && { nextCursor }),
  });
};
export const getTaskById = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID.",
    });
  }

  const task = await Task.findOne({
    _id: id,
    userId: req.userId,
  })
    .populate({
      path: "goalId",
      select: "title category status",
      match: { userId: req.userId },
    })
    .populate({
      path: "roadmapId",
      select: "title version status",
      match: { userId: req.userId },
    })
    .populate({
      path: "dependsOn",
      select: "title status scheduledDate",
      match: { userId: req.userId },
    });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found.",
    });
  }

  return res.status(200).json({
    success: true,
    task,
  });
};

export const updateTask = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID.",
    });
  }

  const parsed = updateTaskSchema.safeParse(req.body);

  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid or empty update information.",
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    });
  }

  const input = parsed.data;
  const userId = req.userId!;
  const task = await ownedTransaction(userId, async () => {
    const current = await Task.findOne({ _id: id, userId });
    if (!current) return null;
    if (input.dependsOn)
      await validateDependencies(
        userId,
        current.goalId.toString(),
        input.dependsOn,
        current.id,
      );
    const update = {
      ...input,
      ...(input.status !== undefined && {
        completedAt:
          input.status === "completed"
            ? (current.completedAt ?? new Date())
            : null,
      }),
    };
    const result = await Task.findOneAndUpdate(
      { _id: id, userId },
      { $set: update, $inc: { version: 1 } },
      { returnDocument: "after", runValidators: true },
    );
    if (
      input.scheduledDate ||
      input.status === "cancelled" ||
      input.status === "completed"
    ) {
      await ScheduleBlock.updateMany(
        { userId, taskId: id, status: "planned", endAt: { $gt: new Date() } },
        { status: "cancelled" },
      );
    }
    return result;
  });
  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Task updated successfully.",
    task,
  });
};

export const deleteTask = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid task ID.",
    });
  }

  const userId = req.userId!;
  const count = await ownedTransaction(userId, () =>
    deleteTasks(userId, { _id: id }),
  );
  if (!count) throw new ApiError(404, "TASK_UNAVAILABLE", "Task not found.");
  return res.status(200).json({
    success: true,
    message: "Task deleted successfully.",
  });
};
