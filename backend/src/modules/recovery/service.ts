import { createHash } from "node:crypto";
import type { ClientSession } from "mongoose";
import Goal from "../../models/Goal.js";
import Roadmap from "../../models/Roadmap.js";
import Task from "../../models/Task.js";
import { ApiError } from "../../shared/http.js";
import { ownedTransaction } from "../../shared/transaction.js";
import { AvailabilityModel, ScheduleBlock } from "../planning/models.js";
import {
  localDate,
  addCalendarDays,
  startOfLocalDate,
} from "../planning/local-date.js";
import { availableIntervals } from "../planning/calendar.js";
import { findBlocks } from "../planning/routes.js";
import { essentialClosure, scheduleWork, type Work } from "./engine.js";
import { RecoveryCase, RecoveryProposal, RoadmapEvent } from "./models.js";

const day = 86_400_000;
const priorities = ["low", "medium", "high", "critical"];
const minDate = (...dates: Array<Date | undefined | null>) =>
  dates
    .filter((date): date is Date => date instanceof Date)
    .sort((a, b) => a.getTime() - b.getTime())[0];

async function snapshot(
  userId: string,
  goalId: string,
  now: Date,
  session: ClientSession,
) {
  const goal = await Goal.findOne({
    _id: goalId,
    userId,
    status: "active",
  }).session(session);
  const roadmap = await Roadmap.findOne({ userId, goalId, status: "active" })
    .sort({ version: -1 })
    .session(session);
  if (!goal || !roadmap)
    throw new ApiError(
      404,
      "ACTIVE_PLAN_UNAVAILABLE",
      "An active goal and roadmap are required.",
    );
  const config = await AvailabilityModel.findOne({ userId }).session(session);
  const tasks = await Task.find({ userId, goalId })
    .sort({ _id: 1 })
    .session(session);
  const today = localDate(now, config?.timezone ?? "UTC");
  const bounds = { startAt: now, endAt: new Date(now.getTime() + 14 * day) };
  const blocks = await findBlocks(userId, bounds, session);
  const missed = tasks.filter(
    (task) =>
      task.roadmapId.equals(roadmap._id) &&
      !["completed", "cancelled"].includes(task.status) &&
      (task.status === "missed" ||
        task.scheduledDate.toISOString().slice(0, 10) < today ||
        Boolean(task.dueAt && task.dueAt <= now)),
  );
  const fingerprint = createHash("sha256")
    .update(
      JSON.stringify([
        goal._id,
        goal.updatedAt,
        roadmap._id,
        roadmap.updatedAt,
        config?.updatedAt,
        tasks.map((task) => [task._id, task.updatedAt]),
        blocks.map((block) => [
          block._id,
          block.startAt,
          block.endAt,
          block.updatedAt,
        ]),
        missed.map((task) => task._id),
      ]),
    )
    .digest("hex");
  return { goal, roadmap, config, tasks, bounds, blocks, missed, fingerprint };
}

