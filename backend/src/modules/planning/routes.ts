import { Router } from "express";
import { createHash } from "node:crypto";
import { z } from "zod";
import type { ClientSession } from "mongoose";
import { protect } from "../../middleware/authMiddleware.js";
import { ApiError } from "../../shared/http.js";
import {
  calendarDate,
  instant,
  objectId,
  parse,
  timezone,
} from "../../shared/validation.js";
import { ownedTransaction } from "../../shared/transaction.js";
import Task from "../../models/Task.js";
import User from "../../models/User.js";
import { AvailabilityModel, ScheduleBlock, ScheduleCommit } from "./models.js";
import { availableIntervals, overlaps, type Interval } from "./calendar.js";

const window = z
  .object({
    day: z.number().int().min(0).max(6),
    start: z.number().int().min(0).max(1439),
    end: z.number().int().min(1).max(1440),
  })
  .refine((value) => value.start < value.end);
const availabilityInput = z
  .object({
    timezone,
    weeklyWindows: z.array(window).max(70),
    closedDates: z.array(calendarDate).max(366).default([]),
  })
  .refine(
    ({ weeklyWindows }) =>
      !weeklyWindows.some((a, i) =>
        weeklyWindows
          .slice(i + 1)
          .some((b) => a.day === b.day && a.start < b.end && b.start < a.end),
      ),
    "Availability windows overlap.",
  );
const range = z
  .object({ startAt: instant, endAt: instant })
  .refine(
    (x) =>
      x.startAt < x.endAt &&
      x.endAt.getTime() - x.startAt.getTime() <= 14 * 86_400_000,
    "Choose a positive range of at most 14 days.",
  );
const booking = z
  .object({
    startAt: instant,
    endAt: instant,
    type: z.enum(["task", "fixed_commitment", "break"]),
    taskId: objectId.optional(),
    requestKey: z.string().min(8).max(128).optional(),
  })
  .refine(
    (x) =>
      x.startAt < x.endAt &&
      x.endAt.getTime() - x.startAt.getTime() <= 86_400_000 &&
      x.startAt.getTime() % 60_000 === 0 &&
      x.endAt.getTime() % 60_000 === 0 &&
      (x.type === "task") === Boolean(x.taskId),
    "Use minute-aligned intervals under 24 hours and associate a task only with task blocks.",
  );
type Booking = z.infer<typeof booking>;

export function findBlocks(
  userId: string,
  bounds: Interval,
  session?: ClientSession,
) {
  return ScheduleBlock.find({
    userId,
    status: { $ne: "cancelled" },
    startAt: { $lt: bounds.endAt },
    endAt: { $gt: bounds.startAt },
  })
    .sort({ startAt: 1 })
    .session(session ?? null);
}

async function validateBooking(
  userId: string,
  input: Booking,
  session?: ClientSession,
) {
  if (
    input.taskId &&
    !(await Task.exists({
      _id: input.taskId,
      userId,
      status: { $nin: ["completed", "cancelled"] },
    }).session(session ?? null))
  ) {
    throw new ApiError(404, "TASK_UNAVAILABLE", "Open task unavailable.");
  }
  const blocks = await findBlocks(userId, input, session);
  if (blocks.some((block) => overlaps(block, input)))
    throw new ApiError(
      409,
      "SCHEDULE_CONFLICT",
      "This interval overlaps an existing block.",
    );
  if (input.type === "task") {
    const config = await AvailabilityModel.findOne({ userId }).session(
      session ?? null,
    );
    if (
      !config ||
      !availableIntervals(config, input, []).some(
        (slot) => slot.startAt <= input.startAt && slot.endAt >= input.endAt,
      )
    ) {
      throw new ApiError(
        422,
        "OUTSIDE_AVAILABILITY",
        "Task work must fit inside your availability.",
      );
    }
  }
}

