import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Task from "../models/Task.js";
import Goal from "../models/Goal.js";
import Roadmap from "../models/Roadmap.js";

const createTaskSchema = z.object({
  goalId: z.string().trim(),
  roadmapId: z.string().trim(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  description: z.string().trim().max(1000).optional(),
  scheduledDate: z.coerce.date(),
  estimatedMinutes: z.number().int().min(1, "Estimated minutes must be at least 1").max(1440),
  priority: z.enum(["low", "medium", "high", "critical"]).default("medium"),
  status: z
    .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
    .default("pending"),
  isEssential: z.boolean().default(false),
  dependsOn: z.array(z.string().trim()).default([]),
});

const updateTaskSchema = z.object({
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150).optional(),
  description: z.string().trim().max(1000).optional(),
  scheduledDate: z.coerce.date().optional(),
  estimatedMinutes: z.number().int().min(1, "Estimated minutes must be at least 1").max(1440).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
  status: z
    .enum(["pending", "in_progress", "completed", "missed", "cancelled"])
    .optional(),
  isEssential: z.boolean().optional(),
  dependsOn: z.array(z.string().trim()).optional(),
  completedAt: z.coerce.date().nullable().optional(),
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

  const {
    goalId,
    roadmapId,
    title,
    description,
    scheduledDate,
    estimatedMinutes,
    priority,
    status,
    isEssential,
    dependsOn,
  } = parsed.data;

  // Validate ObjectIds
  if (!mongoose.isValidObjectId(goalId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  if (!mongoose.isValidObjectId(roadmapId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap ID.",
    });
  }

  // Verify associated Goal exists and belongs to user
  const goal = await Goal.findOne({
    _id: goalId,
    userId: req.userId,
  });

  if (!goal) {
    return res.status(404).json({
      success: false,
      message: "Associated goal not found.",
    });
  }

  // Verify associated Roadmap exists and belongs to user and matches goal
  const roadmap = await Roadmap.findOne({
    _id: roadmapId,
    userId: req.userId,
  });

  if (!roadmap) {
    return res.status(404).json({
      success: false,
      message: "Associated roadmap not found.",
    });
  }

  if (roadmap.goalId.toString() !== goalId) {
    return res.status(400).json({
      success: false,
      message: "The specified roadmap does not belong to the given goal.",
    });
  }

  // Validate dependencies if any
  for (const depId of dependsOn) {
    if (!mongoose.isValidObjectId(depId)) {
      return res.status(400).json({
        success: false,
        message: `Invalid dependency task ID: ${depId}`,
      });
    }
  }

  const completedAt = status === "completed" ? new Date() : undefined;

  const task = await Task.create({
    userId: req.userId,
    goalId,
    roadmapId,
    title,
    description,
    scheduledDate,
    estimatedMinutes,
    priority,
    status,
    isEssential,
    dependsOn,
    completedAt,
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
  } = req.query;

  const query: Record<string, unknown> = {
    userId: req.userId,
  };

  if (goalId) {
    if (!mongoose.isValidObjectId(goalId as string)) {
      return res.status(400).json({
        success: false,
        message: "Invalid goal ID.",
      });
    }
    query.goalId = goalId;
  }

  if (roadmapId) {
    if (!mongoose.isValidObjectId(roadmapId as string)) {
      return res.status(400).json({
        success: false,
        message: "Invalid roadmap ID.",
      });
    }
    query.roadmapId = roadmapId;
  }

  if (status && typeof status === "string") {
    query.status = status;
  }

  if (priority && typeof priority === "string") {
    query.priority = priority;
  }

  if (isEssential !== undefined) {
    query.isEssential = isEssential === "true";
  }

  // Date filters
  if (date && typeof date === "string") {
    const dayStart = new Date(date);
    dayStart.setUTCHours(0, 0, 0, 0);
    const dayEnd = new Date(date);
    dayEnd.setUTCHours(23, 59, 59, 999);
    query.scheduledDate = { $gte: dayStart, $lte: dayEnd };
  } else if (startDate || endDate) {
    const dateRange: Record<string, Date> = {};
    if (startDate && typeof startDate === "string") {
      dateRange.$gte = new Date(startDate);
    }
    if (endDate && typeof endDate === "string") {
      dateRange.$lte = new Date(endDate);
    }
    query.scheduledDate = dateRange;
  }

  const tasks = await Task.find(query)
    .populate("goalId", "title category status")
    .populate("roadmapId", "title version status")
    .populate("dependsOn", "title status scheduledDate")
    .sort({ scheduledDate: 1, createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: tasks.length,
    tasks,
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
    .populate("goalId", "title category status")
    .populate("roadmapId", "title version status")
    .populate("dependsOn", "title status scheduledDate");

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
      errors: parsed.success
        ? undefined
        : parsed.error.flatten().fieldErrors,
    });
  }

  const updateData: Record<string, unknown> = { ...parsed.data };

  // Handle completion timestamp logic
  if (parsed.data.status !== undefined) {
    if (parsed.data.status === "completed") {
      updateData.completedAt = parsed.data.completedAt ?? new Date();
    } else {
      updateData.completedAt = null;
    }
  }

  const task = await Task.findOneAndUpdate(
    {
      _id: id,
      userId: req.userId,
    },
    { $set: updateData },
    { new: true, runValidators: true }
  )
    .populate("goalId", "title category status")
    .populate("roadmapId", "title version status")
    .populate("dependsOn", "title status scheduledDate");

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

  const task = await Task.findOneAndDelete({
    _id: id,
    userId: req.userId,
  });

  if (!task) {
    return res.status(404).json({
      success: false,
      message: "Task not found.",
    });
  }

  // Remove this deleted task from any other tasks' dependsOn array
  await Task.updateMany(
    { userId: req.userId, dependsOn: new mongoose.Types.ObjectId(id) } as any,
    { $pull: { dependsOn: new mongoose.Types.ObjectId(id) } }
  );

  return res.status(200).json({
    success: true,
    message: "Task deleted successfully.",
  });
};
