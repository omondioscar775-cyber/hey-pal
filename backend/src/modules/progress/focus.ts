import { Router } from "express";
import { z } from "zod";
import { protect } from "../../middleware/authMiddleware.js";
import Task from "../../models/Task.js";
import { ApiError } from "../../shared/http.js";
import { ownedTransaction } from "../../shared/transaction.js";
import { objectId, parse } from "../../shared/validation.js";
import { FocusSession } from "./models.js";

export const focusRoutes = Router();
focusRoutes.use(protect);
focusRoutes.post("/sessions", async (req, res) => {
  const input = parse(
    z.object({
      taskId: objectId.optional(),
      requestKey: z.string().min(8).max(128),
    }),
    req.body,
  );
  const userId = req.userId!;
  const result = await ownedTransaction(userId, async (session) => {
    const previous = await FocusSession.findOne({
      userId,
      requestKey: input.requestKey,
    }).session(session);
    if (previous) {
      if (previous.taskId?.toString() !== input.taskId)
        throw new ApiError(
          409,
          "REQUEST_KEY_REUSED",
          "This key belongs to another task.",
        );
      return { entry: previous, created: false };
    }
    if (
      await FocusSession.exists({
        userId,
        state: { $in: ["active", "paused"] },
      }).session(session)
    ) {
      throw new ApiError(
        409,
        "FOCUS_ALREADY_OPEN",
        "Finish the current focus session before starting another.",
      );
    }
    if (
      input.taskId &&
      !(await Task.exists({
        _id: input.taskId,
        userId,
        status: { $nin: ["completed", "cancelled"] },
      }).session(session))
    ) {
      throw new ApiError(404, "TASK_UNAVAILABLE", "Open task unavailable.");
    }
    const now = new Date();
    const [entry] = await FocusSession.create(
      [{ ...input, userId, startedAt: now, resumedAt: now }],
      { session },
    );
    return { entry, created: true };
  });
  res
    .status(result.created ? 201 : 200)
    .json({ success: true, session: result.entry });
});
focusRoutes.get("/sessions", async (req, res) => {
  const { taskId, before, limit, state } = parse(
    z.object({
      taskId: objectId.optional(),
      state: z.enum(["open"]).optional(),
      before: objectId.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(30),
    }),
    req.query,
  );
  const entries = await FocusSession.find({
    userId: req.userId,
    ...(taskId && { taskId }),
    ...(state === "open" && { state: { $in: ["active", "paused"] } }),
    ...(before && { _id: { $lt: before } }),
  })
    .sort({ _id: -1 })
    .limit(limit + 1);
  const sessions = entries.slice(0, limit);
  res.json({
    success: true,
    sessions,
    nextCursor: entries.length > limit ? sessions.at(-1)?.id : null,
  });
});
focusRoutes.post("/sessions/:id/:action", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const action = parse(
    z.enum(["pause", "resume", "complete", "interrupt"]),
    req.params.action,
  );
  const { revision, reflection } = parse(
    z.object({
      revision: z.number().int().min(0),
      reflection: z.string().trim().max(2000).optional(),
    }),
    req.body,
  );
  const userId = req.userId!;
  const entry = await ownedTransaction(userId, async (session) => {
    const current = await FocusSession.findOne({ _id: id, userId }).session(
      session,
    );
    if (!current)
      throw new ApiError(
        404,
        "SESSION_UNAVAILABLE",
        "Focus session unavailable.",
      );
    if (current.revision === revision + 1 && current.lastAction === action)
      return current;
    if (
      current.revision !== revision ||
      current.state === "completed" ||
      current.state === "interrupted" ||
      (action === "resume" && current.state !== "paused") ||
      (action === "pause" && current.state !== "active")
    ) {
      throw new ApiError(
        409,
        "FOCUS_STATE",
        "The focus session state has changed.",
      );
    }
    const now = new Date();
    if (current.state === "active" && current.resumedAt) {
      current.elapsedMilliseconds += Math.max(
        0,
        now.getTime() - current.resumedAt.getTime(),
      );
      current.actualSeconds = Math.floor(current.elapsedMilliseconds / 1000);
    }
    current.revision++;
    current.lastAction = action;
    current.resumedAt = action === "resume" ? now : undefined;
    current.state =
      action === "resume"
        ? "active"
        : action === "pause"
          ? "paused"
          : action === "complete"
            ? "completed"
            : "interrupted";
    if (action === "complete" || action === "interrupt") {
      current.endedAt = now;
      current.reflection = reflection;
    }
    return current.save({ session });
  });
  res.json({ success: true, session: entry });
});
