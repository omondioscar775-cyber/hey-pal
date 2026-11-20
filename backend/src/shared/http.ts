import { randomUUID } from "node:crypto";
import type { ErrorRequestHandler, RequestHandler } from "express";

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

export const requestContext: RequestHandler = (_req, res, next) => {
  res.locals.requestId = randomUUID();
  res.setHeader("X-Request-Id", res.locals.requestId);
  const send = res.json.bind(res);
  res.json = (body: unknown) => {
    if (
      res.statusCode < 400 ||
      !body ||
      typeof body !== "object" ||
      !("message" in body) ||
      "error" in body
    )
      return send(body);
    const codes: Record<number, string> = {
      400: "VALIDATION_ERROR",
      401: "AUTH_REQUIRED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      422: "INFEASIBLE",
      429: "RATE_LIMITED",
      500: "INTERNAL_ERROR",
    };
    return send({
      ...body,
      requestId: res.locals.requestId,
      error: {
        code: codes[res.statusCode] ?? "REQUEST_FAILED",
        message: body.message,
        details:
          "errors" in body && body.errors
            ? Object.entries(body.errors).map(([field, messages]) => ({
                field,
                messages,
              }))
            : [],
      },
    });
  };
  next();
};

export const handleError: ErrorRequestHandler = (error, _req, res, next) => {
  if (res.headersSent) return next(error);
  const failure =
    error instanceof ApiError
      ? error
      : error?.code === 11000
        ? new ApiError(
            409,
            "CONFLICT",
            "A record with those values already exists.",
          )
        : error?.type === "entity.parse.failed"
          ? new ApiError(400, "INVALID_JSON", "Malformed JSON request.")
          : error?.type === "entity.too.large"
            ? new ApiError(
                413,
                "PAYLOAD_TOO_LARGE",
                "Request body is too large.",
              )
            : error?.code === 20
              ? new ApiError(
                  503,
                  "TRANSACTIONS_REQUIRED",
                  "This operation requires a MongoDB replica set.",
                )
              : new ApiError(
                  500,
                  "INTERNAL_ERROR",
                  "The request could not be completed.",
                );
  if (failure.status === 500)
    console.error(
      JSON.stringify({
        event: "request_failed",
        requestId: res.locals.requestId,
      }),
    );
  res.status(failure.status).json({
    success: false,
    message: failure.message,
    requestId: res.locals.requestId,
    error: {
      code: failure.code,
      message: failure.message,
      details: failure.details ?? [],
    },
  });
};
