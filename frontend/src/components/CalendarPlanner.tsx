"use client";

import { useRef, useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { localDay, minutes, openTask } from "../lib/planning";
import type { Task } from "../types";
import { ErrorState } from "./AppShell";

type Draft = {
  type: "task" | "fixed_commitment" | "break";
  taskId?: string;
  startAt: string;
  endAt: string;
};
type Block = Draft & { _id: string; status: string };

function instant(value: string) {
  const date = new Date(value);
  const time = [date.getHours(), date.getMinutes()]
    .map((part) => String(part).padStart(2, "0"))
    .join(":");
  if (
    !Number.isFinite(date.getTime()) ||
    localDay(date) + "T" + time !== value
  ) {
    throw new Error(
      "Choose a valid local time. Clock changes can make some times unavailable.",
    );
  }
  return date.toISOString();
}

export function CalendarPlanner({ tasks }: { tasks: Task[] }) {
  const [opened, setOpened] = useState(false);
  const [type, setType] = useState<Draft["type"]>("fixed_commitment");
  const [preview, setPreview] = useState<Draft>();
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [capacity, setCapacity] = useState<number>();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const requestKey = useRef("");
  const eligible = tasks.filter(openTask);

  async function refresh() {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(end.getDate() + 7);
    const query = new URLSearchParams({
      startAt: start.toISOString(),
      endAt: end.toISOString(),
    });
    const [calendar, available] = await Promise.all([
      apiRequest<{ blocks: Block[] }>("/planner/blocks?" + query),
      apiRequest<{ availableMinutes: number }>("/planner/capacity?" + query),
    ]);
    setBlocks(calendar.blocks);
    setCapacity(available.availableMinutes);
  }

  async function run(action: () => Promise<void>) {
    setPending(true);
    setError("");
    setStatus("");
    try {
      await action();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not update your calendar.",
      );
    } finally {
      setPending(false);
    }
  }

  async function check(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    await run(async () => {
      const draft = {
        type,
        startAt: instant(String(values.get("start"))),
        endAt: instant(String(values.get("end"))),
        ...(type === "task" && { taskId: String(values.get("task")) }),
      };
      await apiRequest("/planner/preview", {
        method: "POST",
        body: JSON.stringify(draft),
      });
      requestKey.current = crypto.randomUUID();
      setPreview(draft);
    });
  }

  function reserve() {
    if (!preview) return;
    void run(async () => {
      await apiRequest("/planner/blocks", {
        method: "POST",
        body: JSON.stringify({ ...preview, requestKey: requestKey.current }),
      });
      setPreview(undefined);
      setStatus("Calendar booking saved.");
      await refresh();
    });
  }

  return (
    <section className="card stack">
      <div className="row">
        <h2>Calendar bookings</h2>
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => {
            setOpened(true);
            void run(refresh);
          }}
        >
          {opened ? "Refresh bookings" : "Open calendar bookings"}
        </button>
      </div>
      {error && <ErrorState message={error} />}
      {status && <p role="status">{status}</p>}
      {opened && (
        <>
          {capacity !== undefined && (
            <p>
              Free time in the next seven calendar days · {minutes(capacity)}
            </p>
          )}
          {blocks.map((block) => (
            <div className="line-item row" key={block._id}>
              <span>
                {block.taskId
                  ? (tasks.find((task) => task._id === block.taskId)?.title ??
                    "Task")
                  : block.type.replaceAll("_", " ")}{" "}
                · {new Date(block.startAt).toLocaleString()} –{" "}
                {new Date(block.endAt).toLocaleString()}
              </span>
              {block.status === "planned" && (
                <button
                  className="button secondary compact"
                  disabled={pending}
                  onClick={() => {
                    void run(async () => {
                      await apiRequest("/planner/blocks/" + block._id, {
                        method: "DELETE",
                      });
                      setStatus("Calendar booking cancelled.");
                      await refresh();
                    });
                  }}
                >
                  Cancel booking
                </button>
              )}
            </div>
          ))}
          <p>
            Booking times use your device timezone (
            {Intl.DateTimeFormat().resolvedOptions().timeZone}).
          </p>
          {preview ? (
            <div className="stack">
              <p role="status">
                Preview · {new Date(preview.startAt).toLocaleString()} –{" "}
                {new Date(preview.endAt).toLocaleString()}
              </p>
              <div className="actions">
                <button className="button" disabled={pending} onClick={reserve}>
                  Confirm booking
                </button>
                <button
                  className="button secondary"
                  disabled={pending}
                  onClick={() => setPreview(undefined)}
                >
                  Edit booking
                </button>
              </div>
            </div>
          ) : (
            <form className="form" onSubmit={check}>
              <label>
                Booking type
                <select
                  value={type}
                  onChange={(event) =>
                    setType(event.target.value as Draft["type"])
                  }
                >
                  <option value="fixed_commitment">Fixed commitment</option>
                  <option value="break">Break</option>
                  <option value="task" disabled={!eligible.length}>
                    Task
                  </option>
                </select>
              </label>
              {type === "task" && (
                <label>
                  Task
                  <select name="task" required>
                    {eligible.map((task) => (
                      <option key={task._id} value={task._id}>
                        {task.title}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <label>
                Start time
                <input name="start" type="datetime-local" required />
              </label>
              <label>
                End time
                <input name="end" type="datetime-local" required />
              </label>
              <button className="button" disabled={pending}>
                Preview booking
              </button>
            </form>
          )}
        </>
      )}
    </section>
  );
}
