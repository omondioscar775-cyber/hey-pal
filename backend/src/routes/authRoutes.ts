import { Router } from "express";
import { register, login, getMe } from "../controllers/authController.js";

import { protect } from "../middleware/authMiddleware.js";

import { rateLimit } from "express-rate-limit";
import {
  completeReset,
  logout,
  requestReset,
} from "../modules/auth/service.js";

const router = Router();
const limit = rateLimit({
  windowMs: 15 * 60_000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: { success: false, message: "Too many authentication attempts." },
});

router.post("/register", limit, register);
router.post("/login", limit, login);

// Protected route
router.get("/me", protect, getMe);

router.post("/logout", protect, logout);
router.post("/password-reset/request", limit, requestReset);
router.post("/password-reset/complete", limit, completeReset);

export default router;
