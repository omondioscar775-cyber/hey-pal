import assert from "node:assert/strict";
import { test } from "node:test";
import { essentialClosure, scheduleWork, type Work } from "./engine.js";
import { reachesTask } from "../tasks/dependencies.js";

const availability = [
  {
    startAt: new Date("2026-11-20T10:00Z"),
    endAt: new Date("2026-11-20T12:00Z"),
  },
];
const work: Work[] = [
  {
    id: "dependent",
    prerequisites: ["base"],
    minutes: 40,
    essential: true,
    priority: 3,
  },
  { id: "base", prerequisites: [], minutes: 30, essential: false, priority: 0 },
  {
    id: "optional",
    prerequisites: [],
    minutes: 30,
    essential: false,
    priority: 0,
  },
];

test("essential work retains its prerequisites and schedules in dependency order", () => {
  const selected = essentialClosure(work);
  assert.deepEqual(
    selected.map((item) => item.id),
    ["dependent", "base"],
  );
  const outcome = scheduleWork(selected, availability, new Set());
  assert.equal(outcome.reason, null);
  assert.deepEqual(
    outcome.changes.map((item) => item.taskId),
    ["base", "dependent"],
  );
  assert.deepEqual(outcome.changes[0].endAt, outcome.changes[1].startAt);
});

test("an unfinished prerequisite or insufficient capacity cannot produce an actionable proposal", () => {
  assert.ok(scheduleWork([work[0]], availability, new Set()).reason);
  const impossible = scheduleWork(
    work.map((task) => ({ ...task, minutes: 90 })),
    availability,
    new Set(),
  );
  assert.ok(impossible.reason);
  assert.deepEqual(impossible.changes, []);
  assert.ok(
    scheduleWork(
      [{ ...work[1], deadline: new Date("2026-11-20T10:15Z") }],
      availability,
      new Set(),
    ).reason,
  );
});

test("cycle detection rejects indirect and self paths", () => {
  const graph = new Map([
    ["a", ["b"]],
    ["b", ["c"]],
  ]);
  assert.equal(reachesTask(["a"], "c", graph), true);
  assert.equal(reachesTask(["c"], "c", graph), true);
  assert.equal(reachesTask(["c"], "a", graph), false);
});
