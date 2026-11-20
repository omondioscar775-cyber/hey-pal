import mongoose, { Schema, Document } from "mongoose";

export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus =
  "pending" | "in_progress" | "completed" | "missed" | "cancelled";

export interface ITask extends Document {
  userId: mongoose.Types.ObjectId;
  goalId: mongoose.Types.ObjectId;
  roadmapId: mongoose.Types.ObjectId;
  milestoneId?: mongoose.Types.ObjectId;
  dueAt?: Date;
  version: number;
  title: string;
  description?: string;
  scheduledDate: Date;
  estimatedMinutes: number;
  priority: TaskPriority;
  status: TaskStatus;
  isEssential: boolean;
  dependsOn: mongoose.Types.ObjectId[];
  completedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const taskSchema = new Schema<ITask>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    goalId: {
      type: Schema.Types.ObjectId,
      ref: "Goal",
      required: true,
      index: true,
    },
    roadmapId: {
      type: Schema.Types.ObjectId,
      ref: "Roadmap",
      required: true,
      index: true,
    },
    milestoneId: Schema.Types.ObjectId,
    dueAt: Date,
    version: { type: Number, default: 1 },
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
    scheduledDate: {
      type: Date,
      required: true,
      index: true,
    },
    estimatedMinutes: {
      type: Number,
      required: true,
      min: 1,
    },
    priority: {
      type: String,
      enum: ["low", "medium", "high", "critical"],
      default: "medium",
    },
    status: {
      type: String,
      enum: ["pending", "in_progress", "completed", "missed", "cancelled"],
      default: "pending",
    },
    isEssential: {
      type: Boolean,
      default: false,
    },
    dependsOn: [
      {
        type: Schema.Types.ObjectId,
        ref: "Task",
      },
    ],
    completedAt: Date,
  },
  { timestamps: true },
);

taskSchema.index({ userId: 1, scheduledDate: 1, status: 1 });

taskSchema.index({ userId: 1, status: 1, dueAt: 1 });
taskSchema.index({ goalId: 1, milestoneId: 1 });

const Task = mongoose.model<ITask>("Task", taskSchema);

export default Task;
