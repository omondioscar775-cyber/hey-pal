"use client";

import React, { useState } from "react";
import { Modal } from "./Modal";
import { roadmapsApi } from "../lib/api";
import type { Goal, Roadmap } from "../types/index";
import { generateRoadmapDraft } from "../lib/roadmapGenerator";

interface CreateRoadmapModalProps {
  onClose: () => void;
  goals: Goal[];
  roadmaps: Roadmap[];
  initialGoalId?: string;
  onRoadmapCreated: (roadmap: Roadmap) => void;
}

export default function CreateRoadmapModal({
  onClose,
  goals,
  roadmaps,
  initialGoalId,
  onRoadmapCreated,
}: CreateRoadmapModalProps) {
  const initialGoal =
    goals.find((goal) => goal._id === initialGoalId) ?? goals[0];
  const initialDraft = initialGoal
    ? generateRoadmapDraft(initialGoal)
    : { title: "", milestones: [] };
  const [goalId, setGoalId] = useState(initialGoal?._id ?? "");
  const [title, setTitle] = useState(initialDraft.title);
  const [milestones, setMilestones] = useState(initialDraft.milestones);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedGoal = goals.find((goal) => goal._id === goalId);
  const activeRoadmap = roadmaps.find((roadmap) => {
    const associatedGoalId =
      typeof roadmap.goalId === "object" ? roadmap.goalId._id : roadmap.goalId;
    return associatedGoalId === goalId && roadmap.status === "active";
  });

  const handleGoalChange = (nextGoalId: string) => {
    const nextGoal = goals.find((goal) => goal._id === nextGoalId);
    if (!nextGoal) return;

    const nextDraft = generateRoadmapDraft(nextGoal);
    setGoalId(nextGoalId);
    setTitle(nextDraft.title);
    setMilestones(nextDraft.milestones);
    setError(null);
  };

  const handleAddMilestone = () => {
    setMilestones([
      ...milestones,
      { title: "", description: "", completed: false },
    ]);
  };

  const handleRemoveMilestone = (index: number) => {
    setMilestones(milestones.filter((_, i) => i !== index));
  };

  const handleMilestoneChange = (
    index: number,
    field: "title" | "description" | "targetDate",
    val: string,
  ) => {
    setMilestones(
      milestones.map((milestone, milestoneIndex) =>
        milestoneIndex === index ? { ...milestone, [field]: val } : milestone,
      ),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalId || !title.trim()) {
      setError("Select a goal and provide a roadmap title.");
      return;
    }
    setLoading(true);
    setError(null);

    try {
      const formattedMilestones = milestones
        .filter((m) => m.title.trim().length > 0)
        .map((m) => ({
          title: m.title.trim(),
          description: m.description?.trim() || undefined,
          targetDate: m.targetDate || undefined,
          completed: false,
        }));

      const res = await roadmapsApi.createRoadmap({
        goalId,
        title,
        milestones: formattedMilestones,
        status: "active",
      });

      if (res.success && res.roadmap) {
        onRoadmapCreated(res.roadmap);
        onClose();
      }
    } catch (err: unknown) {
      setError(
        err instanceof Error ? err.message : "Failed to create roadmap.",
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal label="Review your roadmap" pending={loading} onClose={onClose}>
      <div className="bg-white  border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-xl shadow-xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Review your roadmap
          </h2>
          <button
            onClick={onClose}
            disabled={loading}
            aria-label="Close dialog"
            className="text-zinc-500 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 overflow-y-auto flex-1"
        >
          {error && (
            <div
              role="alert"
              className="p-3 text-sm rounded-lg bg-red-50 text-red-700 border border-red-200 dark:border-red-900"
            >
              {error}
            </div>
          )}

          <div>
            <label
              htmlFor="CreateRoadmapModal-field-1"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Associated Goal *
            </label>
            <select
              id="CreateRoadmapModal-field-1"
              value={goalId}
              onChange={(e) => handleGoalChange(e.target.value)}
              required
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            >
              {goals.map((g) => (
                <option key={g._id} value={g._id}>
                  {g.title} ({g.category})
                </option>
              ))}
            </select>
          </div>

          <div className="rounded-xl border border-indigo-100 bg-indigo-50/70 px-4 py-3">
            <p className="text-sm font-semibold text-indigo-950">
              Generated from your goal
            </p>
            <p className="mt-1 text-xs leading-5 text-indigo-900">
              This draft uses your current state, desired outcome, category, and
              weekly availability. Review and edit the milestones before
              approving it.
            </p>
            {selectedGoal?.targetDate && (
              <p className="mt-1 text-xs font-medium text-indigo-900">
                Target date: {selectedGoal.targetDate.split("T")[0]}
              </p>
            )}
          </div>
          {selectedGoal?.targetDate &&
            milestones.some(
              (milestone) =>
                milestone.targetDate &&
                milestone.targetDate.slice(0, 10) >
                  selectedGoal.targetDate!.slice(0, 10),
            ) && (
              <p className="notice warning" role="status">
                At least one milestone is scheduled after the goal’s target
                date.
              </p>
            )}
          {activeRoadmap && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-900">
              Approving this roadmap will replace version{" "}
              {activeRoadmap.version} ({activeRoadmap.title}) as the active
              plan. The previous version will remain in your roadmap history.
            </p>
          )}

          <div>
            <label
              htmlFor="CreateRoadmapModal-field-2"
              className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1"
            >
              Roadmap Title *
            </label>
            <input
              id="CreateRoadmapModal-field-2"
              type="text"
              required
              placeholder="e.g. 6-Month Master Plan"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider">
                Milestones / Stages
              </label>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    if (!selectedGoal) return;
                    const regenerated = generateRoadmapDraft(selectedGoal);
                    setTitle(regenerated.title);
                    setMilestones(regenerated.milestones);
                  }}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  Regenerate draft
                </button>
                <button
                  type="button"
                  onClick={handleAddMilestone}
                  className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
                >
                  + Add milestone
                </button>
              </div>
            </div>

            <div className="space-y-3">
              {milestones.map((m, idx) => (
                <div
                  key={idx}
                  className="p-3 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50/50 /30 space-y-2 relative"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-zinc-500">
                      Step {idx + 1}
                    </span>
                    {milestones.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMilestone(idx)}
                        className="text-xs text-red-500 hover:text-red-700 font-medium"
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    required
                    aria-label={`Milestone ${idx + 1} title`}
                    placeholder="Milestone title"
                    value={m.title}
                    onChange={(e) =>
                      handleMilestoneChange(idx, "title", e.target.value)
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white  text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <input
                    type="text"
                    aria-label={`Milestone ${idx + 1} description`}
                    placeholder="Description / deliverables (optional)"
                    value={m.description}
                    onChange={(e) =>
                      handleMilestoneChange(idx, "description", e.target.value)
                    }
                    className="w-full px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white  text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <label className="block text-sm text-zinc-700">
                    Milestone target date
                    <input
                      className="mt-1 block rounded-lg border border-zinc-300 px-2 py-1"
                      type="date"
                      value={m.targetDate?.slice(0, 10) ?? ""}
                      onChange={(event) =>
                        handleMilestoneChange(
                          idx,
                          "targetDate",
                          event.target.value,
                        )
                      }
                    />
                  </label>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-4 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !goalId || !title.trim()}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {loading
                ? "Activating..."
                : activeRoadmap
                  ? "Approve & Replace Active Roadmap"
                  : "Approve & Activate Roadmap"}
            </button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
