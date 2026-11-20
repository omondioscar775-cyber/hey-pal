import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import rateLimit from "express-rate-limit";

import authRoutes from "./routes/authRoutes.js";
import goalRoutes from "./routes/goalRoutes.js";
import roadmapRoutes from "./routes/roadmapRoutes.js";
import taskRoutes from "./routes/taskRoutes.js";

const app = express();

// 1. Security
app.use(helmet());

// 2. CORS
app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

// 3. Request parsing
app.use(express.json({ limit: "10kb" }));
app.use(express.urlencoded({ extended: true }));

// 4. Logging
app.use(morgan("dev"));

// 5. Rate limiting
app.use(
  rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 100,
    standardHeaders: "draft-8",
    legacyHeaders: false,
  })
);

// 6. API routes
app.use("/api/auth", authRoutes);
app.use("/api/goals", goalRoutes);
app.use("/api/roadmaps", roadmapRoutes);
app.use("/api/tasks", taskRoutes);

// 7. Health check
app.get("/api/health", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "CircleUp API is operational",
    environment: process.env.NODE_ENV,
    timestamp: new Date().toISOString(),
  });
});

// 8. Not found handler
app.use((_req, res) => {
  res.status(404).json({
    success: false,
    message: "API endpoint not found.",
  });
});

export default app;