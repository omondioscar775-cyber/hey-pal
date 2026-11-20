"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, type FormEvent } from "react";
import { goalsApi } from "../lib/api";
import { displayDate, relatedId } from "../lib/planning";
import type { Goal } from "../types";
import { AppShell, EmptyState, ErrorState, PageHeader } from "./AppShell";
import { WorkspaceData, type WorkspaceRecords } from "./WorkspaceData";

const statuses = ["active", "completed", "paused", "archived"] as const;
const fields = [
  [
    { key: "title", label: "Goal title", min: 3, max: 150 },
    { key: "category", label: "Category", min: 2, max: 80 },
  ],
  [
    {
      key: "description",
      label: "Personal motivation",
      long: true,
      min: 2,
      max: 1000,
    },
  ],
  [
    {
      key: "currentState",
      label: "Current situation, strengths and challenges",
      long: true,
      min: 2,
      max: 1000,
    },
  ],
  [
    {
      key: "desiredOutcome",
      label: "Measurable outcome",
      long: true,
      min: 2,
      max: 1000,
    },
    { key: "targetDate", label: "Target date", type: "date" },
  ],
  [{ key: "weeklyAvailableHours", label: "Hours per week", type: "number" }],
] as const;
const questions = [
  "What would you like to achieve?",
  "Why is this goal important to you?",
  "Where are you today?",
  "What does success look like?",
  "How much time can you realistically commit?",
  "Review your goal",
];

type Draft = Record<(typeof fields)[number][number]["key"], string>;
const blank: Draft = {
  title: "",
  category: "",
  description: "",
  currentState: "",
  desiredOutcome: "",
  targetDate: "",
  weeklyAvailableHours: "5",
};

