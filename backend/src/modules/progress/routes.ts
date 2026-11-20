import { Router } from "express";
import { Types } from "mongoose";
import { z } from "zod";
import { protect } from "../../middleware/authMiddleware.js";
import Goal from "../../models/Goal.js";
import Roadmap from "../../models/Roadmap.js";
import Task, { type TaskStatus } from "../../models/Task.js";
import { FocusSession, WeeklyReview } from "./models.js";
import {
  localDate,
  addCalendarDays,
  startOfLocalDate,
} from "../planning/local-date.js";
import { AvailabilityModel, ScheduleBlock } from "../planning/models.js";
import { RecoveryCase } from "../recovery/models.js";
import { ApiError } from "../../shared/http.js";
import { calendarDate, objectId, parse } from "../../shared/validation.js";

const week = calendarDate
  .transform((value) => new Date(value))
  .refine((value) => value.getUTCDay() === 1, "Use a Monday calendar date.");
const note = z.string().trim().max(2000).default("");
const reviewInput = z.object({
  accomplishments: note,
  challenges: note,
  lessons: note,
  nextWeekAdjustments: note,
  outcomeEvidence: z
    .array(z.string().trim().min(1).max(250))
    .max(20)
    .default([]),
});

export const progressRoutes = Router();
progressRoutes.use(protect);
progressRoutes.get("/reviews", async (req, res) => {
  const { before, limit } = parse(
    z.object({
      before: calendarDate.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(12),
    }),
    req.query,
  );
  const reviews = await WeeklyReview.find({
    userId: req.userId,
    ...(before && { weekStart: { $lt: new Date(before) } }),
  })
    .sort({ weekStart: -1 })
    .limit(limit + 1);
  res.json({
    success: true,
    reviews: reviews.slice(0, limit),
    nextCursor:
      reviews.length > limit
        ? reviews[limit - 1].weekStart.toISOString().slice(0, 10)
        : null,
  });
});
progressRoutes.get("/reviews/:week", async (req, res) => {
  const weekStart = parse(week, req.params.week);
  res.json({
    success: true,
    review: await WeeklyReview.findOne({ userId: req.userId, weekStart }),
  });
});
progressRoutes.put("/reviews/:week", async (req, res) => {
  const weekStart = parse(week, req.params.week);
  const input = parse(reviewInput, req.body);
  const review = await WeeklyReview.findOneAndUpdate(
    { userId: req.userId, weekStart },
    { $set: input },
    { upsert: true, returnDocument: "after", runValidators: true },
  );
  res.json({ success: true, review });
});
progressRoutes.get("/goals/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const userId = req.userId!;
  const goal = await Goal.findOne({ _id: id, userId });
  if (!goal) throw new ApiError(404, "GOAL_UNAVAILABLE", "Goal unavailable.");
  const [roadmap, counts] = await Promise.all([
    Roadmap.findOne({ goalId: id, userId, status: "active" }),
    Task.aggregate([
      {
        $match: {
          userId: new Types.ObjectId(userId),
          goalId: new Types.ObjectId(id),
        },
      },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),
  ]);
  res.json({
    success: true,
    goal,
    taskCounts: counts,
    milestones: {
      completed:
        roadmap?.milestones.filter((item) => item.completed).length ?? 0,
      total: roadmap?.milestones.length ?? 0,
    },
  });
});
progressRoutes.get("/summary", async (req, res) => {
  const { weekStart } = parse(z.object({ weekStart: week }), req.query);
  const userId = new Types.ObjectId(req.userId!);

  const config = await AvailabilityModel.findOne({ userId });
  const zone = config?.timezone ?? "UTC";
  const weekDay = weekStart.toISOString().slice(0, 10);
  const firstInstant = startOfLocalDate(weekDay, zone);
  const weekEnd = startOfLocalDate(addCalendarDays(weekDay, 7), zone);
  const today = new Date(localDate(new Date(), zone));
  const tomorrow = new Date(today.getTime() + 86_400_000);
  const open = { $nin: ["completed", "cancelled"] as TaskStatus[] };
  const [
    activeGoals,
    dueToday,
    overdue,
    completedTasks,
    milestones,
    focus,
    planned,
    recoveryOutcomes,
    review,
  ] = await Promise.all([
    Goal.countDocuments({ userId, status: "active" }),
    Task.countDocuments({
      userId,
      status: open,
      scheduledDate: { $gte: today, $lt: tomorrow },
    }),
    Task.countDocuments({
      userId,
      status: open,
      $or: [{ status: "missed" }, { scheduledDate: { $lt: today } }],
    }),
    Task.countDocuments({
      userId,
      status: "completed",
      completedAt: { $gte: firstInstant, $lt: weekEnd },
    }),
    Roadmap.aggregate([
      { $match: { userId, status: "active" } },
      { $unwind: "$milestones" },
      {
        $match: {
          "milestones.completed": false,
          "milestones.targetDate": { $gte: today },
        },
      },
      { $count: "count" },
    ]),
    FocusSession.aggregate([
      {
        $match: {
          userId,
          state: "completed",
          endedAt: { $gte: firstInstant, $lt: weekEnd },
        },
      },
      { $group: { _id: null, seconds: { $sum: "$actualSeconds" } } },
    ]),
    ScheduleBlock.aggregate([
      {
        $match: {
          userId,
          type: "task",
          status: { $ne: "cancelled" },
          startAt: { $lt: weekEnd },
          endAt: { $gt: firstInstant },
        },
      },
      {
        $group: {
          _id: null,
          milliseconds: {
            $sum: {
              $subtract: [
                { $min: ["$endAt", weekEnd] },
                { $max: ["$startAt", firstInstant] },
              ],
            },
          },
        },
      },
    ]),
    RecoveryCase.aggregate([
      { $match: { userId, detectedAt: { $gte: firstInstant, $lt: weekEnd } } },
      { $group: { _id: "$state", count: { $sum: 1 } } },
    ]),
    WeeklyReview.findOne({ userId, weekStart }),
  ]);
  res.json({
    success: true,
    activeGoals,
    dueToday,
    overdue,
    completedTasks,
    upcomingMilestones: milestones[0]?.count ?? 0,
    focusSeconds: focus[0]?.seconds ?? 0,
    plannedMinutes: (planned[0]?.milliseconds ?? 0) / 60_000,
    recoveryOutcomes,
    review,
  });
});
