"use client";

import React, { useState } from "react";
import { goalsApi } from "../lib/api";
import type { Goal } from "../types/index";

interface CreateGoalModalProps {
  isOpen: boolean;
  onClose: () => void;
  onGoalCreated: (goal: Goal) => void;
}

export default function CreateGoalModal({
  isOpen,
  onClose,
  onGoalCreated,
}: CreateGoalModalProps) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("Career");
  const [description, setDescription] = useState("");
  const [currentState, setCurrentState] = useState("");
  const [desiredOutcome, setDesiredOutcome] = useState("");
  const [weeklyAvailableHours, setWeeklyAvailableHours] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const res = await goalsApi.createGoal({
        title,
        category,
        description: description || undefined,
        currentState,
        desiredOutcome,
        weeklyAvailableHours: Number(weeklyAvailableHours),
      });

      if (res.success && res.goal) {
        onGoalCreated(res.goal);
        onClose();
        // reset form
        setTitle("");
        setDescription("");
        setCurrentState("");
        setDesiredOutcome("");
        setWeeklyAvailableHours(10);
      }
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to create goal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl w-full max-w-lg shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
            Create New Goal
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

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Goal Title *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Become a Professional UI/UX Designer"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Category *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              >
                <option value="Career">Career</option>
                <option value="Skills">Skills & Learning</option>
                <option value="Health">Health & Fitness</option>
                <option value="Finance">Finance</option>
                <option value="Personal">Personal Development</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
                Weekly Hours *
              </label>
              <input
                type="number"
                min="1"
                max="168"
                required
                value={weeklyAvailableHours}
                onChange={(e) => setWeeklyAvailableHours(Number(e.target.value))}
                className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Current State *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Beginner with basic Figma knowledge"
              value={currentState}
              onChange={(e) => setCurrentState(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Desired Outcome *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Job-ready with a 3-project portfolio"
              value={desiredOutcome}
              onChange={(e) => setDesiredOutcome(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-zinc-700 dark:text-zinc-300 uppercase tracking-wider mb-1">
              Description (Optional)
            </label>
            <textarea
              rows={2}
              placeholder="Brief details about what you want to achieve..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800/50 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
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
              disabled={loading}
              className="px-5 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Creating..." : "Create Goal"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
