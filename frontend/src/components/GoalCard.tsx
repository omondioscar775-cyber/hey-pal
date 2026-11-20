"use client";

import React, { useState } from "react";
import type { Goal, Roadmap } from "../types/index";
import { roadmapsApi, goalsApi } from "../lib/api";

interface GoalCardProps {
  goal: Goal;
  roadmaps: Roadmap[];
  onGoalUpdated?: (updated: Goal) => void;
  onGoalDeleted?: (id: string) => void;
  onOpenCreateRoadmap?: (goalId: string) => void;
  onRoadmapUpdated?: (updated: Roadmap) => void;
}

export default function GoalCard({
  goal,
  roadmaps,
  onGoalDeleted,
  onOpenCreateRoadmap,
  onRoadmapUpdated,
}: GoalCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(false);

  // Find the active roadmap for this goal
  const activeRoadmap = roadmaps.find((r) => {
    const gId = typeof r.goalId === "object" ? r.goalId._id : r.goalId;
    return gId === goal._id && r.status === "active";
  });

  const handleToggleMilestone = async (
    roadmap: Roadmap,
    milestoneIndex: number
  ) => {
    const updatedMilestones = [...roadmap.milestones];
    updatedMilestones[milestoneIndex] = {
      ...updatedMilestones[milestoneIndex],
      completed: !updatedMilestones[milestoneIndex].completed,
    };

    try {
      const res = await roadmapsApi.updateRoadmap(roadmap._id, {
        milestones: updatedMilestones,
      });
      if (res.success && res.roadmap) {
        onRoadmapUpdated?.(res.roadmap);
      }
    } catch (err) {
      console.error("Failed to update milestone:", err);
    }
  };

  const handleDeleteGoal = async () => {
    if (!confirm(`Are you sure you want to delete goal "${goal.title}"?`))
      return;
    setLoading(true);
    try {
      const res = await goalsApi.deleteGoal(goal._id);
      if (res.success) {
        onGoalDeleted?.(goal._id);
      }
    } catch (err) {
      console.error("Failed to delete goal:", err);
    } finally {
      setLoading(false);
    }
  };

  const completedMilestones =
    activeRoadmap?.milestones.filter((m) => m.completed).length || 0;
  const totalMilestones = activeRoadmap?.milestones.length || 0;
  const progressPercent =
    totalMilestones > 0
      ? Math.round((completedMilestones / totalMilestones) * 100)
      : 0;

  return (
    <div className="bg-white border border-[#e8eaef] rounded-[18px] shadow-[0_8px_24px_rgba(30,32,42,.035)] hover:shadow-[0_14px_32px_rgba(30,32,42,.075)] transition-shadow overflow-hidden">
      {/* Header */}
      <div className="p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-full uppercase tracking-wider bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-300">
                {goal.category}
              </span>
              <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
                ⏳ {goal.weeklyAvailableHours} hrs/week
              </span>
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              {goal.title}
            </h3>
          </div>

          <button
            type="button"
            onClick={handleDeleteGoal}
            disabled={loading}
            className="text-zinc-400 hover:text-red-500 transition-colors p-1 text-sm font-semibold"
            title="Delete goal"
          >
            Delete
          </button>
        </div>

        {goal.description && (
          <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
            {goal.description}
          </p>
        )}

        {/* Current State & Desired Outcome */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
          <div className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-800/40 text-xs">
            <span className="font-semibold text-zinc-500 uppercase tracking-wider block mb-1">
              Current State
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {goal.currentState}
            </span>
          </div>

          <div className="p-3 rounded-xl bg-indigo-50/50 dark:bg-indigo-950/30 text-xs">
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase tracking-wider block mb-1">
              Desired Outcome
            </span>
            <span className="text-zinc-800 dark:text-zinc-200">
              {goal.desiredOutcome}
            </span>
          </div>
        </div>

        {/* Roadmap section preview */}
        {activeRoadmap ? (
          <div className="mt-5 pt-4 border-t border-zinc-100 dark:border-zinc-800/80">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                  🗺️ {activeRoadmap.title}
                </span>
                <span className="text-[10px] bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-400 px-1.5 py-0.5 rounded font-mono">
                  v{activeRoadmap.version}
                </span>
              </div>
              <span className="text-xs font-semibold text-indigo-600 dark:text-indigo-400">
                {progressPercent}% completed ({completedMilestones}/{totalMilestones})
              </span>
            </div>

            {/* Progress bar */}
            <div className="w-full h-2 bg-zinc-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-indigo-600 transition-all duration-300"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            {/* Expand / Collapse Milestones */}
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-3 text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline flex items-center gap-1"
            >
              <span>{expanded ? "Hide Milestones" : "View Milestones"}</span>
              <span>{expanded ? "▲" : "▼"}</span>
            </button>

            {expanded && (
              <div className="mt-3 space-y-2 border-t border-zinc-100 dark:border-zinc-800/80 pt-3">
                {activeRoadmap.milestones.map((m, idx) => (
                  <div
                    key={m._id || idx}
                    className="flex items-start gap-2.5 p-2.5 rounded-xl hover:bg-zinc-50 dark:hover:bg-zinc-800/40 transition-colors"
                  >
                    <button
                      type="button"
                      onClick={() => handleToggleMilestone(activeRoadmap, idx)}
                      className={`mt-0.5 w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                        m.completed
                          ? "bg-emerald-600 border-emerald-600 text-white"
                          : "border-zinc-300 dark:border-zinc-700 hover:border-emerald-500"
                      }`}
                    >
                      {m.completed && (
                        <svg
                          className="w-3 h-3"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={3}
                            d="M5 13l4 4L19 7"
                          />
                        </svg>
                      )}
                    </button>
                    <div className="flex-1">
                      <p
                        className={`text-xs font-semibold ${
                          m.completed
                            ? "line-through text-zinc-400 dark:text-zinc-500"
                            : "text-zinc-800 dark:text-zinc-200"
                        }`}
                      >
                        {m.title}
                      </p>
                      {m.description && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mt-0.5">
                          {m.description}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="mt-4 pt-4 border-t border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <span className="text-xs text-zinc-500">
              No active roadmap linked yet.
            </span>
            <button
              type="button"
              onClick={() => onOpenCreateRoadmap?.(goal._id)}
              className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              + Create Roadmap
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
