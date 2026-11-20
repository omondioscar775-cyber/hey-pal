import assert from "node:assert/strict";
import { test } from "node:test";
import { registerHooks } from "node:module";
import {
  focusSeconds,
  missedTask,
  taskPlannerHref,
  weekRange,
  workload,
} from "../../src/lib/planning.ts";

registerHooks({
  resolve(specifier, context, nextResolve) {
    return nextResolve(
      specifier === "./planning" && context.parentURL?.endsWith("/recovery.ts")
        ? "./planning.ts"
        : specifier,
      context,
    );
  },
});

const { recoveryAssessment } = await import("../../src/lib/recovery.ts");
const now = new Date(2026, 10, 20, 10);
const goal = { _id: "goal", targetDate: "2026-11-22", weeklyAvailableHours: 2 };
const task = (id, overrides = {}) => ({
  _id: id,
  goalId: "goal",
  scheduledDate: "2026-11-19",
  status: "pending",
  estimatedMinutes: 45,
  isEssential: false,
  dependsOn: [],
  ...overrides,
});

test("capacity uses local Monday boundaries and excludes cancelled work", () => {
  assert.deepEqual(weekRange(now), ["2026-11-16", "2026-11-22"]);
  assert.deepEqual(
    workload(
      [
        task("in"),
        task("cancelled", { status: "cancelled" }),
        task("previous", { scheduledDate: "2026-11-15" }),
        task("upcoming", { scheduledDate: "2026-11-23" }),
      ],
      goal,
      now,
    ),
    { available: 120, planned: 45, remaining: 75 },
  );
  assert.equal(
    workload([task("long", { estimatedMinutes: 130 })], goal, now).remaining,
    -10,
  );
});

test("today's pending work and completed work are excluded from recovery", () => {
  assert.equal(
    missedTask(task("today", { scheduledDate: "2026-11-20" }), "2026-11-20"),
    false,
  );
  assert.equal(
    missedTask(task("done", { status: "completed" }), "2026-11-20"),
    false,
  );
  assert.equal(missedTask(task("past"), "2026-11-20"), true);
});

test("recovery exposes deferred work, affected tasks and dependency constraints", () => {
  const result = recoveryAssessment(
    goal,
    [
      task("essential", {
        isEssential: true,
        dependsOn: ["optional"],
        scheduledDate: "2026-11-15",
      }),
      task("optional", { scheduledDate: "2026-11-15" }),
      task("dependent", {
        scheduledDate: "2026-11-21",
        dependsOn: ["essential"],
      }),
    ],
    now,
  );
  assert.equal(result.required, 90);
  assert.equal(result.remaining, 75);
  assert.deepEqual(
    result.affected.map((item) => item._id),
    ["dependent"],
  );
  assert.deepEqual(
    result.options[0].deferred.map((item) => item._id),
    ["optional"],
  );
  assert.equal(result.options[0].status, "Dependencies need review");
  assert.equal(result.options[1].status, "Does not fit current constraints");
});

test("focus time excludes paused intervals", () => {
  assert.equal(focusSeconds(2_300, null, 10_000), 2);
  assert.equal(focusSeconds(2_300, 10_000, 14_800), 7);
});

test("planner links route missed work to its goal and overdue view", () => {
  assert.equal(taskPlannerHref(task("past"), now), "/planner?goal=goal&period=Overdue");
  assert.equal(
    taskPlannerHref(task("today", { scheduledDate: "2026-11-20" }), now),
    "/planner?goal=goal&period=Today",
  );
});
