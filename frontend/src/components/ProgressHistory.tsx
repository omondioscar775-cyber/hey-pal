"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "../lib/api";
import { minutes, weekRange } from "../lib/planning";
import { ErrorState } from "./AppShell";

type Summary = {
  focusSeconds: number;
  plannedMinutes: number;
  recoveryOutcomes: Array<{ _id: string; count: number }>;
};

export function ProgressHistory() {
  const [week] = useState(() => weekRange()[0]);
  const [summary, setSummary] = useState<Summary>();
  const [error, setError] = useState("");
  useEffect(() => {
    let cancelled = false;
    void apiRequest<Summary>("/progress/summary?weekStart=" + week)
      .then((value) => {
        if (!cancelled) setSummary(value);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load progress history.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [week]);

  if (error) return <ErrorState message={error} />;
  if (!summary) return <p role="status">Loading recorded activity…</p>;
  const approved =
    summary.recoveryOutcomes.find((item) => item._id === "approved")?.count ??
    0;
  return (
    <dl className="stack">
      <div>
        <dt>Reserved work time</dt>
        <dd>{minutes(Math.round(summary.plannedMinutes))}</dd>
      </div>
      <div>
        <dt>Recorded focus time</dt>
        <dd>
          {minutes(Math.floor(summary.focusSeconds / 60))}{" "}
          {summary.focusSeconds % 60} sec
        </dd>
      </div>
      <div>
        <dt>Approved recovery cases opened this week</dt>
        <dd>{approved}</dd>
      </div>
    </dl>
  );
}
