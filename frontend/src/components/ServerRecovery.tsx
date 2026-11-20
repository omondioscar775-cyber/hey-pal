"use client";

import { useState } from "react";
import { apiRequest } from "../lib/api";
import type { Task } from "../types";
import { ErrorState } from "./AppShell";
import { Modal } from "./Modal";

type Proposal = {
  _id: string;
  optionType: "protect_deadline" | "redistribute" | "revise_milestone";
  feasibility: "feasible" | "infeasible";
  explanation: string;
  expiresAt: string;
  changes: Array<{ taskId: string; startAt: string; endAt: string }>;
  deferredTaskIds: string[];
  milestoneTarget?: string;
};
type Options = { recoveryCase: { _id: string }; proposals: Proposal[] };

const names = {
  protect_deadline: "Protect the Deadline",
  redistribute: "Redistribute Work",
  revise_milestone: "Revise the Milestone",
};

export function ServerRecovery({
  goalId,
  tasks,
  reload,
}: {
  goalId: string;
  tasks: Task[];
  reload: () => void;
}) {
  const [options, setOptions] = useState<Options>();
  const [selected, select] = useState<Proposal>();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function generate() {
    setPending(true);
    setError("");

    try {
      setOptions(
        await apiRequest<Options>("/recovery/cases", {
          method: "POST",
          body: JSON.stringify({ goalId }),
        }),
      );
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Recovery options could not be generated.",
      );
    } finally {
      setPending(false);
    }
  }

  async function approve() {
    if (!options || !selected) return;
    setPending(true);
    setError("");
    try {
      await apiRequest(
        "/recovery/cases/" + options.recoveryCase._id + "/approve",
        {
          method: "POST",
          body: JSON.stringify({ proposalId: selected._id }),
        },
      );
      select(undefined);
      setOptions(undefined);

      reload();
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Recovery could not be applied.",
      );
    } finally {
      setPending(false);
    }
  }

  const title = (id: string) =>
    tasks.find((task) => task._id === id)?.title ?? "Scheduled task";
  return (
    <section className="card stack">
      <div className="row">
        <div>
          <h2>Generate a recovery plan</h2>
          <p>
            Use verified availability and reservations to schedule missed work.
          </p>
        </div>
        <button
          className="button"
          onClick={() => void generate()}
          disabled={pending}
        >
          {pending ? "Working…" : "Generate options"}
        </button>
      </div>
      {error && !selected && <ErrorState message={error} />}

      {options && (
        <div className="grid-cards">
          {options.proposals.map((item) => (
            <article className="card stack" key={item._id}>
              <h3>{names[item.optionType]}</h3>
              <p>{item.explanation}</p>
              <span className="badge">{item.feasibility}</span>
              <button
                className="button secondary"
                onClick={() => {
                  setError("");
                  select(item);
                }}
              >
                Review {names[item.optionType]}
              </button>
            </article>
          ))}
        </div>
      )}
      {selected && (
        <Modal
          label={names[selected.optionType]}
          pending={pending}
          onClose={() => select(undefined)}
        >
          <div className="card stack">
            <h2>{names[selected.optionType]}</h2>
            <p>{selected.explanation}</p>
            {selected.changes.map((change) => (
              <p key={change.taskId}>
                <strong>{title(change.taskId)}</strong> ·{" "}
                {new Date(change.startAt).toLocaleString()} to{" "}
                {new Date(change.endAt).toLocaleString()}
              </p>
            ))}
            {selected.deferredTaskIds.length > 0 && (
              <p>
                Outside this recovery plan ·{" "}
                {selected.deferredTaskIds.map(title).join(", ")}
              </p>
            )}
            {selected.milestoneTarget && (
              <p>
                New milestone target ·{" "}
                {new Date(selected.milestoneTarget).toLocaleString()}
              </p>
            )}
            {error && <ErrorState message={error} />}
            <div className="actions">
              <button
                className="button secondary"
                onClick={() => select(undefined)}
                disabled={pending}
              >
                Close
              </button>
              <button
                className="button"
                onClick={() => void approve()}
                disabled={
                  pending ||
                  selected.feasibility !== "feasible" ||
                  new Date(selected.expiresAt) <= new Date()
                }
              >
                Apply recovery plan
              </button>
            </div>
          </div>
        </Modal>
      )}
    </section>
  );
}
