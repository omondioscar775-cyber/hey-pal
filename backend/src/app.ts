import express from "express";
import mongoose from "mongoose";
import { handleError, requestContext } from "./shared/http.js";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import roadmapRoutes from "./routes/roadmapRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";
import { plannerRoutes } from "./modules/planning/routes.js";
import { recoveryRoutes } from "./modules/recovery/routes.js";
import { focusRoutes } from "./modules/progress/focus.js";
import { progressRoutes } from "./modules/progress/routes.js";

const app = express();

// 1. Security
app.use(requestContext);
app.use(helmet());

// 2. CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  }),
);

// 3. Request parsing
app.use(express.json({ limit: "128kb" }));
app.use(express.urlencoded({ extended: true }));

// 4. Logging
app.use(
  morgan((tokens, req, res) =>
    JSON.stringify({
      event: "http_request",
      method: req.method,
      status: res.statusCode,
      requestId: res.getHeader("X-Request-Id"),
      durationMs: Number(tokens["response-time"](req, res)),
    }),
  ),
);

// 5. Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    message: { success: false, message: "Too many requests." },
    standardHeaders: "draft-8",
    legacyHeaders: false,
  }),
);

// 6. API routes
app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/roadmaps", roadmapRoutes);
app.use("/api/tasks", taskRoutes);
app.use("/api/planner", plannerRoutes);
app.use("/api/recovery", recoveryRoutes);
app.use("/api/focus", focusRoutes);
app.use("/api/progress", progressRoutes);

// 7. Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CircleUp API is operational",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

app.get("/api/ready", (_req, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ success: ready });
});

// 8. Not found handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

app.use(handleError);

export default app;
