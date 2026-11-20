import mongoose, { Schema, Document } from "mongoose";

export type GoalStatus = "active" | "completed" | "paused" | "archived";

export interface IGoal extends Document {
  userId: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  category: string;
  motivation?: string;
  priority?: string;
  targetDate?: Date;
  currentState: string;
  desiredOutcome: string;
  weeklyAvailableHours: number;
  status: GoalStatus;
  createdAt: Date;
  updatedAt: Date;
}

const goalSchema = new Schema<IGoal>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    motivation: { type: String, maxlength: 1000 },
    priority: { type: String, enum: ["low", "medium", "high", "critical"] },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    targetDate: Date,
    currentState: {
      type: String,
      required: true,
      trim: true,
    },
    desiredOutcome: {
      type: String,
      required: true,
      trim: true,
    },
    weeklyAvailableHours: {
      type: Number,
      required: true,
      min: 1,
      max: 168,
    },
    status: {
      type: String,
      enum: ["active", "completed", "paused", "archived"],
      default: "active",
    },
  },
  { timestamps: true },
);

goalSchema.index({ userId: 1, status: 1, createdAt: -1 });
goalSchema.index({ userId: 1, targetDate: 1 });

const Goal = mongoose.model<IGoal>("Goal", goalSchema);

export default Goal;
