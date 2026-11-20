import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { objectId, parse, paged, paging } from "../shared/validation.js";
import { ApiError } from "../shared/http.js";

import Goal from "../models/Goal.js";
import Roadmap from "../models/Roadmap.js";
import { ownedTransaction } from "../shared/transaction.js";
import { deleteTasks } from "../modules/tasks/delete.js";

const createGoalSchema = z.object({
  title: z.string().trim().min(3).max(150),
  motivation: z.string().trim().max(1000).optional(),
  priority: z.enum(["low", "medium", "high", "critical"]).optional(),
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

export const createGoal = async (req: Request, res: Response) => {
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

export const getGoals = async (req: Request, res: Response) => {
  const { status, before, limit } = parse(
    paging.extend({
      status: z.enum(["active", "paused", "completed", "archived"]).optional(),
    }),
    req.query,
  );
  const size = limit ?? (before ? 25 : undefined);
  const query = Goal.find({
    userId: req.userId,
    ...(status && { status }),
    ...(before && { _id: { $lt: before } }),
  });
  query.sort(size ? { _id: -1 } : { createdAt: -1 });
  if (size) query.limit(size + 1);
  const { items: goals, nextCursor } = paged(await query, size);
  return res.json({
    success: true,
    count: goals.length,
    goals,
    ...(size && { nextCursor }),
  });
};

export const getGoalById = async (req: Request, res: Response) => {
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

export const updateGoal = async (req: Request, res: Response) => {
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
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    });
  }

  const goal = await ownedTransaction(req.userId!, () =>
    Goal.findOneAndUpdate(
      {
        _id: id,
        userId: req.userId,
      },
      { $set: parsed.data },
      { returnDocument: "after", runValidators: true },
    ).exec(),
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

export const deleteGoal = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  const userId = req.userId!;
  const goal = await ownedTransaction(userId, async () => {
    const result = await Goal.findOneAndDelete({ _id: id, userId });
    if (!result) return null;
    await deleteTasks(userId, { goalId: id });
    await Roadmap.updateMany({ userId, goalId: id }, { status: "archived" });
    return result;
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
export async function archiveGoal(req: Request, res: Response) {
  const id = parse(objectId, req.params.id);
  const userId = req.userId!;
  const goal = await ownedTransaction(userId, () =>
    Goal.findOneAndUpdate(
      { _id: id, userId },
      { status: "archived" },
      { returnDocument: "after" },
    ).exec(),
  );
  if (!goal) throw new ApiError(404, "GOAL_UNAVAILABLE", "Goal not found.");
  res.json({ success: true, goal });
}
