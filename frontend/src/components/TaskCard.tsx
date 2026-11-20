"use client";

import React, { useState } from "react";
import type { Task } from "../types/index";
import { tasksApi } from "../lib/api";

interface TaskCardProps {
  task: Task;
  onTaskUpdated?: (updated: Task) => void;
  onTaskDeleted?: (id: string) => void;
}

export default function TaskCard({
  task,
  onTaskUpdated,
  onTaskDeleted,
}: TaskCardProps) {
  const [loading, setLoading] = useState(false);

  const isCompleted = task.status === "completed";

  const handleToggleStatus = async () => {
    setLoading(true);
    try {
      const newStatus = isCompleted ? "pending" : "completed";
      const res = await tasksApi.updateTask(task._id, { status: newStatus });
      if (res.success && res.task) {
        onTaskUpdated?.(res.task);
      }
    } catch (err) {
      console.error("Failed to toggle task status:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${task.title}"?`)) return;
    setLoading(true);
    try {
      const res = await tasksApi.deleteTask(task._id);
      if (res.success) {
        onTaskDeleted?.(task._id);
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    } finally {
      setLoading(false);
    }
  };

  const priorityColors = {
    low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
    medium: "bg-blue-100 text-blue-700 dark:bg-blue-950/60 dark:text-blue-300",
    high: "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300",
    critical: "bg-red-100 text-red-800 dark:bg-red-950/60 dark:text-red-300",
  };

  const goalTitle =
    typeof task.goalId === "object" ? task.goalId.title : undefined;
  const roadmapTitle =
    typeof task.roadmapId === "object" ? task.roadmapId.title : undefined;

  const dateString = new Date(task.scheduledDate).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <div
      className={`group p-4 rounded-[16px] border transition-all ${
        isCompleted
          ? "bg-[#f8f9fa] border-[#eceef2] opacity-70"
          : "bg-white border-[#e8eaef] shadow-[0_4px_16px_rgba(30,32,42,.025)] hover:border-[#dcdee6] hover:shadow-[0_10px_24px_rgba(30,32,42,.055)]"
      }`}
    >
      <div className="flex items-start gap-3">
        {/* Completion checkbox */}
        <button
          type="button"
          disabled={loading}
          onClick={handleToggleStatus}
          className={`mt-1 w-5 h-5 rounded-lg border flex items-center justify-center transition-colors ${
            isCompleted
              ? "bg-indigo-600 border-indigo-600 text-white"
              : "border-zinc-300 dark:border-zinc-700 hover:border-indigo-500 bg-white dark:bg-zinc-800"
          }`}
        >
          {isCompleted && (
            <svg
              className="w-3.5 h-3.5"
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

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h3
              className={`text-sm font-semibold truncate ${
                isCompleted
                  ? "line-through text-zinc-400 dark:text-zinc-500"
                  : "text-zinc-900 dark:text-zinc-100"
              }`}
            >
              {task.title}
            </h3>

            {/* Delete button */}
            <button
              type="button"
              onClick={handleDelete}
              disabled={loading}
              className="text-zinc-400 hover:text-red-500 transition-colors text-xs font-bold p-1"
              title="Delete task"
            >
              &times;
            </button>
          </div>

          {task.description && (
            <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1 line-clamp-2">
              {task.description}
            </p>
          )}

          {/* Badges / metadata */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5">
            <span
              className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider ${
                priorityColors[task.priority] || priorityColors.medium
              }`}
            >
              {task.priority}
            </span>

            {task.isEssential && (
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-950/60 dark:text-purple-300 uppercase tracking-wider">
                Essential
              </span>
            )}

            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
              <span>📅</span> {dateString}
            </span>

            <span className="text-xs text-zinc-500 dark:text-zinc-400 flex items-center gap-1 font-medium">
              <span>⏱️</span> {task.estimatedMinutes}m
            </span>

            {goalTitle && (
              <span className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 truncate max-w-[140px] bg-indigo-50 dark:bg-indigo-950/50 px-2 py-0.5 rounded-md">
                🎯 {goalTitle}
              </span>
            )}

            {roadmapTitle && (
              <span className="text-[11px] font-medium text-emerald-600 dark:text-emerald-400 truncate max-w-[140px] bg-emerald-50 dark:bg-emerald-950/50 px-2 py-0.5 rounded-md">
                🗺️ {roadmapTitle}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
