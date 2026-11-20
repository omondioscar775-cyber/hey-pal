export interface User {
  id: string;
  name: string;
  email: string;
  createdAt?: string;
}

export type GoalStatus = "active" | "completed" | "paused" | "archived";

export interface Goal {
  _id: string;
  userId: string;
  title: string;
  description?: string;
  category: string;
  targetDate?: string;
  currentState: string;
  desiredOutcome: string;
  weeklyAvailableHours: number;
  status: GoalStatus;
  createdAt: string;
  updatedAt: string;
}

export interface Milestone {
  _id?: string;
  title: string;
  description?: string;
  targetDate?: string;
  completed: boolean;
}

export type RoadmapStatus = "active" | "superseded" | "completed";

export interface Roadmap {
  _id: string;
  userId: string;
  goalId: string | { _id: string; title: string; category: string; status: string };
  version: number;
  title: string;
  milestones: Milestone[];
  status: RoadmapStatus;
  createdAt: string;
  updatedAt: string;
}

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "pending" | "in_progress" | "completed" | "missed" | "cancelled";

export interface Task {
  _id: string;
  userId: string;
  goalId: string | { _id: string; title: string; category: string; status: string };
  roadmapId: string | { _id: string; title: string; version: number; status: string };
  title: string;
  description?: string;
  scheduledDate: string;
  estimatedMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  isEssential: boolean;
  dependsOn: Array<{ _id: string; title: string; status: string; scheduledDate?: string } | string>;
  completedAt?: string;
  createdAt: string;
  updatedAt: string;
}
