import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { fileURLToPath } from "node:url";
import mongoose from "mongoose";

const target = new URL(process.env.CIRCLEUP_TEST_MONGO_URI ?? "");
assert.ok(["127.0.0.1", "localhost"].includes(target.hostname), "Use an isolated local replica set.");
const database = "circleup_mvp_test_" + randomUUID().replaceAll("-", "");
target.pathname = "/" + database;
const backend = fileURLToPath(new URL("../", import.meta.url));
const frontend = fileURLToPath(new URL("../../frontend/", import.meta.url));
const api = "http://127.0.0.1:3172";
const web = "http://127.0.0.1:3173";
const env = { ...process.env, NODE_ENV: "development", PORT: "3172",
  MONGODB_URI: target.href, JWT_SECRET: randomUUID() + randomUUID() };
const processes = [];
function launch(args, cwd, environment) {
  const child = spawn(process.execPath, args, { cwd, env: environment, stdio: ["ignore", "pipe", "pipe"] });
  let output = "";
  for (const stream of [child.stdout, child.stderr]) stream.on("data", (bytes) => { output += bytes; });
  const processResult = { child, output: () => output };
  processes.push(processResult);
  return processResult;
}
async function ready(url, processResult) {
  for (let count = 0; count < 120; count++) {
    if (processResult.child.exitCode !== null) break;
    try { if ((await fetch(url, { signal: AbortSignal.timeout(750) })).ok) return; } catch {}
    await new Promise((done) => setTimeout(done, 250));
  }
  throw new Error("Could not start local test service. " + processResult.output());
}

try {
  const server = launch(["dist/server.js"], backend, env);
  await ready(api + "/api/ready", server);
  const duplicateListener = launch(["dist/server.js"], backend, env);
  const [exit] = await once(duplicateListener.child, "exit");
  assert.equal(exit, 1);
  assert.match(duplicateListener.output(), /EADDRINUSE/);
  assert.doesNotMatch(duplicateListener.output(), /"event":"server_listening"/);

  const proxy = launch(["node_modules/next/dist/bin/next", "start", "--hostname", "127.0.0.1", "--port", "3173"],
    frontend, { ...process.env, CIRCLEUP_API_URL: api, VERCEL: "", VERCEL_ENV: "" });
  const root = web + "/api/circleup";
  await ready(root + "/ready", proxy);
  const credentials = { name: "MVP Smoke", email: "smoke@example.test", password: "fixture-password-2026" };
  async function call(path, method = "GET", body, cookie) {
    const response = await fetch(root + path, {
      method, headers: { "Content-Type": "application/json", ...(cookie && { Cookie: cookie }) },
      body: body ? JSON.stringify(body) : undefined,
    });
    return { response, data: await response.json() };
  }
  assert.equal((await call("/auth/me")).response.status, 401);
  assert.equal((await call("/auth/register", "POST", {})).response.status, 400);
  const registered = await call("/auth/register", "POST", credentials);
  assert.equal(registered.response.status, 201);
  assert.equal(registered.data.token, undefined);
  assert.match(registered.response.headers.get("set-cookie"), /HttpOnly/i);
  const cookie = registered.response.headers.get("set-cookie").split(";")[0];
  assert.equal((await call("/auth/register", "POST", credentials)).response.status, 409);
  assert.equal((await call("/auth/me", "GET", undefined, cookie)).data.user.email, credentials.email);
  const goal = await call("/goals", "POST", {
    title: "Verify local MVP", category: "Work", currentState: "Starting", desiredOutcome: "Verified", weeklyAvailableHours: 4,
  }, cookie);
  assert.equal(goal.response.status, 201);
  assert.equal(goal.data.goal.userId, registered.data.user.id);
  assert.equal((await call("/auth/logout", "POST", {}, cookie)).response.status, 200);
  assert.equal((await call("/auth/me", "GET", undefined, cookie)).response.status, 401);
  assert.equal((await call("/auth/login", "POST", credentials)).response.status, 200);
  console.log("Passed: listener conflict, readiness, registration, validation, duplicate email, profile, owned goal, logout and login.");
} finally {
  for (const { child } of processes.reverse()) {
    if (child.exitCode !== null || child.signalCode !== null) continue;
    const closed = once(child, "close");
    child.kill();
    await closed;
  }
  const client = new mongoose.mongo.MongoClient(target.href);
  try {
    await client.connect();
    await client.db(database).dropDatabase();
  } finally { await client.close(); }
}