function GoalForm({
  goal,
  saved,
  cancel,
}: {
  goal?: Goal;
  saved: (goal: Goal) => void;
  cancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() =>
    goal
      ? {
          ...blank,
          ...goal,
          description: goal.description ?? "",
          targetDate: goal.targetDate?.slice(0, 10) ?? "",
          weeklyAvailableHours: String(goal.weeklyAvailableHours),
        }
      : blank,
  );
  const [status, setStatus] = useState(goal?.status ?? "active");
  const [step, setStep] = useState(0);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  const review = !goal && step === 5;
  function go(nextStep: number) {
    setError("");
    setStep(nextStep);
    requestAnimationFrame(() => heading.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const current = goal ? fields.flat() : (fields[step] ?? []);
    if (
      current.some(
        (field) =>
          "min" in field &&
          draft[field.key].trim().length < field.min &&
          (field.key !== "description" || draft.description),
      )
    ) {
      setError("Enter enough detail in each text field before continuing.");
      return;
    }
    if (!goal && !review) {
      go(step + 1);
      return;
    }
    setPending(true);
    setError("");
    const payload = {
      ...draft,
      weeklyAvailableHours: Number(draft.weeklyAvailableHours),
      targetDate: draft.targetDate || undefined,
    };
    try {
      const result = goal
        ? await goalsApi.updateGoal(goal._id, { ...payload, status })
        : await goalsApi.createGoal(payload);
      saved(result.goal);
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save your goal.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="card form-card stack">
      {!goal && (
        <div>
          <p>Step {step + 1} of 6</p>
          <progress aria-label="Onboarding progress" value={step + 1} max={6} />
        </div>
      )}
      <h2 ref={heading} tabIndex={-1}>
        {goal ? "Edit goal" : questions[step]}
      </h2>
      {error && <ErrorState message={error} />}
      <form className="form" onSubmit={submit}>
        {review
          ? fields.map((group, index) => (
              <div className="row line-item" key={questions[index]}>
                <div>
                  {group.map((field) => (
                    <p key={field.key}>
                      <strong>{field.label}</strong> ·{" "}
                      {draft[field.key] || "None"}
                    </p>
                  ))}
                </div>
                <button
                  type="button"
                  className="button secondary compact"
                  onClick={() => go(index)}
                >
                  Edit<span className="sr-only"> {questions[index]}</span>
                </button>
              </div>
            ))
          : (goal ? fields.flat() : fields[step]).map((field) => {
              const props = {
                value: draft[field.key],
                onChange: (
                  event: React.ChangeEvent<
                    HTMLInputElement | HTMLTextAreaElement
                  >,
                ) => setDraft({ ...draft, [field.key]: event.target.value }),
                required:
                  field.key !== "description" &&
                  (field.key !== "targetDate" ||
                    !goal ||
                    Boolean(goal.targetDate)),
                minLength: "min" in field ? field.min : undefined,
                maxLength: "max" in field ? field.max : undefined,
              };
              return (
                <label key={field.key}>
                  {field.label}
                  {"long" in field ? (
                    <textarea {...props} />
                  ) : (
                    <input
                      {...props}
                      type={"type" in field ? field.type : "text"}
                      min={field.key === "weeklyAvailableHours" ? 1 : undefined}
                      max={
                        field.key === "weeklyAvailableHours" ? 168 : undefined
                      }
                      step={
                        field.key === "weeklyAvailableHours" ? "any" : undefined
                      }
                    />
                  )}
                </label>
              );
            })}
        {goal && (
          <label>
            Status
            <select
              value={status}
              onChange={(event) =>
                setStatus(event.target.value as Goal["status"])
              }
            >
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        )}
        <div className="actions">
          {!goal && step > 0 && (
            <button
              className="button secondary"
              type="button"
              onClick={() => go(step - 1)}
              disabled={pending}
            >
              Back
            </button>
          )}
          {cancel && (
            <button
              className="button secondary"
              type="button"
              onClick={cancel}
              disabled={pending}
            >
              Cancel
            </button>
          )}
          <button className="button" disabled={pending}>
            {pending
              ? "Saving…"
              : goal
                ? "Save goal"
                : review
                  ? "Create My Goal"
                  : "Continue"}
          </button>
        </div>
      </form>
    </section>
  );
}

export function Onboarding() {
  const router = useRouter();
  return (
    <AppShell title="New goal">
      <PageHeader
        title="Make your ambition concrete"
        description="Start with one goal and give yourself room to build a realistic plan."
      />
      <GoalForm saved={(goal) => router.replace("/goals/" + goal._id)} />
    </AppShell>
  );
}

export function Goals() {
  return (
    <WorkspaceData title="My Goals">
      {(records) => <GoalList {...records} />}
    </WorkspaceData>
  );
}
function GoalList({ goals, roadmaps }: WorkspaceRecords) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [sort, setSort] = useState("recent");
  const visible = goals
    .filter(
      (goal) =>
        (!status || goal.status === status) &&
        (goal.title + " " + goal.category)
          .toLowerCase()
          .includes(query.trim().toLowerCase()),
    )
    .sort((a, b) =>
      sort === "title"
        ? a.title.localeCompare(b.title)
        : sort === "date"
          ? (a.targetDate ?? "~").localeCompare(b.targetDate ?? "~")
          : b.createdAt.localeCompare(a.createdAt),
    );
  return (
    <>
      <PageHeader
        title="My Goals"
        description="Keep your ambitions organized and your progress visible."
      >
        <Link className="button" href="/onboarding">
          New Goal
        </Link>
      </PageHeader>
      {!goals.length ? (
        <EmptyState title="Give your ambition a place to start">
          <Link className="button" href="/onboarding">
            Create Your First Goal
          </Link>
        </EmptyState>
      ) : (
        <>
          <div className="actions page-heading">
            <input
              className="filter"
              aria-label="Search goals"
              placeholder="Search goals"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <select
              className="filter"
              aria-label="Filter by status"
              value={status}
              onChange={(event) => setStatus(event.target.value)}
            >
              <option value="">All statuses</option>
              {statuses.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
            <select
              className="filter"
              aria-label="Sort goals"
              value={sort}
              onChange={(event) => setSort(event.target.value)}
            >
              <option value="recent">Newest first</option>
              <option value="title">Goal title</option>
              <option value="date">Target date</option>
            </select>
          </div>
          {!visible.length && (
            <EmptyState title="No matching goals">
              <button
                className="button secondary"
                onClick={() => {
                  setQuery("");
                  setStatus("");
                }}
              >
                Clear filters
              </button>
            </EmptyState>
          )}
          <div className="grid-cards">
            {visible.map((goal) => {
              const roadmap = roadmaps.find(
                (item) =>
                  relatedId(item.goalId) === goal._id &&
                  item.status === "active",
              );
              const milestones = roadmap?.milestones ?? [];
              return (
                <article className="card stack" key={goal._id}>
                  <div className="row">
                    <span>{goal.category}</span>
                    <span className="badge">{goal.status}</span>
                  </div>
                  <h2>{goal.title}</h2>
                  <p>{displayDate(goal.targetDate)}</p>
                  <p>
                    {milestones.find((milestone) => !milestone.completed)
                      ?.title ?? "No upcoming milestone"}
                  </p>
                  {milestones.length > 0 && (
                    <progress
                      aria-label="Milestones completed"
                      value={milestones.filter((item) => item.completed).length}
                      max={milestones.length}
                    />
                  )}
                  <Link
                    className="button secondary"
                    href={"/goals/" + goal._id}
                  >
                    View Goal<span className="sr-only"> {goal.title}</span>
                  </Link>
                </article>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}

export function GoalDetails({ id }: { id: string }) {
  return (
    <WorkspaceData title="Goal detail">
      {(records, reload) => {
        const goal = records.goals.find((item) => item._id === id);
        return goal ? (
          <GoalDetail goal={goal} records={records} reload={reload} />
        ) : (
          <EmptyState title="Goal unavailable">
            <Link className="button" href="/goals">
              Return to your goals
            </Link>
          </EmptyState>
        );
      }}
    </WorkspaceData>
  );
}

function GoalDetail({
  goal,
  records,
  reload,
}: {
  goal: Goal;
  records: WorkspaceRecords;
  reload: () => void;
}) {
  const [edit, setEdit] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const router = useRouter();
  const roadmap = records.roadmaps.find(
    (item) => relatedId(item.goalId) === goal._id && item.status === "active",
  );
  async function remove() {
    setPending(true);
    setError("");
    try {
      await goalsApi.deleteGoal(goal._id);
      router.replace("/goals");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not delete this goal.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <>
      <PageHeader
        title={goal.title}
        description={goal.category + " · " + displayDate(goal.targetDate)}
      >
        <div className="actions">
          <span className="badge">{goal.status}</span>
          <button className="button secondary" onClick={() => setEdit(true)}>
            Edit goal
          </button>
        </div>
      </PageHeader>
      <div className="stack">
        {status && (
          <div className="notice" role="status">
            {status}
          </div>
        )}
        {edit && (
          <GoalForm
            goal={goal}
            cancel={() => setEdit(false)}
            saved={() => {
              setEdit(false);
              setStatus("Goal saved.");
              reload();
            }}
          />
        )}
        <div className="split">
          <div className="stack">
            <section className="card">
              <h2>Goal overview</h2>
              <p>{goal.description}</p>
              <div className="line-item">
                <h3>Current position</h3>
                <p>{goal.currentState}</p>
              </div>
              <div className="line-item">
                <h3>Desired outcome</h3>
                <p>{goal.desiredOutcome}</p>
              </div>
              <p>{goal.weeklyAvailableHours} hours available per week</p>
            </section>
            <section className="card">
              <h2>Roadmap progress</h2>
              {roadmap?.milestones.map((item, index) => (
                <div className="line-item row" key={item._id ?? index}>
                  <span>{item.title}</span>
                  <span className="badge">
                    {item.completed ? "Complete" : "Open"}
                  </span>
                </div>
              ))}
              <Link
                className="button secondary"
                href={"/roadmaps?goal=" + goal._id}
              >
                {roadmap ? "View roadmap" : "Create roadmap"}
              </Link>
            </section>
          </div>
          <div className="stack">
            <section className="card">
              <h2>Task history</h2>
              {records.tasks
                .filter((task) => relatedId(task.goalId) === goal._id)
                .map((task) => (
                  <div className="line-item" key={task._id}>
                    <strong>{task.title}</strong>
                    <p>
                      {displayDate(task.scheduledDate)} ·{" "}
                      {task.status.replaceAll("_", " ")}
                    </p>
                  </div>
                ))}
            </section>
            <section className="card">
              <h2>Manage goal</h2>
              <button
                className="button secondary"
                onClick={() => dialog.current?.showModal()}
              >
                Delete goal
              </button>
            </section>
          </div>
        </div>
      </div>
      <dialog
        ref={dialog}
        aria-labelledby="delete-title"
        onCancel={(event) => {
          if (pending) event.preventDefault();
        }}
      >
        <div className="stack">
          <h2 id="delete-title">Delete this goal?</h2>
          <p>
            Deleting {goal.title} removes its tasks and cancels their planned bookings.
            CircleUp retains the roadmap and recovery history.
          </p>
          {error && <ErrorState message={error} />}
          <div className="actions">
            <button
              autoFocus
              className="button secondary"
              disabled={pending}
              onClick={() => dialog.current?.close()}
            >
              Cancel
            </button>
            <button className="button" disabled={pending} onClick={remove}>
              {pending ? "Deleting…" : "Delete goal"}
            </button>
          </div>
        </div>
      </dialog>
    </>
  );
}
