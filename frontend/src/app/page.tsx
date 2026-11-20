"use client";

import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAuth } from "../context/AuthContext";
import Navbar from "../components/Navbar";
import TaskCard from "../components/TaskCard";
import GoalCard from "../components/GoalCard";
import CreateGoalModal from "../components/CreateGoalModal";
import CreateRoadmapModal from "../components/CreateRoadmapModal";
import CreateTaskModal from "../components/CreateTaskModal";
import { goalsApi, roadmapsApi, tasksApi } from "../lib/api";
import type { Goal, Roadmap, Task } from "../types/index";

export default function HomePage() {
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [targetGoalId, setTargetGoalId] = useState<string | undefined>();

  const loadDashboardData = useCallback(async () => {
    try {
      const [goalsRes, roadmapsRes, tasksRes] = await Promise.all([
        goalsApi.getGoals(),
        roadmapsApi.getRoadmaps(),
        tasksApi.getTasks(),
      ]);
      if (goalsRes.success) setGoals(goalsRes.goals);
      if (roadmapsRes.success) setRoadmaps(roadmapsRes.roadmaps);
      if (tasksRes.success) setTasks(tasksRes.tasks);
    } catch (err) {
      console.error("Failed to load dashboard data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) void Promise.resolve().then(loadDashboardData);
  }, [isAuthenticated, loadDashboardData]);

  const handleOpenRoadmapModal = (gId?: string) => {
    setTargetGoalId(gId);
    setIsRoadmapModalOpen(true);
  };

  // If user is not authenticated, show landing page
  if (!authLoading && !isAuthenticated) {
    return (
      <div className="min-h-screen flex flex-col app-shell">
        <Navbar />
        <main className="relative flex-1 flex items-start px-4 sm:px-6 lg:px-8 pt-20 pb-16 overflow-hidden">
          <div className="absolute inset-0 hero-grid pointer-events-none" />
          <div className="relative max-w-7xl mx-auto w-full grid lg:grid-cols-[1.05fr_.95fr] gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold bg-white border border-[#e7e9ee] text-[#555861] shadow-sm mb-7">
                <span className="w-2 h-2 rounded-full bg-[#5b5ce2] shadow-[0_0_0_4px_rgba(91,92,226,.10)]" />
                Personal execution workspace
              </div>
              <h1 className="text-[3.25rem] sm:text-[4.5rem] lg:text-[5.25rem] leading-[0.98] tracking-[-0.065em] font-black text-[#181a20] max-w-3xl">
                Make progress
                <span className="block text-[#5b5ce2]">feel inevitable.</span>
              </h1>
              <p className="mt-7 text-lg leading-8 text-[#686d78] max-w-xl">
                Turn meaningful goals into clear roadmaps, focused milestones, and daily actions you can actually finish.
              </p>
              <div className="mt-9 flex flex-col sm:flex-row gap-3">
                <Link href="/register" className="primary-button px-6 py-3.5 text-sm">
                  Start planning free
                  <span aria-hidden="true">→</span>
                </Link>
                <Link href="/login" className="secondary-button px-6 py-3.5 text-sm">
                  Sign in
                </Link>
              </div>
            </div>

            <div className="relative hidden lg:block">
              <div className="absolute -inset-8 rounded-full bg-[radial-gradient(circle,rgba(91,92,226,.10),transparent_68%)]" />
              <div className="relative surface-card rounded-[28px] p-5 rotate-[1deg] shadow-[0_24px_70px_rgba(32,35,48,.12)]">
                <div className="flex items-center justify-between px-1 pb-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-[#9a9daa]">Today</p>
                    <p className="mt-1 font-bold text-[#252731]">Your focus</p>
                  </div>
                  <span className="text-xs font-bold text-[#5b5ce2] bg-[#efefff] px-3 py-1.5 rounded-full">4 of 6 done</span>
                </div>
                {["Finish project outline", "Review weekly roadmap", "Build landing page"].map((title, i) => (
                  <div key={title} className={`flex items-center gap-3 rounded-2xl px-3 py-3.5 ${i === 1 ? "bg-[#f6f7fa]" : ""}`}>
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${i < 1 ? "border-[#5b5ce2] bg-[#5b5ce2]" : "border-[#d9dce4]"}`}>
                      {i < 1 && <span className="text-white text-[10px]">✓</span>}
                    </div>
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${i < 1 ? "text-[#a1a4ad] line-through" : "text-[#343640]"}`}>{title}</p>
                      <p className="text-[11px] text-[#9a9daa] mt-0.5">{i === 0 ? "25 min" : i === 1 ? "45 min" : "2 hr 30 min"}</p>
                    </div>
                    <span className="text-[10px] font-bold rounded-md px-2 py-1 bg-white text-[#777b87] border border-[#eceef2]">{i === 2 ? "HIGH" : "TODAY"}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  // Dashboard Stats
  const activeGoals = goals.filter((g) => g.status === "active").length;
  const activeRoadmaps = roadmaps.filter((r) => r.status === "active").length;
  const pendingTasks = tasks.filter((t) => t.status !== "completed");
  const completedTasks = tasks.filter((t) => t.status === "completed");

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Welcome & Action Controls */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-5 mb-8">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-[#9a9daa] mb-2">Execution overview</p>
            <h1 className="text-3xl sm:text-[40px] leading-tight font-black tracking-[-0.045em] text-[#20212a]">
              Welcome back, {user?.name?.split(" ")[0] || "User"}
            </h1>
            <p className="text-sm text-[#777b87] mt-2">
              Keep momentum. One meaningful action at a time.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
            >
              + New Goal
            </button>
            {goals.length > 0 && roadmaps.length > 0 && (
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(true)}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                + New Task
              </button>
            )}
          </div>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <div className="surface-card p-5 rounded-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#858996] uppercase tracking-[0.12em]">Active Goals</span>
              <span className="w-8 h-8 rounded-xl bg-[#efefff] text-[#5b5ce2] flex items-center justify-center text-sm">◎</span>
            </div>
            <span className="text-3xl font-black text-[#252731] mt-3 block">{activeGoals}</span>
          </div>

          <div className="surface-card p-5 rounded-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#858996] uppercase tracking-[0.12em]">Roadmaps</span>
              <span className="w-8 h-8 rounded-xl bg-[#f1edff] text-[#7c63d8] flex items-center justify-center text-sm">◇</span>
            </div>
            <span className="text-3xl font-black text-[#252731] mt-3 block">{activeRoadmaps}</span>
          </div>

          <div className="surface-card p-5 rounded-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#858996] uppercase tracking-[0.12em]">Pending</span>
              <span className="w-8 h-8 rounded-xl bg-[#fff4df] text-[#c78a27] flex items-center justify-center text-sm">◷</span>
            </div>
            <span className="text-3xl font-black text-[#252731] mt-3 block">{pendingTasks.length}</span>
          </div>

          <div className="surface-card p-5 rounded-[18px]">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#858996] uppercase tracking-[0.12em]">Completed</span>
              <span className="w-8 h-8 rounded-xl bg-[#eaf8ef] text-[#4e9a67] flex items-center justify-center text-sm">✓</span>
            </div>
            <span className="text-3xl font-black text-[#252731] mt-3 block">{completedTasks.length}</span>
          </div>
        </div>

        {/* Two-Column Grid: Today's Tasks & Goals */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Action Tasks (7 cols) */}
          <div className="lg:col-span-7 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>⚡</span> Action Items
              </h2>
              <Link
                href="/tasks"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All ({tasks.length}) &rarr;
              </Link>
            </div>

            {loading ? (
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <div
                    key={i}
                    className="h-20 rounded-2xl bg-zinc-200 dark:bg-zinc-800/50 animate-pulse"
                  />
                ))}
              </div>
            ) : tasks.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-sm text-zinc-500">No scheduled tasks yet.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {tasks.slice(0, 5).map((task) => (
                  <TaskCard
                    key={task._id}
                    task={task}
                    onTaskUpdated={(updated) =>
                      setTasks(
                        tasks.map((t) => (t._id === updated._id ? updated : t))
                      )
                    }
                    onTaskDeleted={(id) =>
                      setTasks(tasks.filter((t) => t._id !== id))
                    }
                  />
                ))}
              </div>
            )}
          </div>

          {/* Goals & Roadmaps Overview (5 cols) */}
          <div className="lg:col-span-5 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                <span>🎯</span> Active Goals
              </h2>
              <Link
                href="/goals"
                className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
              >
                View All ({goals.length}) &rarr;
              </Link>
            </div>

            {loading ? (
              <div className="space-y-4">
                {[1, 2].map((i) => (
                  <div
                    key={i}
                    className="h-44 rounded-2xl bg-zinc-200 dark:bg-zinc-800/50 animate-pulse"
                  />
                ))}
              </div>
            ) : goals.length === 0 ? (
              <div className="p-8 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 text-center">
                <p className="text-sm text-zinc-500">No goals created yet.</p>
                <button
                  type="button"
                  onClick={() => setIsGoalModalOpen(true)}
                  className="mt-3 px-4 py-2 text-xs font-semibold rounded-xl bg-indigo-600 text-white"
                >
                  Create Your First Goal
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {goals.slice(0, 3).map((goal) => (
                  <GoalCard
                    key={goal._id}
                    goal={goal}
                    roadmaps={roadmaps}
                    onGoalDeleted={(id) =>
                      setGoals(goals.filter((g) => g._id !== id))
                    }
                    onOpenCreateRoadmap={(gId) => handleOpenRoadmapModal(gId)}
                    onRoadmapUpdated={(updatedR) =>
                      setRoadmaps(
                        roadmaps.map((r) =>
                          r._id === updatedR._id ? updatedR : r
                        )
                      )
                    }
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Modals */}
      <CreateGoalModal
        isOpen={isGoalModalOpen}
        onClose={() => setIsGoalModalOpen(false)}
        onGoalCreated={(newGoal) => setGoals([newGoal, ...goals])}
      />

      {isRoadmapModalOpen && (
        <CreateRoadmapModal
          onClose={() => setIsRoadmapModalOpen(false)}
          goals={goals}
          roadmaps={roadmaps}
          initialGoalId={targetGoalId}
          onRoadmapCreated={(newRoadmap) => {
            setRoadmaps([newRoadmap, ...roadmaps]);
            loadDashboardData();
          }}
        />
      )}

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
