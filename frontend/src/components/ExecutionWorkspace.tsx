"use client";

import Link from "next/link";
import { useEffect, useRef, useState, type FormEvent } from "react";
import CreateRoadmapModal from "./CreateRoadmapModal";
import CreateTaskModal from "./CreateTaskModal";
import { Modal } from "./Modal";
import { CalendarPlanner } from "./CalendarPlanner";
import { AvailabilityEditor } from "./AvailabilityEditor";
import { EmptyState, ErrorState, PageHeader } from "./AppShell";
import { WorkspaceData, type WorkspaceRecords } from "./WorkspaceData";
import { apiRequest, roadmapsApi, tasksApi } from "../lib/api";
import {
  dateKey,
  displayDate,
  localDay,
  minutes,
  missedTask,
  plannerPeriods,
  taskPlannerHref,
  type PlannerPeriod,
  openTask,
  relatedId,
  weekRange,
  workload,
} from "../lib/planning";
import type { Roadmap, Task } from "../types";

export function Roadmaps({ goalId }: { goalId?: string }) {
  return (
    <WorkspaceData title="Roadmaps">
      {(records, reload) => (
        <RoadmapList {...records} initialGoal={goalId} reload={reload} />
      )}
    </WorkspaceData>
  );
}

function RoadmapList({
  goals,
  roadmaps,
  tasks,
  initialGoal,
  reload,
}: WorkspaceRecords & { initialGoal?: string; reload: () => void }) {
  const [selection, setSelection] = useState(initialGoal ?? "");
  const [editingDraft, setEditingDraft] = useState<Roadmap>();
  const [creating, setCreating] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const goal = goals.find((goal) => goal._id === selection) ?? goals[0];
  const versions = roadmaps
    .filter((item) => relatedId(item.goalId) === goal?._id)
    .sort((a, b) => b.version - a.version);
  async function approve(roadmap: Roadmap) {
    setPending(true);
    setError("");
    try {
      await roadmapsApi.approveRoadmap(roadmap);
      setNotice("Roadmap activated.");
      reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not activate your draft.",
      );
    } finally {
      setPending(false);
    }
  }
  async function toggle(roadmap: Roadmap, index: number) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await roadmapsApi.updateRoadmap(roadmap._id, {
        milestones: roadmap.milestones.map((item, position) =>
          position === index ? { ...item, completed: !item.completed } : item,
        ),
      });
      setNotice("Milestone updated.");
      reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update milestone.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Roadmaps"
        description="Review milestones and decide what comes next."
      >
        {goal && (
          <button className="button" onClick={() => setCreating(true)}>
            Create roadmap draft
          </button>
        )}
      </PageHeader>
      {!goal ? (
        <EmptyState title="Start with a goal">
          <Link className="button" href="/onboarding">
            Create your first goal
          </Link>
        </EmptyState>
      ) : (
        <div className="stack">
          <label className="actions">
            Goal{" "}
            <select
              className="filter"
              value={goal._id}
              onChange={(event) => {
                setSelection(event.target.value);
                setNotice("");
              }}
            >
              {goals.map((goal) => (
                <option value={goal._id} key={goal._id}>
                  {goal.title}
                </option>
              ))}
            </select>
          </label>
          {error && <ErrorState message={error} />}
          {notice && (
            <div className="notice" role="status">
              {notice}
            </div>
          )}
          <div className="split">
            <div className="stack">
              {versions.length === 0 && (
                <EmptyState title="No approved roadmap yet">
                  <p>Create an editable draft to review before activation.</p>
                </EmptyState>
              )}
              {versions.map((roadmap) => (
                <section className="card" key={roadmap._id}>
                  <div className="row">
                    <h2>{roadmap.title}</h2>
                    <span className="badge">
                      Version {roadmap.version} · {roadmap.status}
                    </span>
                  </div>
                  {roadmap.status === "draft" && (
                    <div className="actions">
                      <button
                        className="button secondary"
                        disabled={pending}
                        onClick={() => {
                          setEditingDraft(roadmap);
                          setCreating(true);
                        }}
                      >
                        Edit draft
                      </button>
                      <button
                        className="button"
                        disabled={pending || !roadmap.milestones.length}
                        onClick={() => void approve(roadmap)}
                      >
                        Approve saved draft
                      </button>
                    </div>
                  )}
                  <ol className="timeline">
                    {roadmap.milestones.map((milestone, index) => (
                      <li key={milestone._id ?? index}>
                        <details>
                          <summary>
                            {milestone.title} ·{" "}
                            {milestone.completed ? "Complete" : "Open"}
                          </summary>
                          <p>{milestone.description}</p>
                          <p>{displayDate(milestone.targetDate)}</p>
                          {roadmap.status === "active" && (
                            <button
                              className="button secondary compact"
                              disabled={pending}
                              onClick={() => void toggle(roadmap, index)}
                            >
                              {milestone.completed
                                ? "Reopen milestone"
                                : "Mark milestone complete"}
                            </button>
                          )}
                        </details>
                      </li>
                    ))}
                  </ol>
                  {tasks.filter(
                    (task) => relatedId(task.roadmapId) === roadmap._id,
                  ).length > 0 && (
                    <details>
                      <summary>Roadmap tasks</summary>
                      {tasks
                        .filter(
                          (task) => relatedId(task.roadmapId) === roadmap._id,
                        )
                        .map((task) => (
                          <div className="line-item" key={task._id}>
                            {task.title} · {minutes(task.estimatedMinutes)}
                            {task.dependsOn.length > 0 && (
                              <p>
                                Dependencies:{" "}
                                {task.dependsOn
                                  .map((dependency) =>
                                    typeof dependency === "string"
                                      ? "Linked task"
                                      : dependency.title,
                                  )
                                  .join(", ")}
                              </p>
                            )}
                          </div>
                        ))}
                    </details>
                  )}
                </section>
              ))}
            </div>
            <section className="card stack">
              <h2>Planning context</h2>
              <p>{goal.weeklyAvailableHours} hours available each week</p>
              <p>Goal target · {displayDate(goal.targetDate)}</p>
              <Link className="button secondary" href="/planner">
                Open planner
              </Link>
            </section>
          </div>
        </div>
      )}
      {creating && (
        <CreateRoadmapModal
          goals={goals}
          roadmaps={roadmaps}
          initialGoalId={goal?._id}
          existingDraft={editingDraft}
          onClose={() => {
            setCreating(false);
            setEditingDraft(undefined);
          }}
          onRoadmapCreated={(roadmap) => {
            setSelection(relatedId(roadmap.goalId));
            setNotice(
              roadmap.status === "draft"
                ? "Draft saved."
                : "Roadmap activated.",
            );
            reload();
          }}
        />
      )}
    </>
  );
}