export async function generate(userId: string, goalId: string) {
  return ownedTransaction(userId, async (session) => {
    const now = new Date();
    const source = await snapshot(userId, goalId, now, session);
    if (!source.missed.length)
      throw new ApiError(
        422,
        "NO_MISSED_WORK",
        "There is no missed work on the active roadmap.",
      );
    const existing = await RecoveryCase.findOne({
      userId,
      sourceFingerprint: source.fingerprint,
      state: "options_generated",
      expiresAt: { $gt: now },
    }).session(session);
    if (existing)
      return {
        recoveryCase: existing,
        proposals: await RecoveryProposal.find({
          userId,
          recoveryCaseId: existing._id,
        }).session(session),
      };
    const completed = new Set(
      source.tasks
        .filter((task) => task.status === "completed")
        .map((task) => task.id as string),
    );
    const zone = source.config?.timezone ?? "UTC";
    const throughDay = (date?: Date) =>
      date
        ? startOfLocalDate(
            addCalendarDays(date.toISOString().slice(0, 10), 1),
            zone,
          )
        : undefined;
    const goalDeadline = throughDay(source.goal.targetDate);
    const missedIds = new Set(source.missed.map((task) => task.id as string));
    const taskMap = new Map(
      source.tasks.map((task) => [task.id as string, task]),
    );
    const cutoff = new Map<string, Date>();
    for (const block of source.blocks) {
      if (block.status !== "planned" || !block.taskId) continue;
      const task = taskMap.get(block.taskId.toString());
      const queue = task?.dependsOn.map(String) ?? [];
      const seen = new Set<string>();
      while (queue.length) {
        const id = queue.pop()!;
        if (seen.has(id)) continue;
        seen.add(id);
        if (
          missedIds.has(id) &&
          (!cutoff.has(id) || block.startAt < cutoff.get(id)!)
        )
          cutoff.set(id, block.startAt);
        queue.push(...(taskMap.get(id)?.dependsOn.map(String) ?? []));
      }
    }
    const work: Work[] = source.missed.map((task) => {
      const milestone = source.roadmap.milestones.find((item) =>
        item._id?.equals(task.milestoneId),
      );
      return {
        id: task.id,
        prerequisites: task.dependsOn.map(String),
        minutes: task.estimatedMinutes,
        priority: priorities.indexOf(task.priority),
        essential: task.isEssential,
        deadline: minDate(
          goalDeadline,
          task.dueAt,
          throughDay(milestone?.targetDate),
          cutoff.get(task.id),
        ),
      };
    });
    const expiresAt = new Date(now.getTime() + 30 * 60_000);
    const booked = new Set(
      source.blocks
        .filter((block) => block.status === "planned")
        .map((block) => block.taskId?.toString()),
    );
    const slots = source.config
      ? availableIntervals(
          source.config,
          { ...source.bounds, startAt: expiresAt },
          source.blocks,
        )
      : [];
    const [recoveryCase] = await RecoveryCase.create(
      [
        {
          userId,
          goalId,
          roadmapId: source.roadmap.id,
          sourceFingerprint: source.fingerprint,
          detectedAt: now,
          expiresAt,
        },
      ],
      { session },
    );
    const milestoneIds = new Set(
      source.missed.map((task) => task.milestoneId?.toString()),
    );
    const milestone =
      milestoneIds.size === 1
        ? source.roadmap.milestones.find(
            (item) =>
              item._id?.toString() === [...milestoneIds][0] &&
              !item.completed &&
              item.targetDate,
          )
        : undefined;
    const types = [
      "protect_deadline",
      "redistribute",
      "revise_milestone",
    ] as const;
    const proposals = [];
    for (const optionType of types) {
      const selected =
        optionType === "protect_deadline"
          ? essentialClosure(work)
          : optionType === "revise_milestone"
            ? work.map((task, index) => ({
                ...task,
                deadline: minDate(
                  goalDeadline,
                  source.missed[index].dueAt,
                  cutoff.get(task.id),
                ),
              }))
            : work;
      const result = !selected.length
        ? { changes: [], reason: "No essential work was identified." }
        : optionType === "revise_milestone" && !milestone
          ? {
              changes: [],
              reason:
                "The missed tasks need one shared, dated, incomplete milestone.",
            }
          : !source.config
            ? {
                changes: [],
                reason: "Configure availability before scheduling recovery.",
              }
            : selected.some((task) => booked.has(task.id))
              ? {
                  changes: [],
                  reason:
                    "Review existing task reservations before rescheduling this work.",
                }
              : scheduleWork(selected, slots, completed);
      const end = Math.max(
        0,
        ...result.changes.map((item) => item.endAt.getTime()),
      );
      const milestoneTarget =
        milestone &&
        optionType === "revise_milestone" &&
        end > throughDay(milestone.targetDate)!.getTime()
          ? new Date(localDate(new Date(end - 1), zone))
          : undefined;
      const reason =
        result.reason ??
        (optionType === "revise_milestone" && !milestoneTarget
          ? "The available placement does not require a milestone extension."
          : null);
      const [proposal] = await RecoveryProposal.create(
        [
          {
            userId,
            recoveryCaseId: recoveryCase._id,
            baseRoadmapVersion: source.roadmap.version,
            optionType,
            expiresAt,
            changes: reason ? [] : result.changes,
            milestoneId: milestoneTarget ? milestone?._id : undefined,
            milestoneTarget,
            deferredTaskIds: work
              .filter((task) => !selected.some((item) => item.id === task.id))
              .map((task) => task.id),
            estimatedMinutes: selected.reduce(
              (total, task) => total + task.minutes,
              0,
            ),
            feasibility: reason ? "infeasible" : "feasible",
            explanation:
              reason ??
              "All selected work fits within available time, prerequisites and deadlines. Unselected work retains its current task state.",
          },
        ],
        { session },
      );
      proposals.push(proposal);
    }
    return { recoveryCase, proposals };
  });
}