export const plannerRoutes = Router();
plannerRoutes.use(protect);
plannerRoutes.get("/availability", async (req, res) => {
  res.json({
    success: true,
    availability: await AvailabilityModel.findOne({ userId: req.userId }),
  });
});
plannerRoutes.put("/availability", async (req, res) => {
  const input = parse(availabilityInput, req.body);
  const userId = req.userId!;
  const availability = await ownedTransaction(userId, async (session) => {
    await User.updateOne(
      { _id: userId },
      { timezone: input.timezone },
      { session },
    );
    return AvailabilityModel.findOneAndUpdate({ userId }, input, {
      upsert: true,
      returnDocument: "after",
      runValidators: true,
      session,
    });
  });
  res.json({ success: true, availability });
});
plannerRoutes.get("/blocks", async (req, res) => {
  const bounds = parse(range, req.query);
  res.json({ success: true, blocks: await findBlocks(req.userId!, bounds) });
});
plannerRoutes.get("/capacity", async (req, res) => {
  const bounds = parse(range, req.query);
  const userId = req.userId!;
  const [config, blocks] = await Promise.all([
    AvailabilityModel.findOne({ userId }),
    findBlocks(userId, bounds),
  ]);
  const intervals = config ? availableIntervals(config, bounds, blocks) : [];
  const availableMinutes = intervals.reduce(
    (total, slot) =>
      total + (slot.endAt.getTime() - slot.startAt.getTime()) / 60_000,
    0,
  );
  res.json({ success: true, availableMinutes, intervals });
});
plannerRoutes.post("/preview", async (req, res) => {
  const input = parse(booking, req.body);
  await validateBooking(req.userId!, input);
  res.json({ success: true, block: input });
});
plannerRoutes.post("/blocks", async (req, res) => {
  const input = parse(booking, req.body);
  if (!input.requestKey)
    throw new ApiError(
      400,
      "REQUEST_KEY_REQUIRED",
      "A request key is required.",
    );
  const userId = req.userId!;
  const result = await ownedTransaction(userId, async (session) => {
    const previous = await ScheduleBlock.findOne({
      userId,
      requestKey: input.requestKey,
    }).session(session);
    if (previous) {
      if (
        previous.type !== input.type ||
        (previous.taskId?.toString() ?? undefined) !== input.taskId ||
        previous.startAt.getTime() !== input.startAt.getTime() ||
        previous.endAt.getTime() !== input.endAt.getTime()
      ) {
        throw new ApiError(
          409,
          "REQUEST_KEY_REUSED",
          "This request key belongs to another block.",
        );
      }
      return { block: previous, created: false };
    }
    await validateBooking(userId, input, session);
    const [block] = await ScheduleBlock.create([{ ...input, userId }], {
      session,
    });
    return { block, created: true };
  });
  res
    .status(result.created ? 201 : 200)
    .json({ success: true, block: result.block });
});
plannerRoutes.delete("/blocks/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const userId = req.userId!;
  const block = await ownedTransaction(userId, (session) =>
    ScheduleBlock.findOneAndUpdate(
      {
        _id: id,
        userId,
        status: { $ne: "completed" },
      },
      { status: "cancelled" },
      { returnDocument: "after", session },
    ).exec(),
  );
  if (!block)
    throw new ApiError(404, "BLOCK_UNAVAILABLE", "Schedule block unavailable.");
  res.json({ success: true, block });
});

const draftBlocks = z
  .array(booking)
  .min(1)
  .max(32)
  .refine(
    (blocks) =>
      !blocks.some((a, i) => blocks.slice(i + 1).some((b) => overlaps(a, b))),
    "Proposed intervals overlap.",
  );

plannerRoutes.post("/preview-plan", async (req, res) => {
  const { blocks } = parse(z.object({ blocks: draftBlocks }), req.body);
  for (const block of blocks) await validateBooking(req.userId!, block);
  res.json({ success: true, blocks });
});

plannerRoutes.post("/commit", async (req, res) => {
  const input = parse(
    z.object({ requestKey: z.string().min(8).max(128), blocks: draftBlocks }),
    req.body,
  );
  const userId = req.userId!;
  const intended = input.blocks.map(({ startAt, endAt, type, taskId }) => ({
    startAt,
    endAt,
    type,
    taskId,
  }));
  const payloadHash = createHash("sha256")
    .update(JSON.stringify(intended))
    .digest("hex");
  const result = await ownedTransaction(userId, async (session) => {
    const previous = await ScheduleCommit.findOne({
      userId,
      requestKey: input.requestKey,
    }).session(session);
    if (previous) {
      if (previous.payloadHash !== payloadHash)
        throw new ApiError(
          409,
          "REQUEST_KEY_REUSED",
          "This key belongs to another schedule.",
        );
      const records = await ScheduleBlock.find({
        userId,
        _id: { $in: previous.blockIds },
      }).session(session);
      const byId = new Map(
        records.map((block) => [block._id.toString(), block]),
      );
      return {
        commit: previous,
        blocks: previous.blockIds.map((id) => byId.get(id.toString())),
        created: false,
      };
    }
    for (const block of intended) await validateBooking(userId, block, session);
    const blocks = await ScheduleBlock.insertMany(
      intended.map((block) => ({ ...block, userId })),
      { session },
    );
    const commit = await new ScheduleCommit({
      userId,
      requestKey: input.requestKey,
      payloadHash,
      blockIds: blocks.map((block) => block._id),
    }).save({ session });
    return { commit, blocks, created: true };
  });
  res
    .status(result.created ? 201 : 200)
    .json({
      success: true,
      blocks: result.blocks,
      commitId: result.commit._id,
    });
});
