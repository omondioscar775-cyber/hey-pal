import Task from "../../models/Task.js";
import { ApiError } from "../../shared/http.js";

export function reachesTask(
  start: string[],
  target: string,
  graph: Map<string, string[]>,
) {
  const queue = [...start];
  const seen = new Set<string>();
  while (queue.length) {
    const id = queue.pop()!;
    if (id === target) return true;
    if (seen.has(id)) continue;
    seen.add(id);
    const edges = graph.get(id);
    if (edges) queue.push(...edges);
  }
  return false;
}

export async function validateDependencies(
  userId: string,
  goalId: string,
  dependencies: string[],
  target?: string,
) {
  if (!dependencies.length) return;
  const tasks = await Task.find({ userId, goalId })
    .select("_id dependsOn")
    .lean();
  const graph = new Map(
    tasks.map((task) => [task._id.toString(), task.dependsOn.map(String)]),
  );
  if (dependencies.some((id) => !graph.has(id)))
    throw new ApiError(
      422,
      "INVALID_DEPENDENCY",
      "A prerequisite is unavailable for this goal.",
    );
  if (target && reachesTask(dependencies, target, graph))
    throw new ApiError(
      409,
      "CYCLIC_DEPENDENCY",
      "This dependency would create a cycle.",
    );
}
