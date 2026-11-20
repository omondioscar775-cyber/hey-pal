import assert from "node:assert/strict";
import { once } from "node:events";
import type { Server } from "node:http";
import { after, before, describe, it } from "node:test";
import jwt from "jsonwebtoken";
import app from "../app.js";
import Goal from "../models/Goal.js";
import Roadmap from "../models/Roadmap.js";
import Task from "../models/Task.js";

const testSecret = "goal-ownership-test-secret";
const ownerId = "507f1f77bcf86cd799439011";
const otherUserId = "507f191e810c19729de860ea";
const goalId = "507f1f77bcf86cd799439012";
const roadmapId = "507f1f77bcf86cd799439013";
const taskId = "507f1f77bcf86cd799439014";
const originalSecret = process.env.JWT_SECRET;
const findOneDescriptors = [
  [Goal, Object.getOwnPropertyDescriptor(Goal, "findOne")],
  [Roadmap, Object.getOwnPropertyDescriptor(Roadmap, "findOne")],
  [Task, Object.getOwnPropertyDescriptor(Task, "findOne")],
] as const;

let server: Server;
let baseUrl: string;

const createPopulatedQuery = (result: unknown) => {
  const query = {
    populate: () => query,
    then: (
      resolve: (value: unknown) => unknown,
      reject?: (reason: unknown) => unknown
    ) => Promise.resolve(result).then(resolve, reject),
  };
  return query;
};

const tokenFor = (userId: string): string =>
  jwt.sign({ userId }, testSecret, { expiresIn: "1m" });

before(async () => {
  process.env.JWT_SECRET = testSecret;
  Object.defineProperty(Goal, "findOne", {
    configurable: true,
    value: async (query: { _id?: unknown; userId?: unknown }) => {
      if (String(query._id) !== goalId || String(query.userId) !== ownerId) {
        return null;
      }

      return {
        _id: goalId,
        userId: ownerId,
        title: "Test goal",
        category: "Career",
        currentState: "Starting",
        desiredOutcome: "Complete",
        weeklyAvailableHours: 5,
        status: "active",
      };
    },
  });
  Object.defineProperty(Roadmap, "findOne", {
    configurable: true,
    value: (query: { _id?: unknown; userId?: unknown }) =>
      createPopulatedQuery(
        String(query._id) === roadmapId &&
          String(query.userId) === ownerId
          ? {
              _id: roadmapId,
              userId: ownerId,
              goalId,
              version: 1,
              title: "Test roadmap",
              milestones: [],
              status: "active",
            }
          : null
      ),
  });
  Object.defineProperty(Task, "findOne", {
    configurable: true,
    value: (query: { _id?: unknown; userId?: unknown }) =>
      createPopulatedQuery(
        String(query._id) === taskId && String(query.userId) === ownerId
          ? {
              _id: taskId,
              userId: ownerId,
              goalId,
              roadmapId,
              title: "Test task",
              scheduledDate: new Date("2026-11-20T12:00:00.000Z"),
              estimatedMinutes: 30,
              priority: "medium",
              status: "pending",
              isEssential: false,
              dependsOn: [],
            }
          : null
      ),
  });

  server = app.listen(0);
  await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Could not determine the test server address.");
  }
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  if (server) {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }

  for (const [model, descriptor] of findOneDescriptors) {
    if (descriptor) {
      Object.defineProperty(model, "findOne", descriptor);
    } else {
      Reflect.deleteProperty(model, "findOne");
    }
  }

  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("user-owned resource access", () => {
  it("allows the owning user to retrieve their goal", async () => {
    const response = await fetch(`${baseUrl}/api/goals/${goalId}`, {
      headers: { Authorization: `Bearer ${tokenFor(ownerId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      goal?: { _id: string; title: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.goal?._id, goalId);
    assert.equal(body.goal?.title, "Test goal");
  });

  it("does not disclose another user's goal", async () => {
    const response = await fetch(`${baseUrl}/api/goals/${goalId}`, {
      headers: { Authorization: `Bearer ${tokenFor(otherUserId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      goal?: unknown;
    };

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Goal not found.");
    assert.equal(body.goal, undefined);
  });

  it("allows the owning user to retrieve their roadmap", async () => {
    const response = await fetch(`${baseUrl}/api/roadmaps/${roadmapId}`, {
      headers: { Authorization: `Bearer ${tokenFor(ownerId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      roadmap?: { _id: string; title: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.roadmap?._id, roadmapId);
    assert.equal(body.roadmap?.title, "Test roadmap");
  });

  it("does not disclose another user's roadmap", async () => {
    const response = await fetch(`${baseUrl}/api/roadmaps/${roadmapId}`, {
      headers: { Authorization: `Bearer ${tokenFor(otherUserId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      roadmap?: unknown;
    };

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Roadmap not found.");
    assert.equal(body.roadmap, undefined);
  });

  it("allows the owning user to retrieve their task", async () => {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${tokenFor(ownerId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      task?: { _id: string; title: string };
    };

    assert.equal(response.status, 200);
    assert.equal(body.success, true);
    assert.equal(body.task?._id, taskId);
    assert.equal(body.task?.title, "Test task");
  });

  it("does not disclose another user's task", async () => {
    const response = await fetch(`${baseUrl}/api/tasks/${taskId}`, {
      headers: { Authorization: `Bearer ${tokenFor(otherUserId)}` },
    });
    const body = (await response.json()) as {
      success: boolean;
      message: string;
      task?: unknown;
    };

    assert.equal(response.status, 404);
    assert.equal(body.success, false);
    assert.equal(body.message, "Task not found.");
    assert.equal(body.task, undefined);
  });
});
