import type { Request, Response } from "express";
import mongoose from "mongoose";
import { z } from "zod";
import { objectId, parse, paged, paging } from "../shared/validation.js";
import { ownedTransaction } from "../shared/transaction.js";
import { ApiError } from "../shared/http.js";
import Task from "../models/Task.js";
import { RoadmapEvent } from "../modules/recovery/models.js";
import { deleteTasks } from "../modules/tasks/delete.js";

import Roadmap from "../models/Roadmap.js";
import Goal from "../models/Goal.js";

const milestoneSchema = z.object({
  _id: objectId.optional(),
  title: z.string().trim().min(1, "Milestone title is required").max(150),
  description: z.string().trim().max(1000).optional(),
  targetDate: z.coerce.date().optional(),
  completed: z.boolean().default(false),
});

const createRoadmapSchema = z.object({
  goalId: objectId,
  title: z
    .string()
    .trim()
    .min(3, "Title must be at least 3 characters")
    .max(150),
  milestones: z.array(milestoneSchema).max(100).default([]),
  status: z
    .enum(["draft", "active", "superseded", "completed", "archived"])
    .default("active"),
  generationMethod: z.enum(["manual", "template", "ai_assisted"]).optional(),
});

const updateRoadmapSchema = z.object({
  title: z.string().trim().min(3).max(150).optional(),
  milestones: z.array(milestoneSchema).max(100).optional(),
  status: z
    .enum(["draft", "active", "superseded", "completed", "archived"])
    .optional(),
});

export const createRoadmap = async (req: Request, res: Response) => {
  const parsed = createRoadmapSchema.safeParse(req.body);

  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap information.",
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  const { goalId, status, milestones } = parsed.data;
  const userId = req.userId!;
  const roadmap = await ownedTransaction(userId, async (session) => {
    if (!(await Goal.exists({ _id: goalId, userId })))
      throw new ApiError(404, "GOAL_UNAVAILABLE", "Associated goal not found.");
    ensureUniqueMilestones(milestones);
    const latest = await Roadmap.findOne({ userId, goalId }).sort({
      version: -1,
    });
    const previous =
      status === "active"
        ? await Roadmap.findOne({ userId, goalId, status: "active" }).sort({
            version: -1,
          })
        : null;
    if (previous)
      await Roadmap.updateMany(
        { userId, goalId, status: "active" },
        { status: "superseded" },
      );
    const created = await Roadmap.create({
      ...parsed.data,
      userId,
      version: (latest?.version ?? 0) + 1,
      acceptedAt: status === "active" ? new Date() : undefined,
      supersedesId: previous?._id,
    });
    if (status === "active")
      await RoadmapEvent.create(
        [
          {
            userId,
            actorId: userId,
            roadmapId: created._id,
            version: created.version,
            action: "activated",
            previousRoadmapId: previous?._id,
          },
        ],
        { session },
      );
    return created;
  });
  return res.status(201).json({
    success: true,
    message: "Roadmap created successfully.",
    roadmap,
  });
};

export const getRoadmaps = async (req: Request, res: Response) => {
  const { goalId, status, before, limit } = parse(
    paging.extend({
      goalId: objectId.optional(),
      status: z
        .enum(["draft", "active", "superseded", "completed", "archived"])
        .optional(),
    }),
    req.query,
  );
  const size = limit ?? (before ? 25 : undefined);
  const query = Roadmap.find({
    userId: req.userId,
    ...(goalId && { goalId }),
    ...(status && { status }),
    ...(before && { _id: { $lt: before } }),
  }).populate({
    path: "goalId",
    select: "title category status",
    match: { userId: req.userId },
  });
  query.sort(size ? { _id: -1 } : { createdAt: -1 });
  if (size) query.limit(size + 1);
  const { items: roadmaps, nextCursor } = paged(await query, size);
  return res.json({
    success: true,
    count: roadmaps.length,
    roadmaps,
    ...(size && { nextCursor }),
  });
};
export const getRoadmapById = async (req: Request, res: Response) => {
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
  }).populate({
    path: "goalId",
    select: "title category status",
    match: { userId: req.userId },
  });

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

export const updateRoadmap = async (req: Request, res: Response) => {
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
      errors: parsed.success ? undefined : parsed.error.flatten().fieldErrors,
    });
  }

  const userId = req.userId!;
  const roadmap = await ownedTransaction(userId, async (session) => {
    const current = await Roadmap.findOne({ _id: id, userId });
    if (!current) return null;
    const input = parsed.data;
    if (
      ["superseded", "archived"].includes(current.status) ||
      (input.status === "draft" && current.status !== "draft") ||
      (input.status === "active" && current.status !== "active")
    ) {
      throw new ApiError(
        409,
        "ROADMAP_STATE",
        "Use the approval endpoint to activate a draft. Historical roadmaps are read-only.",
      );
    }
    if (input.milestones) {
      ensureUniqueMilestones(input.milestones);
      const ids = input.milestones.flatMap((item) =>
        item._id ? [item._id] : [],
      );
      if (
        await Task.exists({
          userId,
          roadmapId: id,
          milestoneId: { $exists: true, $nin: ids },
        })
      ) {
        throw new ApiError(
          409,
          "MILESTONE_IN_USE",
          "Reassign tasks before removing their milestone.",
        );
      }
    }
    const updated = await Roadmap.findOneAndUpdate(
      { _id: id, userId },
      { $set: input },
      { returnDocument: "after", runValidators: true },
    );
    if (current.status !== "draft")
      await RoadmapEvent.create(
        [
          {
            userId,
            actorId: userId,
            roadmapId: current._id,
            version: current.version,
            action: "updated",
          },
        ],
        { session },
      );
    return updated;
  });
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

