import type { Task } from "../types";
import { dateKey, localDay, weekRange } from "../lib/planning";

export function WeeklyActivity({ tasks }: { tasks: Task[] }) {
  const [start] = weekRange();
  const days = Array.from({ length: 7 }, (_, index) => {
    const day = new Date(start + "T12:00:00");
    day.setDate(day.getDate() + index);
    const scheduled = tasks.filter(
      (task) => dateKey(task.scheduledDate) === localDay(day),
    );
    return {
      label: new Intl.DateTimeFormat(undefined, { weekday: "short" }).format(
        day,
      ),
      planned: scheduled.length,
      completed: scheduled.filter((task) => task.status === "completed").length,
    };
  });
  return (
    <figure className="weekly-chart">
      <figcaption>Tasks completed by scheduled day</figcaption>
      <ul>
        {days.map(({ label, completed, planned }) => (
          <li key={label}>
            <span>{label}</span>
            <progress
              value={completed}
              max={planned || 1}
              aria-label={label + " completion"}
            />
            <span>
              {completed} / {planned}
            </span>
          </li>
        ))}
      </ul>
    </figure>
  );
}
