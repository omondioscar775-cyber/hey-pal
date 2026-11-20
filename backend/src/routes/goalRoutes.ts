import { Router } from "express";

import {
  createGoal,
  archiveGoal,
  getGoals,
  getGoalById,
  updateGoal,
  deleteGoal,
} from "../controllers/goalController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);

router.post("/", createGoal);
router.get("/", getGoals);
router.get("/:id", getGoalById);
router.post("/:id/archive", archiveGoal);
router.patch("/:id", updateGoal);
router.delete("/:id", deleteGoal);

export default router;
