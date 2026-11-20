import { Router } from "express";
import { z } from "zod";
import { protect } from "../../middleware/authMiddleware.js";
import { ApiError } from "../../shared/http.js";
import { objectId, parse } from "../../shared/validation.js";
import { ownedTransaction } from "../../shared/transaction.js";
import { RecoveryCase, RecoveryProposal } from "./models.js";
import { approve, generate } from "./service.js";

export const recoveryRoutes = Router();
recoveryRoutes.use(protect);
recoveryRoutes.post("/cases", async (req, res) => {
  const { goalId } = parse(z.object({ goalId: objectId }), req.body);
  res.json({ success: true, ...(await generate(req.userId!, goalId)) });
});
recoveryRoutes.get("/cases", async (req, res) => {
  const { goalId, before, limit } = parse(
    z.object({
      goalId: objectId.optional(),
      before: objectId.optional(),
      limit: z.coerce.number().int().min(1).max(100).default(25),
    }),
    req.query,
  );
  const cases = await RecoveryCase.find({
    userId: req.userId,
    ...(goalId && { goalId }),
    ...(before && { _id: { $lt: before } }),
  })
    .sort({ _id: -1 })
    .limit(limit + 1);
  const items = cases.slice(0, limit);
  res.json({
    success: true,
    cases: items,
    nextCursor: cases.length > limit ? items.at(-1)?.id : null,
  });
});
recoveryRoutes.get("/cases/:id", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const recoveryCase = await RecoveryCase.findOne({
    _id: id,
    userId: req.userId,
  });
  if (!recoveryCase)
    throw new ApiError(404, "CASE_UNAVAILABLE", "Recovery case unavailable.");
  const proposals = await RecoveryProposal.find({
    userId: req.userId,
    recoveryCaseId: id,
  });
  res.json({ success: true, recoveryCase, proposals });
});
recoveryRoutes.post("/cases/:id/approve", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const { proposalId } = parse(z.object({ proposalId: objectId }), req.body);
  res.json({ success: true, ...(await approve(req.userId!, id, proposalId)) });
});
recoveryRoutes.post("/cases/:id/reject", async (req, res) => {
  const id = parse(objectId, req.params.id);
  const userId = req.userId!;
  const recoveryCase = await ownedTransaction(userId, async (session) => {
    const item = await RecoveryCase.findOneAndUpdate(
      { _id: id, userId, state: { $in: ["options_generated", "rejected"] } },
      { state: "rejected" },
      { returnDocument: "after", session },
    );
    if (!item)
      throw new ApiError(
        404,
        "CASE_UNAVAILABLE",
        "Open recovery case unavailable.",
      );
    await RecoveryProposal.updateMany(
      { userId, recoveryCaseId: id, status: "proposed" },
      { status: "rejected" },
      { session },
    );
    return item;
  });
  res.json({ success: true, recoveryCase });
});
