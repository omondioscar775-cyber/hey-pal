import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { protect } from "./authMiddleware.js";

const testSecret = "middleware-test-secret";
const originalSecret = process.env.JWT_SECRET;

interface ResponseState {
  statusCode?: number;
  body?: unknown;
}

const createResponse = (state: ResponseState): Response =>
  ({
    status(code: number) {
      state.statusCode = code;
      return this;
    },
    json(body: unknown) {
      state.body = body;
      return this;
    },
  }) as Response;

const createRequest = (authorization?: string): Request =>
  ({
    headers: authorization ? { authorization } : {},
  }) as Request;

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = originalSecret;
  }
});

describe("protect middleware", () => {
  it("accepts a valid token and attaches its user ID", () => {
    process.env.JWT_SECRET = testSecret;
    const userId = "507f1f77bcf86cd799439011";
    const req = createRequest(
      `Bearer ${jwt.sign({ userId }, testSecret, { expiresIn: "1m" })}`
    );
    const state: ResponseState = {};
    let nextCalled = false;

    protect(req, createResponse(state), () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, true);
    assert.equal(req.userId, userId);
    assert.equal(state.statusCode, undefined);
  });

  it("rejects a missing authorization header", () => {
    process.env.JWT_SECRET = testSecret;
    const state: ResponseState = {};

    protect(createRequest(), createResponse(state), () => {
      assert.fail("next should not be called");
    });

    assert.equal(state.statusCode, 401);
  });

  it("rejects an empty bearer token", () => {
    process.env.JWT_SECRET = testSecret;
    const state: ResponseState = {};

    protect(createRequest("Bearer   "), createResponse(state), () => {
      assert.fail("next should not be called");
    });

    assert.equal(state.statusCode, 401);
  });

  it("rejects a token with an invalid signature", () => {
    process.env.JWT_SECRET = testSecret;
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      "different-test-secret"
    );
    const state: ResponseState = {};

    protect(createRequest(`Bearer ${token}`), createResponse(state), () => {
      assert.fail("next should not be called");
    });

    assert.equal(state.statusCode, 401);
  });

  it("rejects an expired token", () => {
    process.env.JWT_SECRET = testSecret;
    const token = jwt.sign(
      { userId: "507f1f77bcf86cd799439011" },
      testSecret,
      { expiresIn: -1 }
    );
    const state: ResponseState = {};

    protect(createRequest(`Bearer ${token}`), createResponse(state), () => {
      assert.fail("next should not be called");
    });

    assert.equal(state.statusCode, 401);
    assert.match(
      (state.body as { message: string }).message,
      /session has expired/i
    );
  });

  it("returns an explicit service error when the signing secret is missing", () => {
    delete process.env.JWT_SECRET;
    const state: ResponseState = {};

    protect(createRequest("Bearer token"), createResponse(state), () => {
      assert.fail("next should not be called");
    });

    assert.equal(state.statusCode, 500);
  });
});
