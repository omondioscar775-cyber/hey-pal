"use client";

import Link from "next/link";
import { useState } from "react";
import { EmptyState, PageHeader } from "./AppShell";
import { Modal } from "./Modal";
import { ServerRecovery } from "./ServerRecovery";
import { WorkspaceData, type WorkspaceRecords } from "./WorkspaceData";
import {
  dateKey,
  displayDate,
  localDay,
  minutes,
  missedTask,
  plannerHref,
  relatedId,
} from "../lib/planning";
import { recoveryAssessment } from "../lib/recovery";
import type { Goal, Milestone } from "../types";

type Assessment = ReturnType<typeof recoveryAssessment>;
type Option = Assessment["options"][number];

export default function Recovery() {
  const [status, setStatus] = useState("");
  return (
    <WorkspaceData title="Recovery Centre">
      {(records, reload) => (
        <RecoveryCentre
          {...records}
          reload={reload}
          status={status}
          setStatus={setStatus}
        />
      )}
    </WorkspaceData>
  );
}

function RecoveryCentre({
  goals,
  roadmaps,
  tasks,
  reload,
  status,
  setStatus,
}: WorkspaceRecords & {
  reload: () => void;
  status: string;
  setStatus: (value: string) => void;
}) {
  const [selection, setSelection] = useState("");
  const [preview, setPreview] = useState<number | null>(null);
  const goalIds = new Set(
    tasks
      .filter((task) => missedTask(task))
      .map((task) => relatedId(task.goalId)),
  );
  const affectedGoals = goals.filter((goal) => goalIds.has(goal._id));
  const goal =
    affectedGoals.find((item) => item._id === selection) ?? affectedGoals[0];
  const assessment = goal ? recoveryAssessment(goal, tasks) : null;
  const milestone = roadmaps
    .find(
      (item) =>
        item.status === "active" && relatedId(item.goalId) === goal?._id,
    )
    ?.milestones.find((item) => !item.completed);

  return (
    <>
      <PageHeader
        title="Recovery Centre"
        description="Plans change. Your goals can still move forward."
      />
      {status && (
        <p className="notice" role="status">
          {status}
        </p>
      )}
      {!assessment || !goal ? (
        <EmptyState title="No missed work to review">
          <p>
            If a task slips, you’ll find it here with the context to decide what
            comes next.
          </p>
          <Link className="button secondary" href="/planner">
            Open planner
          </Link>
        </EmptyState>
      ) : (
        <div className="stack">
          <div className="recovery-banner">
            <div>
              <span className="eyebrow">RECOVERY OVERVIEW</span>
              <h2>Give yourself room to adjust.</h2>
              <p>
                {assessment.missed.length} missed{" "}
                {assessment.missed.length === 1 ? "task" : "tasks"} ·{" "}
                {minutes(assessment.required)} to review ·{" "}
                {affectedGoals.length} affected{" "}
                {affectedGoals.length === 1 ? "goal" : "goals"}
              </p>
            </div>
            <label>
              Goal{" "}
              <select
                className="filter"
                value={goal._id}
                onChange={(event) => setSelection(event.target.value)}
              >
                {affectedGoals.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.title}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <ServerRecovery
            key={goal._id}
            goalId={goal._id}
            tasks={tasks}
            reload={() => {
              setStatus("Recovery plan applied.");
              reload();
            }}
          />
          <div className="split">
            <section className="card">
              <h2>Missed work and impact</h2>
              {assessment.missed.map((task) => (
                <div key={task._id} className="line-item row">
                  <div>
                    <strong>{task.title}</strong>
                    <p>
                      {displayDate(task.scheduledDate)} ·{" "}
                      {minutes(task.estimatedMinutes)}
                    </p>
                  </div>
                  <span className="badge">
                    {task.isEssential ? "Essential" : "Optional"}
                  </span>
                </div>
              ))}
              <p>
                {assessment.affected.length
                  ? "Dependent work to review: " +
                    assessment.affected.map((task) => task.title).join(", ")
                  : "No open tasks directly depend on this missed work."}
              </p>
            </section>
            <aside className="card">
              <h2>Planning constraints</h2>
              <p>
                Unallocated weekly estimate · {minutes(assessment.remaining)}
              </p>
              <p>Total open work · {minutes(assessment.remainingWork)}</p>
              <p>Goal deadline · {displayDate(goal.targetDate)}</p>
              <p>Next milestone · {milestone?.title ?? "None set"}</p>
              {milestone && (
                <p>Milestone target · {displayDate(milestone.targetDate)}</p>
              )}
            </aside>
          </div>
          <div>
            <h2>Compare recovery alternatives</h2>
            <p>
              Weekly estimates can help you compare scope. Review calendar
              availability before choosing dates.
            </p>
          </div>
          {assessment.options
            .slice(0, 2)
            .every((item) => !item.status.startsWith("Fits")) && (
            <div className="notice warning">
              Your current estimates and dependencies don’t show a feasible
              recovery plan. Consider reducing scope or revising a milestone.
            </div>
          )}
          <div className="grid-cards">
            {assessment.options.map((item, index) => (
              <article className="card stack" key={item.title}>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
                <span className="badge">{item.status}</span>
                <p>
                  {minutes(
                    item.retained.reduce(
                      (sum, task) => sum + task.estimatedMinutes,
                      0,
                    ),
                  )}{" "}
                  retained · {item.deferred.length} to review for deferral
                </p>
                <p>Milestone to review · {milestone?.title ?? "None set"}</p>
                <button
                  className="button secondary"
                  onClick={() => setPreview(index)}
                >
                  Preview<span className="sr-only"> {item.title}</span>
                </button>
              </article>
            ))}
          </div>
          {preview !== null && (
            <RecoveryPreview
              assessment={assessment}
              option={assessment.options[preview]}
              goal={goal}
              milestone={milestone}
              dateLabel={
                preview === 0
                  ? undefined
                  : preview === 1
                    ? "Tentative work date"
                    : "Tentative milestone target"
              }
              close={() => setPreview(null)}
            />
          )}
        </div>
      )}
    </>
  );
}

