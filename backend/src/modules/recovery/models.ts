import { model, Schema } from "mongoose";

const recoveryCase = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    goalId: { type: Schema.Types.ObjectId, required: true },
    roadmapId: { type: Schema.Types.ObjectId, required: true },
    sourceFingerprint: { type: String, required: true },
    state: {
      type: String,
      enum: ["options_generated", "approved", "rejected"],
      default: "options_generated",
    },
    detectedAt: { type: Date, required: true },
    expiresAt: { type: Date, required: true },
    approvedProposalId: Schema.Types.ObjectId,
    updatedRoadmapId: Schema.Types.ObjectId,
  },
  { timestamps: true, collection: "recoveryCases" },
);
recoveryCase.index({ userId: 1, goalId: 1, detectedAt: -1 });
recoveryCase.index({ userId: 1, sourceFingerprint: 1, expiresAt: 1 });

const change = new Schema(
  {
    taskId: { type: Schema.Types.ObjectId, required: true },
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
  },
  { _id: false },
);
const proposal = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    recoveryCaseId: {
      type: Schema.Types.ObjectId,
      required: true,
      immutable: true,
    },
    baseRoadmapVersion: { type: Number, required: true, immutable: true },
    optionType: {
      type: String,
      enum: ["protect_deadline", "redistribute", "revise_milestone"],
      required: true,
      immutable: true,
    },
    changes: { type: [change], required: true, immutable: true },
    deferredTaskIds: {
      type: [Schema.Types.ObjectId],
      default: [],
      immutable: true,
    },
    milestoneId: { type: Schema.Types.ObjectId, immutable: true },
    milestoneTarget: { type: Date, immutable: true },
    estimatedMinutes: { type: Number, required: true, immutable: true },
    feasibility: {
      type: String,
      enum: ["feasible", "infeasible"],
      required: true,
      immutable: true,
    },
    explanation: { type: String, required: true, immutable: true },
    expiresAt: { type: Date, required: true, immutable: true },
    status: {
      type: String,
      enum: ["proposed", "approved", "rejected"],
      default: "proposed",
    },
  },
  { timestamps: true, collection: "recoveryProposals" },
);
proposal.index(
  { userId: 1, recoveryCaseId: 1, optionType: 1 },
  { unique: true },
);

const event = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    roadmapId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    actorId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    version: { type: Number, required: true, immutable: true },
    action: { type: String, required: true, immutable: true },
    proposalId: { type: Schema.Types.ObjectId, immutable: true },
    previousRoadmapId: { type: Schema.Types.ObjectId, immutable: true },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    collection: "roadmapEvents",
  },
);
event.index({ userId: 1, roadmapId: 1, createdAt: -1 });

export const RecoveryCase = model("RecoveryCase", recoveryCase);
export const RecoveryProposal = model("RecoveryProposal", proposal);
export const RoadmapEvent = model("RoadmapEvent", event);
