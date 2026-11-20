import { createServer } from "node:http";

const user = {
  id: "a".repeat(24),
  name: "Taylor Kim",
  email: "taylor@example.test",
};
const token = "fixture-session-token";
const records = { goals: [], roadmaps: [], tasks: [] };
const caseId = "d".repeat(24);
const proposalId = "e".repeat(24);
let nextId = 1;
let focus;
let review;
const iso = () => new Date().toISOString();

createServer(async (request, response) => {
  const path = new URL(request.url, "http://127.0.0.1").pathname;
  const method = request.method;
  const reply = (status, body) => {
    response.writeHead(status, { "Content-Type": "application/json" });
    response.end(JSON.stringify(body));
  };
  if (path === "/api/health") return reply(200, { success: true });
  if (
    method === "POST" &&
    ["/api/auth/login", "/api/auth/register"].includes(path)
  ) {
    const input = JSON.parse(await read(request));
    if (input.password !== "test-password")
      return reply(401, { success: false, message: "Invalid credentials." });
    if (path.endsWith("/register")) {
      for (const collection of Object.values(records)) collection.length = 0;
      focus = undefined;
      review = undefined;
    }
    return reply(path.endsWith("/register") ? 201 : 200, {
      success: true,
      token,
      user,
    });
  }
  if (request.headers.authorization !== "Bearer " + token)
    return reply(401, { success: false, message: "Please sign in." });
  if (path === "/api/auth/me") return reply(200, { success: true, user });
  if (path === "/api/auth/logout" && method === "POST")
    return reply(200, { success: true });
  if (path === "/api/focus/sessions" && method === "GET") {
    return reply(200, {
      success: true,
      sessions: focus && focus.state !== "completed" ? [focus] : [],
    });
  }
  if (path === "/api/focus/sessions" && method === "POST") {
    focus = {
      ...JSON.parse(await read(request)),
      _id: "f".repeat(24),
      state: "active",
      revision: 0,
      actualSeconds: 0,
      resumedAt: iso(),
    };
    return reply(201, { success: true, session: focus });
  }
  if (path.startsWith("/api/focus/sessions/") && method === "POST" && focus) {
    const action = path.split("/").at(-1);
    const input = JSON.parse(await read(request));
    focus = {
      ...focus,
      revision: focus.revision + 1,
      state: { pause: "paused", resume: "active", complete: "completed" }[
        action
      ],
      actualSeconds: 1,
      resumedAt: iso(),
      reflection: input.reflection,
    };
    return reply(200, { success: true, session: focus });
  }
  if (path === "/api/recovery/cases" && method === "POST") {
    const { goalId } = JSON.parse(await read(request));
    const task = records.tasks.find(
      (item) => item.goalId === goalId && item.status === "missed",
    );
    if (!task)
      return reply(422, { success: false, message: "No missed work." });
    return reply(200, {
      success: true,
      recoveryCase: { _id: caseId },
      proposals: [
        {
          _id: proposalId,
          optionType: "redistribute",
          explanation: "Verified calendar placement.",
          feasibility: "feasible",
          expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(),
          deferredTaskIds: [],
          changes: [
            {
              taskId: task._id,
              startAt: new Date(Date.now() + 60 * 60_000).toISOString(),
              endAt: new Date(Date.now() + 2 * 60 * 60_000).toISOString(),
            },
          ],
        },
      ],
    });
  }
  if (
    path === "/api/recovery/cases/" + caseId + "/approve" &&
    method === "POST"
  ) {
    const body = JSON.parse(await read(request));
    if (body.proposalId !== proposalId)
      return reply(404, { success: false, message: "Proposal unavailable." });
    for (const task of records.tasks)
      if (task.status === "missed") task.status = "pending";
    return reply(200, { success: true });
  }
  if (path === "/api/progress/summary" && method === "GET") {
    return reply(200, {
      success: true,
      focusSeconds: focus?.actualSeconds ?? 0,
      plannedMinutes: 90,
      recoveryOutcomes: [{ _id: "approved", count: 1 }],
    });
  }
  if (path.startsWith("/api/progress/reviews/")) {
    if (method === "PUT") review = JSON.parse(await read(request));
    return reply(200, { success: true, review: review ?? null });
  }
  const [, , name, id] = path.split("/");
  const list = records[name];
  if (!list)
    return reply(404, { success: false, message: "Unknown endpoint." });
  const singular = name.slice(0, -1);
  if (!id && method === "GET")
    return reply(200, { success: true, [name]: list, count: list.length });
  if (!id && method === "POST") {
    const input = JSON.parse(await read(request));
    const record = {
      status: "active",
      dependsOn: [],
      ...input,
      _id: (nextId++).toString(16).padStart(24, "0"),
      userId: user.id,
      createdAt: iso(),
      updatedAt: iso(),
    };
    if (name === "tasks") record.status = input.status ?? "pending";
    if (name === "roadmaps") {
      const previous = list.filter(
        (roadmap) => roadmap.goalId === input.goalId,
      );
      record.version = previous.length + 1;
      for (const roadmap of previous)
        if (roadmap.status === "active") roadmap.status = "superseded";
    }
    list.unshift(record);
    return reply(201, { success: true, [singular]: record });
  }
  const item = list.find((record) => record._id === id);
  if (!item)
    return reply(404, { success: false, message: "Record unavailable." });
  if (method === "PATCH") Object.assign(item, JSON.parse(await read(request)));
  if (method === "DELETE") list.splice(list.indexOf(item), 1);
  return reply(200, { success: true, [singular]: item });
}).listen(3141, "127.0.0.1");

async function read(request) {
  let body = "";
  for await (const part of request) body += part;
  return body;
}