function RecoveryPreview({
  assessment,
  option,
  goal,
  milestone,
  dateLabel,
  close,
}: {
  assessment: Assessment;
  option: Option;
  goal: Goal;
  milestone?: Milestone;
  dateLabel?: string;
  close: () => void;
}) {
  const [draftDate, setDraftDate] = useState("");
  return (
    <Modal label={option.title} onClose={close} pending={false}>
      <div className="card stack">
        <h2>{option.title}</h2>
        <p>{option.status}</p>
        <div className="split">
          <section>
            <h3>Before</h3>
            {assessment.missed.map((task) => (
              <p key={task._id}>
                {task.title} · {displayDate(task.scheduledDate)}
              </p>
            ))}
            <p>Milestone target · {displayDate(milestone?.targetDate)}</p>
          </section>
          <section>
            <h3>Proposed approach</h3>
            {option.retained.map((task) => (
              <p key={task._id}>Keep · {task.title}</p>
            ))}
            {option.deferred.map((task) => (
              <p key={task._id}>Review for deferral · {task.title}</p>
            ))}
            <p>{option.next}</p>
            {dateLabel && (
              <div className="form">
                <label>
                  {dateLabel}
                  <input
                    type="date"
                    min={localDay()}
                    value={draftDate}
                    onChange={(event) => setDraftDate(event.target.value)}
                  />
                </label>
                {draftDate && <p>Proposed date · {displayDate(draftDate)}</p>}
                {draftDate &&
                  goal.targetDate &&
                  draftDate > dateKey(goal.targetDate) && (
                    <p role="status" className="notice warning">
                      This date is after your goal deadline.
                    </p>
                  )}
              </div>
            )}
          </section>
        </div>
        <div className="notice" id="recovery-availability">
          Generate a recovery plan above to apply verified changes. You can also
          make individual date changes in Planner.
        </div>
        <div className="actions">
          <button autoFocus className="button secondary" onClick={close}>
            Close preview
          </button>
          <button
            className="button"
            disabled
            aria-describedby="recovery-availability"
          >
            Confirm Recovery Plan
          </button>
          <Link
            className="button secondary"
            href={plannerHref(goal._id, "Overdue")}
          >
            Open planner
          </Link>
        </div>
      </div>
    </Modal>
  );
}
