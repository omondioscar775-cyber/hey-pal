"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";
import GoalCard from "../../components/GoalCard";
import CreateGoalModal from "../../components/CreateGoalModal";
import CreateRoadmapModal from "../../components/CreateRoadmapModal";
import { goalsApi, roadmapsApi } from "../../lib/api";
import type { Goal, Roadmap } from "../../types/index";

export default function GoalsPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const router = useRouter();

  const [goals, setGoals] = useState<Goal[]>([]);
  const [roadmaps, setRoadmaps] = useState<Roadmap[]>([]);
  const [loading, setLoading] = useState(true);
  const [isGoalModalOpen, setIsGoalModalOpen] = useState(false);
  const [isRoadmapModalOpen, setIsRoadmapModalOpen] = useState(false);
  const [targetGoalIdForRoadmap, setTargetGoalIdForRoadmap] = useState<string | undefined>();

  const loadData = useCallback(async () => {
    try {
      const [goalsRes, roadmapsRes] = await Promise.all([
        goalsApi.getGoals(),
        roadmapsApi.getRoadmaps(),
      ]);
      if (goalsRes.success) setGoals(goalsRes.goals);
      if (roadmapsRes.success) setRoadmaps(roadmapsRes.roadmaps);
    } catch (err) {
      console.error("Failed to load goals/roadmaps:", err);
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

  const handleOpenCreateRoadmap = (goalId?: string) => {
    setTargetGoalIdForRoadmap(goalId);
    setIsRoadmapModalOpen(true);
  };

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-zinc-100">
              Goals & Roadmaps
            </h1>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 mt-1">
              Define your core ambitions and structured path to achieving them
            </p>
          </div>

          <div className="flex items-center gap-3">
            {goals.length > 0 && (
              <button
                type="button"
                onClick={() => handleOpenCreateRoadmap()}
                className="px-4 py-2 text-sm font-semibold rounded-xl border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-800 dark:text-zinc-200 transition-colors"
              >
                + New Roadmap
              </button>
            )}
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(true)}
              className="px-4 py-2 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
            >
              + New Goal
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {[1, 2].map((i) => (
              <div
                key={i}
                className="h-64 rounded-2xl bg-zinc-200 dark:bg-zinc-800/50 animate-pulse"
              />
            ))}
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center py-16 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8">
            <div className="w-12 h-12 rounded-2xl bg-indigo-50 dark:bg-indigo-950/50 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-2xl mx-auto mb-4">
              🎯
            </div>
            <h3 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
              No goals created yet
            </h3>
            <p className="text-sm text-zinc-500 dark:text-zinc-400 max-w-sm mx-auto mt-1 mb-6">
              Create your first major goal to start generating roadmaps and daily execution tasks.
            </p>
            <button
              type="button"
              onClick={() => setIsGoalModalOpen(true)}
              className="px-5 py-2.5 text-sm font-semibold rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
            >
              Create Your First Goal
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {goals.map((goal) => (
              <GoalCard
                key={goal._id}
                goal={goal}
                roadmaps={roadmaps}
                onGoalDeleted={(id) => setGoals(goals.filter((g) => g._id !== id))}
                onOpenCreateRoadmap={(gId) => handleOpenCreateRoadmap(gId)}
                onRoadmapUpdated={(updatedR) =>
                  setRoadmaps(
                    roadmaps.map((r) => (r._id === updatedR._id ? updatedR : r))
                  )
                }
              />
            ))}
          </div>
        )}
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
          initialGoalId={targetGoalIdForRoadmap}
          onRoadmapCreated={(newRoadmap) => {
            setRoadmaps([newRoadmap, ...roadmaps]);
            loadData();
          }}
        />
      )}
    </div>
  );
}
