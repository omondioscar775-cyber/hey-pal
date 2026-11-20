import assert from "node:assert/strict";
import { test } from "node:test";
import { upstreamBase } from "../../src/lib/upstream.ts";

test("normalizes the Express API prefix exactly once", () => {
  for (const input of [
    "https://api.example.test",
    "https://api.example.test/api/",
  ]) {
    assert.equal(
      new URL("auth/register", upstreamBase(input, true)).href,
      "https://api.example.test/api/auth/register",
    );
  }
  assert.throws(() => upstreamBase("https://api.example.test/api/api", true));
});

test("hosted builds refuse missing, loopback and plaintext upstreams", () => {
  for (const input of [
    undefined,
    "http://api.example.test",
    "https://localhost:5000/api",
    "https://127.0.0.1",
    "https://[::1]",
  ]) {
    assert.throws(() => upstreamBase(input, true));
  }
  assert.equal(
    upstreamBase(undefined, false).href,
    "http://127.0.0.1:5000/api/",
  );
});

test("credentials, search parameters and fragments are rejected", () => {
  for (const input of [
    "https://user:pass@api.example.test",
    "https://api.example.test?secret=value",
    "https://api.example.test#fragment",
  ]) {
    assert.throws(() => upstreamBase(input, true));
  }
});
