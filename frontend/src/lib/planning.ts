import type { Goal, Task } from "../types";

export const relatedId = (value: string | { _id: string } | null) =>
  typeof value === "string" ? value : (value?._id ?? "");
export const dateKey = (date: string) => date.slice(0, 10);
export function localDay(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("-");
}
export function weekRange(now = new Date()) {
  const start = new Date(now);
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return [localDay(start), localDay(end)];
}
export const openTask = (task: Task) =>
  task.status !== "completed" && task.status !== "cancelled";
export const missedTask = (task: Task, today = localDay()) =>
  task.status === "missed" ||
  (openTask(task) &&
    (dateKey(task.scheduledDate) < today ||
      Boolean(task.dueAt && Date.parse(task.dueAt) <= Date.now())));
export const plannerPeriods = [
  "Today",
  "This Week",
  "Upcoming",
  "Overdue",
] as const;
export type PlannerPeriod = (typeof plannerPeriods)[number];

export function plannerHref(goalId: string, period: PlannerPeriod) {
  return "/planner?" + new URLSearchParams({ goal: goalId, period }).toString();
}

export function taskPlannerHref(task: Task, now = new Date()) {
  const date = dateKey(task.scheduledDate);
  const today = localDay(now);
  const [, weekEnd] = weekRange(now);
  const period = missedTask(task, today)
    ? "Overdue"
    : date === today
      ? "Today"
      : date > weekEnd
        ? "Upcoming"
        : "This Week";
  return plannerHref(relatedId(task.goalId), period);
}

export function workload(tasks: Task[], goal: Goal, now = new Date()) {
  const [start, end] = weekRange(now);
  const planned = tasks
    .filter(
      (task) =>
        task.status !== "cancelled" &&
        relatedId(task.goalId) === goal._id &&
        dateKey(task.scheduledDate) >= start &&
        dateKey(task.scheduledDate) <= end,
    )
    .reduce((total, task) => total + task.estimatedMinutes, 0);
  const available = goal.weeklyAvailableHours * 60;
  return { available, planned, remaining: available - planned };
}
export const minutes = (value: number) =>
  value < 60
    ? value + " min"
    : Math.floor(value / 60) + "h " + (value % 60) + "m";
export const displayDate = (date?: string) =>
  date
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeZone: "UTC",
      }).format(new Date(date))
    : "No date set";
export function focusSeconds(
  accumulated: number,
  startedAt: number | null,
  now: number,
) {
  return Math.floor(
    (accumulated + (startedAt === null ? 0 : Math.max(0, now - startedAt))) /
      1000,
  );
}
