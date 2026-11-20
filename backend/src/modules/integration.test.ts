import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import mongoose from "mongoose";
import app from "../app.js";
import connectDatabase from "../config/database.js";
import Task from "../models/Task.js";
import { performance } from "node:perf_hooks";
import { RoadmapEvent } from "./recovery/models.js";
const uri = process.env.CIRCLEUP_TEST_MONGO_URI;
test(
  "replica-set HTTP workflows, rollback and revocation",
  { skip: !uri },
  async (context) => {
    const database = "circleup_test_" + randomUUID().replaceAll("-", "");
    const testUri = new URL(uri!);
    testUri.pathname = "/" + database;
    process.env.JWT_SECRET = "integration-test-secret-with-sufficient-length";
    await connectDatabase(testUri.toString());
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    context.after(async () => {
      await new Promise<void>((resolve, reject) =>
        server.close((error) => (error ? reject(error) : resolve())),
      );
      if (mongoose.connection.name === database)
        await mongoose.connection.dropDatabase();
      await mongoose.disconnect();
    });
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const port = address.port;
    let token = "";
    async function request(
      method: string,
      path: string,
      body?: unknown,
      auth = token,
    ) {
      const response = await fetch("http://127.0.0.1:" + port + "/api" + path, {
        method,
        headers: {
          "Content-Type": "application/json",
          ...(auth && { Authorization: "Bearer " + auth }),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }
    const account = {
      email: "test@example.test",
      name: "Test Member",
      password: "test-password",
    };
    const registered = await request("POST", "/auth/register", account);
    assert.equal(registered.status, 201);
    token = registered.data.token;
    assert.ok(!("password" in registered.data.user));
    assert.equal(
      (
        await request("POST", "/auth/login", {
          ...account,
          password: "wrong-password",
        })
      ).status,
      401,
    );
    const signedIn = await request("POST", "/auth/login", account);
    assert.equal(signedIn.status, 200);
    assert.equal((await request("GET", "/auth/me")).status, 200);
    const createGoal = await request("POST", "/goals", {
      title: "Finish a project",
      currentState: "Starting",
      desiredOutcome: "Finished",
      category: "Work",
      weeklyAvailableHours: 5,
      userId: "0".repeat(24),
    });
    assert.equal(createGoal.status, 201);
    const goal = createGoal.data.goal;
    assert.equal(goal.userId, registered.data.user.id);
    const draft = await request("POST", "/roadmaps", {
      goalId: goal._id,
      title: "Draft roadmap",
      status: "draft",
      milestones: [{ title: "First delivery" }],
    });
    assert.equal(draft.status, 201);
    const approval = await request(
      "POST",
      "/roadmaps/" + draft.data.roadmap._id + "/approve",
      draft.data.roadmap,
    );
    assert.equal(approval.status, 200);
    const roadmap = approval.data.roadmap;
    const createTask = await request("POST", "/tasks", {
      goalId: goal._id,
      roadmapId: roadmap._id,
      milestoneId: roadmap.milestones[0]._id,
      title: "Prepare material",
      status: "missed",
      scheduledDate: "2020-01-01",
      estimatedMinutes: 30,
      isEssential: true,
    });
    assert.equal(createTask.status, 201);
    const taskId = createTask.data.task._id;
    assert.equal(
      (await request("PATCH", "/tasks/" + taskId, { dependsOn: [taskId] }))
        .status,
      409,
    );
    assert.equal(
      (
        await request("PATCH", "/tasks/" + taskId, {
          dependsOn: ["0".repeat(24)],
        })
      ).status,
      422,
    );
    assert.equal(
      (
        await request("PUT", "/planner/availability", {
          timezone: "UTC",
          weeklyWindows: Array.from({ length: 7 }, (_, day) => ({
            day,
            start: 0,
            end: 1440,
          })),
        })
      ).status,
      200,
    );
    const start = new Date(
      Math.ceil((Date.now() + 120 * 60_000) / 60_000) * 60_000,
    );
    const block = {
      startAt: start,
      endAt: new Date(start.getTime() + 60 * 60_000),
      type: "fixed_commitment",
    };
    const reservations = await Promise.all([
      request("POST", "/planner/blocks", { ...block, requestKey: "reserve-1" }),
      request("POST", "/planner/blocks", { ...block, requestKey: "reserve-2" }),
    ]);
    assert.deepEqual(
      reservations.map((value) => value.status).sort(),
      [201, 409],
    );
    const freeBlock = {
      type: "break",
      startAt: new Date(start.getTime() - 20 * 60_000),
      endAt: start,
    };
    const conflict = await request("POST", "/planner/commit", {
      requestKey: "weekly-conflict",
      blocks: [freeBlock, block],
    });
    assert.equal(conflict.status, 409);
    const preview = await request("POST", "/planner/preview-plan", {
      blocks: [freeBlock],
    });
    assert.equal(preview.status, 200);
    const commitBody = { requestKey: "weekly-commit", blocks: [freeBlock] };
    const commit = await request("POST", "/planner/commit", commitBody);
    assert.equal(commit.status, 201);
    const replay = await request("POST", "/planner/commit", commitBody);
    assert.equal(replay.status, 200);
    assert.equal(replay.data.commitId, commit.data.commitId);
    assert.equal(
      (
        await request("POST", "/planner/commit", {
          requestKey: commitBody.requestKey,
          blocks: [block],
        })
      ).status,
      409,
    );

    const stale = await request("POST", "/recovery/cases", {
      goalId: goal._id,
    });
    assert.equal(stale.status, 200);
    const staleProposal = stale.data.proposals.find(
      (item: { optionType: string }) => item.optionType === "redistribute",
    );
    assert.equal(
      (await request("PATCH", "/tasks/" + taskId, { estimatedMinutes: 35 }))
        .status,
      200,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/recovery/cases/" + stale.data.recoveryCase._id + "/approve",
          { proposalId: staleProposal._id },
        )
      ).status,
      409,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/recovery/cases/" + stale.data.recoveryCase._id + "/reject",
        )
      ).status,
      200,
    );
    const options = await request("POST", "/recovery/cases", {
      goalId: goal._id,
    });
    assert.equal(options.status, 200);
    const proposal = options.data.proposals.find(
      (item: { optionType: string }) => item.optionType === "redistribute",
    );
    assert.equal(proposal.feasibility, "feasible");
    const approvePath =
      "/recovery/cases/" + options.data.recoveryCase._id + "/approve";
    const proposalBody = { proposalId: proposal._id };
    const fail = context.mock.method(RoadmapEvent, "create", async () => {
      throw new Error("Simulated persistence failure");
    });
    try {
      assert.equal(
        (await request("POST", approvePath, proposalBody)).status,
        500,
      );
    } finally {
      fail.mock.restore();
    }
    assert.equal(
      (await request("GET", "/roadmaps/" + roadmap._id)).data.roadmap.status,
      "active",
    );
    assert.equal(
      (await request("GET", "/tasks/" + taskId)).data.task.status,
      "missed",
    );
    const recovered = await request("POST", approvePath, proposalBody);
    assert.equal(recovered.status, 200);
    assert.equal(recovered.data.roadmap.version, 2);
    assert.equal(
      (await request("POST", approvePath, proposalBody)).status,
      200,
    );
    assert.equal(
      (await request("GET", "/tasks/" + taskId)).data.task.status,
      "pending",
    );
    const focus = await request("POST", "/focus/sessions", {
      taskId,
      requestKey: "focus-start",
    });
    assert.equal(focus.status, 201);
    const focusPath = "/focus/sessions/" + focus.data.session._id;
    assert.equal(
      (await request("POST", focusPath + "/pause", { revision: 0 })).status,
      200,
    );
    const finished = await request("POST", focusPath + "/complete", {
      revision: 1,
      reflection: "Made progress",
    });
    assert.equal(finished.status, 200);
    assert.equal(
      (await request("POST", focusPath + "/complete", { revision: 1 })).data
        .session.actualSeconds,
      finished.data.session.actualSeconds,
    );
    assert.equal(
      (
        await request("PUT", "/progress/reviews/2026-11-16", {
          accomplishments: "Started",
        })
      ).status,
      200,
    );
    assert.equal(
      (await request("GET", "/progress/summary?weekStart=2026-11-16")).status,
      200,
    );
    const samples = [];
    const scheduledDate = new Date("2026-11-20");
    await Task.insertMany(
      Array.from({ length: 250 }, (_, index) => ({
        userId: goal.userId,
        goalId: goal._id,
        roadmapId: recovered.data.roadmap._id,
        title: "Synthetic completed task " + index,
        status: "completed",
        scheduledDate,
        estimatedMinutes: 15,
      })),
    );
    for (let i = 0; i < 24; i++) {
      const start = performance.now();
      const result = await request(
        "GET",
        i % 2
          ? "/progress/summary?weekStart=2026-11-16"
          : "/tasks?date=2026-11-20",
      );
      assert.equal(result.status, 200);
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    const explain = await Task.collection
      .find({ userId: new mongoose.Types.ObjectId(goal.userId), scheduledDate })
      .hint({ userId: 1, scheduledDate: 1, status: 1 })
      .explain("executionStats");
    context.diagnostic(
      "Local read p95 " +
        samples[Math.ceil(samples.length * 0.95) - 1].toFixed(1) +
        " ms across 24 sequential requests with 250 synthetic tasks",
    );
    context.diagnostic(
      "Task date index examined " +
        explain.executionStats.totalKeysExamined +
        " keys for " +
        explain.executionStats.nReturned +
        " records",
    );
    assert.equal((await request("POST", "/auth/logout")).status, 200);
    assert.equal((await request("GET", "/auth/me")).status, 401);
    assert.equal(
      (await request("GET", "/auth/me", undefined, signedIn.data.token)).status,
      200,
    );
    const webhook = "https://mailer.example.test/reset";
    process.env.PASSWORD_RESET_WEBHOOK = webhook;
    process.env.PASSWORD_RESET_WEBHOOK_SECRET = "test-only-webhook-credential";
    const networkFetch = globalThis.fetch;
    let resetToken = "";
    const mockFetch = context.mock.method(
      globalThis,
      "fetch",
      async (input: string | URL | Request, init?: RequestInit) => {
        if (input !== webhook) return networkFetch(input, init);
        resetToken = JSON.parse(String(init?.body)).token;
        return new Response(null, { status: 204 });
      },
    );
    try {
      const reset = await request(
        "POST",
        "/auth/password-reset/request",
        { email: account.email },
        "",
      );
      assert.equal(reset.status, 202);
      assert.match(resetToken, /^[a-f0-9]{64}$/);
      assert.ok(!JSON.stringify(reset.data).includes(resetToken));
    } finally {
      mockFetch.mock.restore();
    }
    const resetInput = { token: resetToken, password: "updated-password" };
    assert.equal(
      (await request("POST", "/auth/password-reset/complete", resetInput, ""))
        .status,
      200,
    );
    assert.equal(
      (await request("POST", "/auth/password-reset/complete", resetInput, ""))
        .status,
      400,
    );
    assert.equal(
      (await request("GET", "/auth/me", undefined, signedIn.data.token)).status,
      401,
    );
    assert.equal(
      (
        await request(
          "POST",
          "/auth/login",
          { ...account, password: resetInput.password },
          "",
        )
      ).status,
      200,
    );
  },
);
