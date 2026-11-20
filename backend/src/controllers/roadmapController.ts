import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";

import Roadmap from "../models/Roadmap.js";
import Goal from "../models/Goal.js";

const milestoneSchema = z.object({
  _id: z.string().optional(),
  title: z.string().trim().min(1, "Milestone title is required").max(150),
  description: z.string().trim().max(1000).optional(),
  targetDate: z.coerce.date().optional(),
  completed: z.boolean().default(false),
});

const createRoadmapSchema = z.object({
  goalId: z.string().trim(),
  title: z.string().trim().min(3, "Title must be at least 3 characters").max(150),
  milestones: z.array(milestoneSchema).default([]),
  status: z.enum(["active", "superseded", "completed"]).default("active"),
});

const updateRoadmapSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  milestones: z.array(milestoneSchema).optional(),
  status: z.enum(["active", "superseded", "completed"]).optional(),
});

export const createRoadmap = async (
  req: Request,
  res: Response
) => {
  const parsed = createRoadmapSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap information.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { goalId, title, milestones, status } = parsed.data;

  if (!mongoose.isValidObjectId(goalId)) {
    return res.status(400).json({
      success: false,
      message: "Invalid goal ID.",
    });
  }

  // Verify associated goal exists and belongs to the authenticated user
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

  // Auto-increment version for this goal
  const latestRoadmap = await Roadmap.findOne({ goalId }).sort({ version: -1 });
  const version = latestRoadmap ? latestRoadmap.version + 1 : 1;

  // If the new roadmap is active, supersede existing active roadmaps for this goal
  if (status === "active") {
    await Roadmap.updateMany(
      { goalId, status: "active" },
      { $set: { status: "superseded" } }
    );
  }

  const roadmap = await Roadmap.create({
    userId: req.userId,
    goalId,
    version,
    title,
    milestones,
    status,
  });

  return res.status(201).json({
    success: true,
    message: "Roadmap created successfully.",
    roadmap,
  });
};

export const getRoadmaps = async (
  req: Request,
  res: Response
) => {
  const { goalId, status } = req.query;

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

  if (status && typeof status === "string") {
    query.status = status;
  }

  const roadmaps = await Roadmap.find(query)
    .populate("goalId", "title category status")
    .sort({ createdAt: -1 });

  return res.status(200).json({
    success: true,
    count: roadmaps.length,
    roadmaps,
  });
};

export const getRoadmapById = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap ID.",
    });
  }

  const roadmap = await Roadmap.findOne({
    _id: id,
    userId: req.userId,
  }).populate("goalId", "title category status");

  if (!roadmap) {
    return res.status(404).json({
      success: false,
      message: "Roadmap not found.",
    });
  }

  return res.status(200).json({
    success: true,
    roadmap,
  });
};

export const updateRoadmap = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap ID.",
    });
  }

  const parsed = updateRoadmapSchema.safeParse(req.body);

  if (!parsed.success || Object.keys(parsed.data ?? {}).length === 0) {
    return res.status(400).json({
      success: false,
      message: "Invalid or empty update information.",
      errors: parsed.success
        ? undefined
        : parsed.error.flatten().fieldErrors,
    });
  }

  const roadmap = await Roadmap.findOneAndUpdate(
    {
      _id: id,
      userId: req.userId,
    },
    { $set: parsed.data },
    { new: true, runValidators: true }
  ).populate("goalId", "title category status");

  if (!roadmap) {
    return res.status(404).json({
      success: false,
      message: "Roadmap not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Roadmap updated successfully.",
    roadmap,
  });
};

export const deleteRoadmap = async (
  req: Request,
  res: Response
) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap ID.",
    });
  }

  const roadmap = await Roadmap.findOneAndDelete({
    _id: id,
    userId: req.userId,
  });

  if (!roadmap) {
    return res.status(404).json({
      success: false,
      message: "Roadmap not found.",
    });
  }

  return res.status(200).json({
    success: true,
    message: "Roadmap deleted successfully.",
  });
};
