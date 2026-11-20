import { model, Schema } from "mongoose";

const focus = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    taskId: Schema.Types.ObjectId,
    startedAt: { type: Date, required: true },
    resumedAt: Date,
    endedAt: Date,
    elapsedMilliseconds: { type: Number, default: 0, required: true },
    actualSeconds: { type: Number, default: 0, required: true },
    state: {
      type: String,
      enum: ["active", "paused", "completed", "interrupted"],
      default: "active",
    },
    requestKey: { type: String, required: true },
    revision: { type: Number, default: 0, required: true },
    lastAction: String,
    reflection: String,
  },
  { timestamps: true, collection: "focusSessions" },
);
focus.index({ userId: 1, requestKey: 1 }, { unique: true });
focus.index({ userId: 1, startedAt: -1 });
focus.index({ userId: 1, state: 1, endedAt: 1 });

const review = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    weekStart: { type: Date, required: true },
    accomplishments: { type: String, default: "" },
    challenges: { type: String, default: "" },
    lessons: { type: String, default: "" },
    nextWeekAdjustments: { type: String, default: "" },
    outcomeEvidence: { type: [String], default: [] },
  },
  { timestamps: true, collection: "weeklyReviews" },
);
review.index({ userId: 1, weekStart: -1 }, { unique: true });

export const FocusSession = model("FocusSession", focus);
export const WeeklyReview = model("WeeklyReview", review);
