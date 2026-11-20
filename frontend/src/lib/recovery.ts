import type { Goal, Task } from "../types";
import {
  dateKey,
  localDay,
  missedTask,
  minutes,
  openTask,
  relatedId,
  weekRange,
  workload,
} from "./planning";

export function recoveryAssessment(
  goal: Goal,
  tasks: Task[],
  now = new Date(),
) {
  const today = localDay(now);
  const [, end] = weekRange(now);
  const deadline = goal.targetDate ? dateKey(goal.targetDate) : undefined;
  const goalTasks = tasks.filter((task) => relatedId(task.goalId) === goal._id);
  const missed = goalTasks.filter((task) => missedTask(task, today));
  const essential = missed.filter((task) => task.isEssential);
  const optional = missed.filter((task) => !task.isEssential);
  const missedIds = new Set(missed.map((task) => task._id));
  const dependencyId = (dependency: Task["dependsOn"][number]) =>
    typeof dependency === "string" ? dependency : dependency._id;
  const affected = tasks.filter(
    (task) =>
      openTask(task) &&
      !missedIds.has(task._id) &&
      task.dependsOn.some((dependency) =>
        missedIds.has(dependencyId(dependency)),
      ),
  );
  const incomplete = (task: Task) =>
    task.dependsOn.some(
      (dependency) =>
        tasks.find((item) => item._id === dependencyId(dependency))?.status !==
        "completed",
    );
  const total = (items: Task[]) =>
    items.reduce((sum, task) => sum + task.estimatedMinutes, 0);
  // The API has weekly capacity and scheduled days. It does not expose usable time slots.
  const required = total(missed);
  const remainingWork = total(goalTasks.filter(openTask));
  const capacity = workload(
    tasks.filter((task) => !missedIds.has(task._id)),
    goal,
    now,
  );
  const remaining = Math.max(0, capacity.remaining);
  const overdueGoal = Boolean(deadline && deadline < today);
  const estimate = (items: Task[], deferred: Task[] = []) => {
    if (!items.length) return "Scope review needed";
    if (overdueGoal || total(items) > remaining)
      return "Does not fit current constraints";
    if (
      items.some(incomplete) ||
      deferred.some((task) =>
        affected.some((item) =>
          item.dependsOn.some(
            (dependency) => dependencyId(dependency) === task._id,
          ),
        ),
      )
    )
      return "Dependencies need review";
    return "Fits weekly estimate · slots unverified";
  };
  const options = [
    {
      title: "Protect the Deadline",
      description:
        "Keep essential work in view and review which optional tasks can wait.",
      status: estimate(essential, optional),
      retained: essential,
      deferred: optional,
      next:
        "Review essential work by " +
        (deadline && deadline < end ? deadline : end),
    },
    {
      title: "Redistribute Work",
      description:
        "Review the effort required to make room for all missed work.",
      status: estimate(missed),
      retained: missed,
      deferred: [],
      next: "Choose dates after checking your calendar and dependencies",
    },
    {
      title: "Revise the Milestone",
      description:
        "Revisit the next target when current time and scope are too tight.",
      status: "Requires a new milestone target",
      retained: missed,
      deferred: [],
      next:
        "Choose a revised target with enough time for " +
        minutes(required) +
        " of missed work",
    },
  ];
  return { missed, required, remainingWork, remaining, affected, options };
}
