import { Router } from "express";

import {
  createRoadmap,
  getRoadmaps,
  getRoadmapById,
  updateRoadmap,
  deleteRoadmap,
} from "../controllers/roadmapController.js";

import { protect } from "../middleware/authMiddleware.js";

const router = Router();

router.use(protect);

router.post("/", createRoadmap);
router.get("/", getRoadmaps);
router.get("/:id", getRoadmapById);
router.patch("/:id", updateRoadmap);
router.delete("/:id", deleteRoadmap);

export default router;
