import type { Interval } from "../planning/calendar.js";

export type Work = {
  id: string;
  prerequisites: string[];
  minutes: number;
  priority: number;
  essential: boolean;
  deadline?: Date;
};
export type Change = { taskId: string; startAt: Date; endAt: Date };

export function scheduleWork(
  work: Work[],
  slots: Interval[],
  completed: Set<string>,
) {
  const remaining = new Map(work.map((task) => [task.id, task]));
  const ends = new Map<string, number>();
  const free = slots.map((slot) => ({
    start: slot.startAt.getTime(),
    end: slot.endAt.getTime(),
  }));
  const changes: Change[] = [];
  while (remaining.size) {
    const ready = [...remaining.values()].filter((task) =>
      task.prerequisites.every((id) => completed.has(id) || ends.has(id)),
    );
    ready.sort(
      (a, b) =>
        (a.deadline?.getTime() ?? Infinity) -
          (b.deadline?.getTime() ?? Infinity) ||
        b.priority - a.priority ||
        a.id.localeCompare(b.id),
    );
    const task = ready[0];
    if (!task)
      return {
        changes: [],
        reason: "One or more prerequisites are unfinished or cyclic.",
      };
    const earliest = Math.max(
      0,
      ...task.prerequisites.map((id) => ends.get(id) ?? 0),
    );
    const duration = Math.ceil(task.minutes) * 60_000;
    const slot = free.find(
      (item) =>
        Math.max(item.start, earliest) + duration <=
        Math.min(item.end, task.deadline?.getTime() ?? Infinity),
    );
    if (!slot)
      return {
        changes: [],
        reason:
          "The required work could not be placed in the available intervals before its deadline.",
      };
    const start = Math.max(slot.start, earliest);
    const end = start + duration;
    // Greedy placement is conservative. Earlier gaps can still be used by independent work.
    const index = free.indexOf(slot);
    free.splice(
      index,
      1,
      { start: slot.start, end: start },
      { start: end, end: slot.end },
    );
    ends.set(task.id, end);
    remaining.delete(task.id);
    changes.push({
      taskId: task.id,
      startAt: new Date(start),
      endAt: new Date(end),
    });
  }
  return { changes, reason: null };
}

export function essentialClosure(work: Work[]) {
  const byId = new Map(work.map((task) => [task.id, task]));
  const selected = new Set<string>();
  const visit = (id: string) => {
    const task = byId.get(id);
    if (!task || selected.has(id)) return;
    selected.add(id);
    task.prerequisites.forEach(visit);
  };
  work.filter((task) => task.essential).forEach((task) => visit(task.id));
  return work.filter((task) => selected.has(task.id));
}
