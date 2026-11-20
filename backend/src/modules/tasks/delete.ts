import Task from "../../models/Task.js";
import { ScheduleBlock } from "../planning/models.js";

export async function deleteTasks(
  userId: string,
  filter: { _id?: string; goalId?: string; roadmapId?: string },
) {
  const tasks = await Task.find({ userId, ...filter })
    .select("_id")
    .lean();
  const ids = tasks.map((task) => task._id);
  if (!ids.length) return 0;
  await ScheduleBlock.updateMany(
    { userId, taskId: { $in: ids }, status: "planned" },
    { status: "cancelled" },
  );
  await Task.deleteMany({ userId, _id: { $in: ids } });
  await Task.updateMany(
    { userId, dependsOn: { $in: ids } },
    { $pull: { dependsOn: { $in: ids } } },
  );
  return ids.length;
}
