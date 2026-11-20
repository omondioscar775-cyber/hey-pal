import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Goal from "../models/Goal.js";

const createGoalSchema = z.object({
  title: z.string().trim().min(3).max(150),
  description: z.string().trim().max(1000).optional(),
  category: z.string().trim().min(2).max(80),
  targetDate: z.coerce.date().optional(),
  currentState: z.string().trim().min(2).max(1000),
  desiredOutcome: z.string().trim().min(2).max(1000),
  weeklyAvailableHours: z.number().min(1).max(168),
});

const updateGoalSchema = createGoalSchema.partial().extend({
  status: z.enum(["active", "completed", "paused", "archived"]).optional(),
});

export const createGoal = async (
  req: Request,
  res: Response
) => {
  const parsed = createGoalSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal information.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const goal = await Goal.create({
    ...parsed.data,
    userId: req.userId,
  });

  return res.status(201).json({
    success: true,
    message: "Goal created successfully.",
    goal,
  });
};

export const getGoals = async (
  req: Request,
  res: Response
) => {
  const goals = await Goal.find({
    userId: req.userId,
  }).sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: goals.length,
    goals,
  });
};

export const getGoalById = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  const goal = await Goal.findOne({
    _id: id,
    userId: req.userId,
  });

  if (!goal) {
    return res.status(404).json({
      success: false,
      message: "Goal not found.",
    });
  }

  return res.status(200).json({
    success: true,
    goal,
  });
};

export const updateGoal = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  const parsed = updateGoalSchema.safeParse(req.body);

  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid or empty update information.",
      errors: parsed.success
        ? undefined
        : parsed.error.flatten().fieldErrors,
    });
  }

  const goal = await Goal.findOneAndUpdate(
    {
      _id: id,
      userId: req.userId,
    },
    { $set: parsed.data },
    { new: true, runValidators: true }
  );

  if (!goal) {
    return res.status(404).json({
      success: false,
      message: "Goal not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Goal updated successfully.",
    goal,
  });
};

export const deleteGoal = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  const goal = await Goal.findOneAndDelete({
    _id: id,
    userId: req.userId,
  });

  if (!goal) {
    return res.status(404).json({
      success: false,
      message: "Goal not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Goal deleted successfully.",
  });
};