export function Planner({
  goalId,
  period,
}: {
  goalId?: string;
  period?: PlannerPeriod;
}) {
  return (
    <WorkspaceData title="Planner">
      {(records, reload) => (
        <Schedule
          key={(goalId ?? "") + (period ?? "")}
          {...records}
          reload={reload}
          goalId={goalId}
          period={period}
        />
      )}
    </WorkspaceData>
  );
}

function Schedule({
  goals,
  roadmaps,
  tasks,
  reload,
  goalId,
  period,
}: WorkspaceRecords & {
  reload: () => void;
  goalId?: string;
  period?: PlannerPeriod;
}) {
  const [view, setView] = useState<PlannerPeriod>(period ?? "This Week");
  const [selection, setSelection] = useState(goalId ?? "");
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState("");
  const [removing, setRemoving] = useState<Task>();
  const [deleteError, setDeleteError] = useState("");
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const goal = goals.find((item) => item._id === selection) ?? goals[0];
  const [start, end] = weekRange();
  const today = localDay();
  const active = roadmaps.filter((item) => item.status === "active");
  const canCreate = active.some((item) => relatedId(item.goalId) === goal?._id);
  const goalTasks = tasks.filter(
    (task) => relatedId(task.goalId) === goal?._id,
  );
  const visible = goalTasks.filter((task) => {
    const day = dateKey(task.scheduledDate);
    return view === "Today"
      ? day === today
      : view === "Upcoming"
        ? day > end
        : day >= start && day <= end;
  });
  const overdue = goalTasks.filter((task) => missedTask(task, today));
  const scheduled = view === "Overdue" ? overdue : visible;
  const capacity = goal ? workload(tasks, goal) : null;
  async function deleteTask(task: Task) {
    setPending(true);
    setDeleteError("");
    try {
      await tasksApi.deleteTask(task._id);
      setRemoving(undefined);
      setNotice("Task deleted.");
      reload();
    } catch (error) {
      setDeleteError(
        error instanceof Error ? error.message : "Could not delete task.",
      );
    } finally {
      setPending(false);
    }
  }
  async function update(task: Task, changes: Partial<Task>) {
    setPending(true);
    setError("");
    setNotice("");
    try {
      await tasksApi.updateTask(task._id, changes);
      setEditing("");
      setNotice("Task updated.");
      reload();
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update task.",
      );
    } finally {
      setPending(false);
    }
  }
  function reschedule(event: FormEvent<HTMLFormElement>, task: Task) {
    event.preventDefault();
    const scheduledDate = String(new FormData(event.currentTarget).get("day"));
    if (scheduledDate)
      void update(task, {
        scheduledDate,
        ...(task.status === "missed" ? { status: "pending" } : {}),
      });
  }
  return (
    <>
      <PageHeader
        title="Plan Your Time"
        description="Make room for the work that moves your goals forward."
      >
        <button
          className="button"
          disabled={!canCreate}
          onClick={() => setCreating(true)}
        >
          New task
        </button>
      </PageHeader>
      {error && <ErrorState message={error} />}
      {notice && (
        <div className="notice" role="status">
          {notice}
        </div>
      )}
      {!goal ? (
        <EmptyState title="Your planner starts with a goal">
          <Link className="button" href="/onboarding">
            Create a goal
          </Link>
        </EmptyState>
      ) : (
        <div className="stack">
          <div className="actions">
            <label>
              Goal{" "}
              <select
                className="filter"
                value={goal._id}
                onChange={(event) => setSelection(event.target.value)}
              >
                {goals.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
            <div className="actions" aria-label="Schedule period">
              {plannerPeriods.map((item) => (
                <button
                  className={
                    item === view
                      ? "button compact"
                      : "button compact secondary"
                  }
                  aria-pressed={item === view}
                  key={item}
                  onClick={() => setView(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="split">
            <section className="card">
              <h2>{view}</h2>
              {!scheduled.length && <p>No tasks scheduled for this period.</p>}
              {scheduled.map((task) => (
                <article className="line-item stack" key={task._id}>
                  <div className="row">
                    <h3>{task.title}</h3>
                    <span className="badge">
                      {task.status.replaceAll("_", " ")}
                    </span>
                  </div>
                  <small>
                    {displayDate(task.scheduledDate)} ·{" "}
                    {minutes(task.estimatedMinutes)} · {task.priority} priority
                  </small>
                  {task.description && <p>{task.description}</p>}
                  <div className="actions">
                    {openTask(task) && (
                      <>
                        <Link
                          className="button secondary compact"
                          href={"/focus?task=" + task._id}
                        >
                          Focus
                        </Link>
                        <button
                          className="button secondary compact"
                          disabled={pending}
                          onClick={() => setEditing(task._id)}
                        >
                          Reschedule
                        </button>
                        <button
                          className="button secondary compact"
                          disabled={pending}
                          onClick={() =>
                            void update(task, { status: "completed" })
                          }
                        >
                          Complete task
                        </button>
                      </>
                    )}
                    {task.status === "completed" && (
                      <button
                        className="button secondary compact"
                        disabled={pending}
                        onClick={() => void update(task, { status: "pending" })}
                      >
                        Reopen task
                      </button>
                    )}
                    <button
                      className="button secondary compact"
                      disabled={pending}
                      onClick={() => {
                        setDeleteError("");
                        setRemoving(task);
                      }}
                    >
                      Delete task
                    </button>
                  </div>
                  {editing === task._id && (
                    <form
                      className="form"
                      onSubmit={(event) => reschedule(event, task)}
                    >
                      <label>
                        Schedule date
                        <input
                          type="date"
                          name="day"
                          required
                          defaultValue={dateKey(task.scheduledDate)}
                        />
                      </label>
                      <div className="actions">
                        <button className="button" disabled={pending}>
                          Save date
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => setEditing("")}
                          disabled={pending}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </article>
              ))}
            </section>
            <div className="stack">
              <section className="card stack">
                <h2>Weekly workload</h2>
                {capacity && (
                  <>
                    <div>
                      <p>Available · {minutes(capacity.available)}</p>
                      <p>Planned · {minutes(capacity.planned)}</p>
                      <p>
                        Remaining · {minutes(Math.max(0, capacity.remaining))}
                      </p>
                    </div>
                    <progress
                      aria-label="Scheduled share of weekly capacity"
                      value={Math.min(capacity.planned, capacity.available)}
                      max={capacity.available}
                    />
                    {capacity.remaining < 0 && (
                      <div className="notice warning" role="status">
                        Scheduled work exceeds this goal’s capacity by{" "}
                        {minutes(-capacity.remaining)}.
                      </div>
                    )}
                  </>
                )}
                {!canCreate && (
                  <Link
                    className="text-link"
                    href={"/roadmaps?goal=" + goal._id}
                  >
                    Approve a roadmap to add tasks
                  </Link>
                )}
              </section>
              <section className="card">
                <details>
                  <summary>Overdue tasks</summary>
                  {overdue.map((task) => (
                    <p key={task._id}>{task.title}</p>
                  ))}
                  <Link className="text-link" href="/recovery">
                    Review missed work
                  </Link>
                </details>
              </section>
            </div>
          </div>
        </div>
      )}
      <AvailabilityEditor />
      <CalendarPlanner tasks={tasks} />
      {removing && (
        <Modal
          label="Delete task"
          pending={pending}
          onClose={() => setRemoving(undefined)}
        >
          <div className="card stack">
            <h2>Delete this task?</h2>
            <p>{removing.title}</p>
            {deleteError && <ErrorState message={deleteError} />}
            <div className="actions">
              <button
                autoFocus
                className="button secondary"
                disabled={pending}
                onClick={() => setRemoving(undefined)}
              >
                Cancel
              </button>
              <button
                className="button"
                disabled={pending}
                onClick={() => void deleteTask(removing)}
              >
                {pending ? "Deleting…" : "Delete task"}
              </button>
            </div>
          </div>
        </Modal>
      )}
      {creating && (
        <CreateTaskModal
          isOpen
          goals={goals.filter((item) =>
            active.some((roadmap) => relatedId(roadmap.goalId) === item._id),
          )}
          roadmaps={active}
          initialGoalId={goal?._id}
          onClose={() => setCreating(false)}
          onTaskCreated={(task) => {
            setSelection(relatedId(task.goalId));
            setNotice("Task scheduled.");
            reload();
          }}
        />
      )}
    </>
  );
}

export function Focus({ taskId }: { taskId?: string }) {
  return (
    <WorkspaceData title="Focus">
      {({ tasks, goals }) => (
        <FocusTimer tasks={tasks} goals={goals} taskId={taskId} />
      )}
    </WorkspaceData>
  );
}

function FocusTimer({
  tasks,
  goals,
  taskId,
}: {
  tasks: Task[];
  goals: WorkspaceRecords["goals"];
  taskId?: string;
}) {
  const [task, setTask] = useState(taskId ?? "");
  const [preset, setPreset] = useState(25);
  const [session, setSession] = useState<{
    _id: string;
    taskId?: string;
    state: "active" | "paused" | "completed" | "interrupted";
    revision: number;
    actualSeconds: number;
    resumedAt?: string;
    reflection?: string;
  }>();
  const [now, setNow] = useState(0);
  const [pending, setPending] = useState(false);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [reflection, setReflection] = useState("");
  const summary = useRef<HTMLHeadingElement>(null);
  const requestKey = useRef("");
  const available = tasks.filter(openTask);
  const current = session
    ? tasks.find((item) => item._id === session.taskId)
    : (available.find((item) => item._id === task) ?? available[0]);
  const running = session?.state === "active";
  const finished = session?.state === "completed";
  const elapsed =
    (session?.actualSeconds ?? 0) +
    (running && session?.resumedAt
      ? Math.max(0, Math.floor((now - Date.parse(session.resumedAt)) / 1000))
      : 0);

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ sessions: NonNullable<typeof session>[] }>(
      "/focus/sessions?state=open&limit=1",
    )
      .then(({ sessions }) => {
        if (cancelled) return;
        setSession(sessions[0]);
        setNow(Date.now());
        setReady(true);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your focus session.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (finished) summary.current?.focus();
  }, [finished]);

  async function transition(action: "start" | "pause" | "resume" | "complete") {
    setPending(true);
    setError("");
    try {
      if (action === "start") requestKey.current ||= crypto.randomUUID();
      const body =
        action === "start"
          ? { taskId: current?._id, requestKey: requestKey.current }
          : {
              revision: session?.revision,
              ...(action === "complete" && { reflection }),
            };
      const { session: saved } = await apiRequest<{
        session: NonNullable<typeof session>;
      }>(
        action === "start"
          ? "/focus/sessions"
          : "/focus/sessions/" + session?._id + "/" + action,
        { method: "POST", body: JSON.stringify(body) },
      );
      if (saved.resumedAt) setNow(Date.parse(saved.resumedAt));
      setSession(saved);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not update focus.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        title="Focus"
        description="Give one task your full attention."
      />
      {error && <ErrorState message={error} />}
      {current || session ? (
        <section className="card form-card stack focus-card">
          <label className="actions">
            Task{" "}
            <select
              className="filter"
              disabled={Boolean(session) || pending}
              value={current?._id ?? ""}
              onChange={(event) => setTask(event.target.value)}
            >
              {(session && current ? [current] : available).map((item) => (
                <option key={item._id} value={item._id}>
                  {item.title}
                </option>
              ))}
            </select>
          </label>
          <p>
            {
              goals.find(
                (goal) => goal._id === relatedId(current?.goalId ?? null),
              )?.title
            }
          </p>
          {finished ? (
            <>
              <h2 ref={summary} tabIndex={-1}>
                Session summary
              </h2>
              <p>
                Actual focus time · {Math.floor(elapsed / 60)} min{" "}
                {elapsed % 60} sec
              </p>
              <p>
                {session?.reflection ||
                  "Your session is saved. Update the task separately in the planner."}
              </p>
              <div className="actions">
                {current && (
                  <Link
                    className="button secondary"
                    href={taskPlannerHref(current)}
                  >
                    Review task in planner
                  </Link>
                )}
                <button
                  className="button"
                  onClick={() => {
                    setSession(undefined);
                    requestKey.current = "";
                    setReflection("");
                  }}
                >
                  New session
                </button>
              </div>
            </>
          ) : (
            <>
              <label className="actions">
                Target duration{" "}
                <select
                  className="filter"
                  value={preset}
                  disabled={Boolean(session) || pending}
                  onChange={(event) => setPreset(Number(event.target.value))}
                >
                  {[15, 25, 45, 60].map((value) => (
                    <option key={value} value={value}>
                      {value} minutes
                    </option>
                  ))}
                </select>
              </label>
              <div className="timer" aria-label="Elapsed focus time">
                {String(Math.floor(elapsed / 60)).padStart(2, "0")}:
                {String(elapsed % 60).padStart(2, "0")}
              </div>
              <progress
                aria-label="Progress toward focus target"
                value={Math.min(elapsed, preset * 60)}
                max={preset * 60}
              />
              {session && (
                <div className="form">
                  <label>
                    Reflection for this session
                    <textarea
                      value={reflection}
                      maxLength={2000}
                      onChange={(event) => setReflection(event.target.value)}
                    />
                  </label>
                </div>
              )}
              <div className="actions">
                <button
                  className="button"
                  disabled={!ready || pending}
                  onClick={() =>
                    void transition(
                      running ? "pause" : session ? "resume" : "start",
                    )
                  }
                >
                  {running ? "Pause" : session ? "Resume" : "Start"}
                </button>
                <button
                  className="button secondary"
                  disabled={!session || pending}
                  onClick={() => void transition("complete")}
                >
                  Finish Session
                </button>
              </div>
            </>
          )}
        </section>
      ) : (
        <EmptyState title="Choose something to focus on">
          <Link className="button" href="/planner">
            Open planner
          </Link>
        </EmptyState>
      )}
    </>
  );
}