export async function approve(
  userId: string,
  caseId: string,
  proposalId: string,
) {
  return ownedTransaction(userId, async (session) => {
    const recoveryCase = await RecoveryCase.findOne({
      _id: caseId,
      userId,
    }).session(session);
    const proposal = await RecoveryProposal.findOne({
      _id: proposalId,
      recoveryCaseId: caseId,
      userId,
    }).session(session);
    if (!recoveryCase || !proposal)
      throw new ApiError(
        404,
        "PROPOSAL_UNAVAILABLE",
        "Recovery proposal unavailable.",
      );
    if (recoveryCase.approvedProposalId?.equals(proposalId)) {
      const roadmap = await Roadmap.findOne({
        _id: recoveryCase.updatedRoadmapId,
        userId,
      }).session(session);
      return { recoveryCase, proposal, roadmap };
    }
    if (
      recoveryCase.state !== "options_generated" ||
      proposal.status !== "proposed" ||
      proposal.expiresAt <= new Date()
    ) {
      throw new ApiError(
        409,
        "PROPOSAL_STALE",
        "Generate a fresh recovery proposal.",
      );
    }
    if (proposal.feasibility !== "feasible")
      throw new ApiError(422, "INFEASIBLE_PROPOSAL", proposal.explanation);
    const now = new Date();
    const source = await snapshot(
      userId,
      recoveryCase.goalId.toString(),
      now,
      session,
    );
    if (
      source.fingerprint !== recoveryCase.sourceFingerprint ||
      source.roadmap.version !== proposal.baseRoadmapVersion ||
      proposal.changes.some((change) => change.startAt <= now)
    ) {
      throw new ApiError(
        409,
        "PROPOSAL_STALE",
        "The plan changed. Generate a fresh recovery proposal.",
      );
    }
    const latest = await Roadmap.findOne({ userId, goalId: source.goal._id })
      .sort({ version: -1 })
      .session(session);
    await Roadmap.updateMany(
      { userId, goalId: source.goal._id, status: "active" },
      { status: "superseded" },
      { session },
    );

    const roadmap = await new Roadmap({
      userId,
      goalId: source.goal._id,
      title: source.roadmap.title,
      version: (latest?.version ?? source.roadmap.version) + 1,
      status: "active",
      acceptedAt: now,
      supersedesId: source.roadmap._id,
      milestones: source.roadmap
        .toObject()
        .milestones.map((item) =>
          proposal.milestoneId?.equals(item._id)
            ? { ...item, targetDate: proposal.milestoneTarget }
            : item,
        ),
    }).save({ session });
    await Task.updateMany(
      {
        userId,
        roadmapId: source.roadmap._id,
        status: { $nin: ["completed", "cancelled"] },
      },
      { roadmapId: roadmap._id },
      { session },
    );
    for (const change of proposal.changes) {
      await ScheduleBlock.create(
        [
          {
            userId,
            taskId: change.taskId,
            startAt: change.startAt,
            endAt: change.endAt,
            type: "task",
          },
        ],
        { session },
      );
      const local = localDate(change.startAt, source.config!.timezone);
      const update = await Task.updateOne(
        {
          _id: change.taskId,
          userId,
          status: { $nin: ["completed", "cancelled"] },
        },
        { $set: { scheduledDate: new Date(local) }, $inc: { version: 1 } },
        { session },
      );
      if (!update.matchedCount)
        throw new ApiError(409, "PROPOSAL_STALE", "A task changed.");
      await Task.updateOne(
        { _id: change.taskId, userId, status: "missed" },
        { status: "pending" },
        { session },
      );
    }
    await RoadmapEvent.create(
      [
        {
          userId,
          actorId: userId,
          roadmapId: roadmap._id,
          previousRoadmapId: source.roadmap._id,
          version: roadmap.version,
          action: "recovery_approved",
          proposalId: proposal._id,
        },
      ],
      { session },
    );
    proposal.status = "approved";
    await proposal.save({ session });
    recoveryCase.state = "approved";
    recoveryCase.approvedProposalId = proposal._id;
    recoveryCase.updatedRoadmapId = roadmap._id;
    await recoveryCase.save({ session });
    return { recoveryCase, proposal, roadmap };
  });
}
