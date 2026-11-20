"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { goalsApi, roadmapsApi, tasksApi } from "../lib/api";
import { relatedId } from "../lib/planning";
import type { Goal, Roadmap, Task } from "../types";
import { AppShell, ErrorState, LoadingSkeleton } from "./AppShell";

export type WorkspaceRecords = {
  goals: Goal[];
  roadmaps: Roadmap[];
  tasks: Task[];
};
export function WorkspaceData({
  title,
  children,
}: {
  title: string;
  children: (records: WorkspaceRecords, reload: () => void) => ReactNode;
}) {
  return (
    <AppShell title={title}>
      <Records>{children}</Records>
    </AppShell>
  );
}

function Records({
  children,
}: {
  children: (records: WorkspaceRecords, reload: () => void) => ReactNode;
}) {
  const [records, setRecords] = useState<WorkspaceRecords>();
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => {
    setError("");
    setRevision((value) => value + 1);
  }, []);
  useEffect(() => {
    let cancelled = false;
    void Promise.all([
      goalsApi.getGoals(),
      roadmapsApi.getRoadmaps(),
      tasksApi.getTasks(),
    ])
      .then(([{ goals }, { roadmaps }, { tasks }]) => {
        if (cancelled) return;
        const ids = new Set(goals.map((goal) => goal._id));
        const ownedRoadmaps = roadmaps.filter((item) =>
          ids.has(relatedId(item.goalId)),
        );
        const roadmapIds = new Set(ownedRoadmaps.map((item) => item._id));
        setRecords({
          goals,
          roadmaps: ownedRoadmaps,
          tasks: tasks.filter(
            (item) =>
              ids.has(relatedId(item.goalId)) &&
              roadmapIds.has(relatedId(item.roadmapId)),
          ),
        });
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your workspace.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [revision]);
  return (
    <>
      {error && <ErrorState message={error} retry={reload} />}
      {records ? children(records, reload) : !error && <LoadingSkeleton />}
    </>
  );
}
