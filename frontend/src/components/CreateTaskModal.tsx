"use client";

import React, { useState } from "react";
import { tasksApi } from "../lib/api";
import type { Goal, Roadmap, Task, TaskPriority } from "../types/index";

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  goals: Goal[];
  roadmaps: Roadmap[];
  initialGoalId?: string;
  initialRoadmapId?: string;
  onTaskCreated: (task: Task) => void;
}

export default function CreateTaskModal({
  isOpen,
  onClose,
  goals,
  roadmaps,
  initialGoalId,
  initialRoadmapId,
  onTaskCreated,
}: CreateTaskModalProps) {
  const [selectedGoalId, setSelectedGoalId] = useState(
    initialGoalId || (goals[0]?._id ?? "")
  );

  // Filter roadmaps for the selected goal
  const availableRoadmaps = roadmaps.filter((r) => {
    const gId = typeof r.goalId === "object" ? r.goalId._id : r.goalId;
    return gId === selectedGoalId;
  });

  const [selectedRoadmapId, setSelectedRoadmapId] = useState(
    initialRoadmapId || (availableRoadmaps[0]?._id ?? "")
  );

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");

  React.useEffect(() => {
    void Promise.resolve().then(() =>
      setScheduledDate(new Date().toISOString().split("T")[0])
    );
  }, []);
  const [estimatedMinutes, setEstimatedMinutes] = useState(60);
  const [priority, setPriority] = useState<TaskPriority>("medium");
  const [isEssential, setIsEssential] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const effectiveRoadmapId = availableRoadmaps.some(
    (roadmap) => roadmap._id === selectedRoadmapId
  )
    ? selectedRoadmapId
    : (availableRoadmaps[0]?._id ?? "");

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalId || !effectiveRoadmapId) {
      setError("Please select both a goal and an active roadmap.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await tasksApi.createTask({
        goalId: selectedGoalId,
        roadmapId: effectiveRoadmapId,
        title,
        description: description || undefined,
        scheduledDate: new Date(scheduledDate).toISOString(),
        estimatedMinutes: Number(estimatedMinutes),
        priority,
        isEssential,
      });

      if (res.success && res.task) {
        onTaskCreated(res.task);
        onClose();
        setTitle("");
        setDescription("");
        setEstimatedMinutes(60);
        setIsEssential(false);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create task.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Create Actionable Task
          </h2>
          <button
            onClick={onClose}
            className="text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200 text-xl font-bold"
          >
            &times;
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-sm rounded-lg bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Goal *
              </label>
              <select
                value={selectedGoalId}
                onChange={(e) => setSelectedGoalId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {goals.map((g) => (
                  <option key={g._id} value={g._id}>
                    {g.title}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Roadmap *
              </label>
              <select
                value={effectiveRoadmapId}
                onChange={(e) => setSelectedRoadmapId(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                {availableRoadmaps.length > 0 ? (
                  availableRoadmaps.map((r) => (
                    <option key={r._id} value={r._id}>
                      {r.title} (v{r.version})
                    </option>
                  ))
                ) : (
                  <option value="">No roadmaps for this goal</option>
                )}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Task Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Design user flow diagrams for checkout"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Date *
              </label>
              <input
                type="date"
                required
                value={scheduledDate}
                onChange={(e) => setScheduledDate(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Minutes *
              </label>
              <input
                type="number"
                min="5"
                max="720"
                step="5"
                required
                value={estimatedMinutes}
                onChange={(e) => setEstimatedMinutes(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="critical">Critical</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Key notes, links, or instructions..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="flex items-center gap-2">
            <input
              type="checkbox"
              id="isEssential"
              checked={isEssential}
              onChange={(e) => setIsEssential(e.target.checked)}
              className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-zinc-300"
            />
            <label htmlFor="isEssential" className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Mark as Essential (Critical for roadmap progression)
            </label>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-zinc-200 dark:border-zinc-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium rounded-xl text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !effectiveRoadmapId}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Task"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