export const deleteRoadmap = async (req: Request, res: Response) => {
  const { id } = req.params;

  if (typeof id !== "string" || !mongoose.isValidObjectId(id)) {
    return res.status(400).json({
      success: false,
      message: "Invalid roadmap ID.",
    });
  }

  const userId = req.userId!;
  const roadmap = await ownedTransaction(userId, async () => {
    const current = await Roadmap.findOne({ _id: id, userId });
    if (!current) return null;
    if (current.status === "draft") {
      await deleteTasks(userId, { roadmapId: id });
      await current.deleteOne();
    } else if (current.status !== "archived") {
      current.status = "archived";
      await current.save();
      await RoadmapEvent.create({
        userId,
        actorId: userId,
        roadmapId: current._id,
        version: current.version,
        action: "archived",
      });
    }
    return current;
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

function ensureUniqueMilestones(milestones: Array<{ _id?: string }>) {
  const ids = milestones.flatMap((item) => (item._id ? [item._id] : []));
  if (new Set(ids).size !== ids.length)
    throw new ApiError(
      400,
      "DUPLICATE_MILESTONE",
      "Milestone IDs must be unique.",
    );
}

export const validateRoadmap = async (req: Request, res: Response) => {
  const id = parse(objectId, req.params.id);
  const roadmap = await Roadmap.findOne({ _id: id, userId: req.userId });
  if (!roadmap)
    throw new ApiError(404, "ROADMAP_UNAVAILABLE", "Roadmap unavailable.");
  const goal = await Goal.findOne({ _id: roadmap.goalId, userId: req.userId });
  const warnings = roadmap.milestones.flatMap((item) =>
    goal?.targetDate && item.targetDate && item.targetDate > goal.targetDate
      ? ["Milestone exceeds the goal target: " + item.title]
      : [],
  );
  res.json({
    success: true,
    valid: Boolean(goal && roadmap.milestones.length),
    warnings,
  });
};

export const approveRoadmap = async (req: Request, res: Response) => {
  const id = parse(objectId, req.params.id);
  const userId = req.userId!;
  const { version, updatedAt } = parse(
    z.object({
      version: z.number().int().positive(),
      updatedAt: z.iso.datetime(),
    }),
    req.body,
  );
  const roadmap = await ownedTransaction(userId, async (session) => {
    const draft = await Roadmap.findOne({ _id: id, userId });
    if (!draft)
      throw new ApiError(404, "ROADMAP_UNAVAILABLE", "Roadmap unavailable.");
    if (draft.status === "active" && draft.version === version) return draft;
    if (
      draft.status !== "draft" ||
      draft.version !== version ||
      draft.updatedAt.toISOString() !== updatedAt
    ) {
      throw new ApiError(409, "ROADMAP_STALE", "This draft has changed.");
    }
    if (
      !draft.milestones.length ||
      !(await Goal.exists({ _id: draft.goalId, userId, status: "active" }))
    ) {
      throw new ApiError(
        422,
        "PLAN_INCOMPLETE",
        "An active goal and at least one milestone are required.",
      );
    }
    const previous = await Roadmap.findOne({
      userId,
      goalId: draft.goalId,
      status: "active",
    }).sort({ version: -1 });
    if (previous && previous.version >= version)
      throw new ApiError(409, "ROADMAP_STALE", "A newer roadmap is active.");
    await Roadmap.updateMany(
      { userId, goalId: draft.goalId, status: "active" },
      { status: "superseded" },
    );
    draft.status = "active";
    draft.acceptedAt = new Date();
    draft.supersedesId = previous?._id;
    await draft.save({ session });
    await RoadmapEvent.create(
      [
        {
          userId,
          actorId: userId,
          roadmapId: draft._id,
          version,
          action: "approved",
          previousRoadmapId: previous?._id,
        },
      ],
      { session },
    );
    return draft;
  });
  res.json({ success: true, roadmap });
};
export async function listMilestones(req: Request, res: Response) {
  const id = parse(objectId, req.params.id);
  const roadmap = await Roadmap.findOne({ _id: id, userId: req.userId });
  if (!roadmap)
    throw new ApiError(404, "ROADMAP_UNAVAILABLE", "Roadmap unavailable.");
  res.json({
    success: true,
    milestones: roadmap.milestones,
    updatedAt: roadmap.updatedAt,
  });
}
