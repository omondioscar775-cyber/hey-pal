import assert from "node:assert/strict";
import { test } from "node:test";
import { availableIntervals, overlaps } from "./calendar.js";

const interval = (startAt: string, endAt: string) => ({
  startAt: new Date(startAt),
  endAt: new Date(endAt),
});

test("schedule intervals are half-open", () => {
  const a = interval("2026-11-20T10:00Z", "2026-11-20T11:00Z");
  assert.equal(
    overlaps(a, interval("2026-11-20T11:00Z", "2026-11-20T12:00Z")),
    false,
  );
  assert.equal(
    overlaps(a, interval("2026-11-20T10:59Z", "2026-11-20T12:00Z")),
    true,
  );
});

test("spring forward skips nonexistent local minutes and fall back retains both real hours", () => {
  const config = {
    timezone: "America/New_York",
    weeklyWindows: [{ day: 0, start: 60, end: 180 }],
    closedDates: [],
  };
  assert.deepEqual(
    availableIntervals(
      config,
      interval("2026-03-08T05:00Z", "2026-03-08T09:00Z"),
      [],
    ),
    [interval("2026-03-08T06:00Z", "2026-03-08T07:00Z")],
  );
  assert.deepEqual(
    availableIntervals(
      config,
      interval("2026-11-01T04:00Z", "2026-11-01T09:00Z"),
      [],
    ),
    [interval("2026-11-01T05:00Z", "2026-11-01T08:00Z")],
  );
});

test("existing commitments and closed dates reduce capacity", () => {
  const bounds = interval("2026-11-20T07:00Z", "2026-11-20T09:00Z");
  const config = {
    timezone: "Africa/Nairobi",
    weeklyWindows: [{ day: 5, start: 600, end: 720 }],
    closedDates: [],
  };
  assert.deepEqual(
    availableIntervals(config, bounds, [
      interval("2026-11-20T07:30Z", "2026-11-20T08:00Z"),
    ]),
    [
      interval("2026-11-20T07:00Z", "2026-11-20T07:30Z"),
      interval("2026-11-20T08:00Z", "2026-11-20T09:00Z"),
    ],
  );
  assert.deepEqual(
    availableIntervals({ ...config, closedDates: ["2026-11-20"] }, bounds, []),
    [],
  );
});
