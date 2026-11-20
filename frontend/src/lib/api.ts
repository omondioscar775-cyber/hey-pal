import type { User, Goal, Roadmap, Task } from "../types/index";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const response = await fetch("/api/circleup" + endpoint, {
    ...options,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...options.headers },
  });
  const data = await response.json().catch(() => null);
  if (!response.ok || !data || data.success !== true) {
    const fields = data?.errors
      ? Object.values(data.errors).flat().join(" ")
      : "";
    if (response.status === 401 && !endpoint.startsWith("/auth/")) {
      window.dispatchEvent(new Event("circleup:expired"));
    }
    throw new ApiError(
      fields || data?.message || "The server returned an unexpected response.",
      response.status,
    );
  }
  return data as T;
}

export const authApi = {
  login: (email: string, password: string) =>
    apiRequest<{ user: User }>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),
  register: (name: string, email: string, password: string) =>
    apiRequest<{ user: User }>("/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    }),
  getMe: () => apiRequest<{ user: User }>("/auth/me"),
  logout: () => apiRequest("/auth/logout", { method: "POST" }),
};
// ----------------- Goals API -----------------
export const goalsApi = {
  getGoals: async () => {
    return apiRequest<{ success: boolean; count: number; goals: Goal[] }>(
      "/goals",
    );
  },

  getGoalById: async (id: string) => {
    return apiRequest<{ success: boolean; goal: Goal }>(`/goals/${id}`);
  },

  createGoal: async (goalData: {
    title: string;
    description?: string;
    category: string;
    targetDate?: string;
    currentState: string;
    desiredOutcome: string;
    weeklyAvailableHours: number;
  }) => {
    return apiRequest<{ success: boolean; message: string; goal: Goal }>(
      "/goals",
      {
        method: "POST",
        body: JSON.stringify(goalData),
      },
    );
  },

  updateGoal: async (id: string, updates: Partial<Goal>) => {
    return apiRequest<{ success: boolean; message: string; goal: Goal }>(
      `/goals/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  },

  deleteGoal: async (id: string) => {
    return apiRequest<{ success: boolean; message: string }>(`/goals/${id}`, {
      method: "DELETE",
    });
  },
};

// ----------------- Roadmaps API -----------------
export const roadmapsApi = {
  getRoadmaps: async (params?: { goalId?: string; status?: string }) => {
    const query = new URLSearchParams();
    if (params?.goalId) query.append("goalId", params.goalId);
    if (params?.status) query.append("status", params.status);
    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{ success: boolean; count: number; roadmaps: Roadmap[] }>(
      `/roadmaps${qs}`,
    );
  },

  getRoadmapById: async (id: string) => {
    return apiRequest<{ success: boolean; roadmap: Roadmap }>(
      `/roadmaps/${id}`,
    );
  },

  createRoadmap: async (data: {
    goalId: string;
    title: string;
    milestones?: Array<{
      title: string;
      description?: string;
      targetDate?: string;
      completed?: boolean;
    }>;
    status?: "draft" | "active" | "superseded" | "completed";
  }) => {
    return apiRequest<{ success: boolean; message: string; roadmap: Roadmap }>(
      "/roadmaps",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  approveRoadmap: (roadmap: Roadmap) =>
    apiRequest<{ success: boolean; roadmap: Roadmap }>(
      "/roadmaps/" + roadmap._id + "/approve",
      {
        method: "POST",
        body: JSON.stringify({
          version: roadmap.version,
          updatedAt: roadmap.updatedAt,
        }),
      },
    ),
  updateRoadmap: async (id: string, updates: Partial<Roadmap>) => {
    return apiRequest<{ success: boolean; message: string; roadmap: Roadmap }>(
      `/roadmaps/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  },

  deleteRoadmap: async (id: string) => {
    return apiRequest<{ success: boolean; message: string }>(
      `/roadmaps/${id}`,
      {
        method: "DELETE",
      },
    );
  },
};

// ----------------- Tasks API -----------------
export const tasksApi = {
  getTasks: async (params?: {
    goalId?: string;
    roadmapId?: string;
    status?: string;
    priority?: string;
    date?: string;
    startDate?: string;
    endDate?: string;
    isEssential?: boolean;
  }) => {
    const query = new URLSearchParams();
    if (params?.goalId) query.append("goalId", params.goalId);
    if (params?.roadmapId) query.append("roadmapId", params.roadmapId);
    if (params?.status) query.append("status", params.status);
    if (params?.priority) query.append("priority", params.priority);
    if (params?.date) query.append("date", params.date);
    if (params?.startDate) query.append("startDate", params.startDate);
    if (params?.endDate) query.append("endDate", params.endDate);
    if (params?.isEssential !== undefined)
      query.append("isEssential", String(params.isEssential));

    const qs = query.toString() ? `?${query.toString()}` : "";
    return apiRequest<{ success: boolean; count: number; tasks: Task[] }>(
      `/tasks${qs}`,
    );
  },

  getTaskById: async (id: string) => {
    return apiRequest<{ success: boolean; task: Task }>(`/tasks/${id}`);
  },

  createTask: async (data: {
    goalId: string;
    roadmapId: string;
    title: string;
    description?: string;
    scheduledDate: string;
    estimatedMinutes: number;
    priority?: "low" | "medium" | "high" | "critical";
    status?: "pending" | "in_progress" | "completed" | "missed" | "cancelled";
    isEssential?: boolean;
    dependsOn?: string[];
  }) => {
    return apiRequest<{ success: boolean; message: string; task: Task }>(
      "/tasks",
      {
        method: "POST",
        body: JSON.stringify(data),
      },
    );
  },

  updateTask: async (id: string, updates: Partial<Task>) => {
    return apiRequest<{ success: boolean; message: string; task: Task }>(
      `/tasks/${id}`,
      {
        method: "PATCH",
        body: JSON.stringify(updates),
      },
    );
  },

  deleteTask: async (id: string) => {
    return apiRequest<{ success: boolean; message: string }>(`/tasks/${id}`, {
      method: "DELETE",
    });
  },
};
