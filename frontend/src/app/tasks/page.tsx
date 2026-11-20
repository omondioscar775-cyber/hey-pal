"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import TaskCard from "../../components/TaskCard";
import CreateTaskModal from "../../components/CreateTaskModal";
import { tasksApi, goalsApi, roadmapsApi } from "../../lib/api";
import type { Task, Goal, Roadmap } from "../../types/index";

export default function TasksPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [tasks, setTasks] = useState<Task[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [priorityFilter, setPriorityFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [tasksRes, goalsRes, roadmapsRes] = await Promise.all([
        tasksApi.getTasks(),
        goalsApi.getGoals(),
        roadmapsApi.getRoadmaps(),
      ]);
      if (tasksRes.success) setTasks(tasksRes.tasks);
      if (goalsRes.success) setGoals(goalsRes.goals);
      if (roadmapsRes.success) setRoadmaps(roadmapsRes.roadmaps);
    } catch (err) {
      console.error("Failed to load tasks data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (isAuthenticated) {
      void Promise.resolve().then(loadData);
    }
  }, [authLoading, isAuthenticated, router, loadData]);

  // Client-side filtering
  const filteredTasks = tasks.filter((task) => {
    if (statusFilter !== "all" && task.status !== statusFilter) return false;
    if (priorityFilter !== "all" && task.priority !== priorityFilter) return false;
    if (searchQuery.trim().length > 0) {
      const query = searchQuery.toLowerCase();
      const matchTitle = task.title.toLowerCase().includes(query);
      const matchDesc = task.description?.toLowerCase().includes(query) ?? false;
      if (!matchTitle && !matchDesc) return false;
    }
    return true;
  });

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Tasks & Daily Execution
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Organize, track, and complete your scheduled milestones
            </p>
          </div>

          <button
            type="button"
            onClick={() => setIsTaskModalOpen(true)}
            disabled={goals.length === 0 || roadmaps.length === 0}
            className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors disabled:opacity-50"
          >
            + New Task
          </button>
        </div>

        {/* Filters & Search */}
        <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-4 mb-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
          {/* Status Tabs */}
          <div className="flex items-center gap-1 overflow-x-auto pb-1 md:pb-0">
            {["all", "pending", "completed"].map((tab) => (
              <button
                key={tab}
                onClick={() => setStatusFilter(tab)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                  statusFilter === tab
                    ? "bg-indigo-600 text-white"
                    : "text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Search and Priority Filter */}
          <div className="flex items-center gap-3">
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Priorities</option>
              <option value="low">Low Priority</option>
              <option value="medium">Medium Priority</option>
              <option value="high">High Priority</option>
              <option value="critical">Critical</option>
            </select>

            <input
              type="text"
              placeholder="Search tasks..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="px-3 py-1.5 rounded-xl border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-900 dark:text-zinc-100 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-500 w-44"
            />
          </div>
        </div>

        {/* Tasks List */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-24 rounded-2xl bg-zinc-200 dark:bg-zinc-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : filteredTasks.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl mx-auto mb-4">
              📝
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No tasks found
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
              {tasks.length === 0
                ? "You haven't scheduled any tasks yet. Create one to start taking daily action."
                : "No tasks matched your current filter criteria."}
            </p>
            {tasks.length === 0 && goals.length > 0 && roadmaps.length > 0 && (
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
              >
                Create Your First Task
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            {filteredTasks.map((task) => (
              <TaskCard
                key={task._id}
                task={task}
                onTaskUpdated={(updated) =>
                  setTasks(tasks.map((t) => (t._id === updated._id ? updated : t)))
                }
                onTaskDeleted={(id) =>
                  setTasks(tasks.filter((t) => t._id !== id))
                }
              />
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      <CreateTaskModal
        isOpen={isTaskModalOpen}
        onClose={() => setIsTaskModalOpen(false)}
        goals={goals}
        roadmaps={roadmaps}
        onTaskCreated={(newTask) => setTasks([newTask, ...tasks])}
      />
    </div>
  );
}
