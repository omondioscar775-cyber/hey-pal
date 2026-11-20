import mongoose, { Schema, Document } from "mongoose";

export interface IMilestone {
  _id?: mongoose.Types.ObjectId;
  title: string;
  description?: string;
  targetDate?: Date;
  completed: boolean;
}

export interface IRoadmap extends Document {
  userId: mongoose.Types.ObjectId;
  goalId: mongoose.Types.ObjectId;
  version: number;
  title: string;
  milestones: IMilestone[];
  status: "draft" | "active" | "superseded" | "completed" | "archived";
  acceptedAt?: Date;
  supersedesId?: mongoose.Types.ObjectId;
  generationMethod: "manual" | "template" | "ai_assisted";
  createdAt: Date;
  updatedAt: Date;
}

const milestoneSchema = new Schema<IMilestone>(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    targetDate: Date,
    completed: {
      type: Boolean,
      default: false,
    },
  },
  { _id: true },
);

const roadmapSchema = new Schema<IRoadmap>(
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
    version: {
      type: Number,
      required: true,
      default: 1,
      min: 1,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    acceptedAt: Date,
    supersedesId: { type: Schema.Types.ObjectId, ref: "Roadmap" },
    generationMethod: {
      type: String,
      enum: ["manual", "template", "ai_assisted"],
      default: "manual",
    },
    milestones: {
      type: [milestoneSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ["draft", "active", "superseded", "completed", "archived"],
      default: "active",
    },
  },
  { timestamps: true },
);

roadmapSchema.index({ goalId: 1, version: 1 }, { unique: true });

roadmapSchema.index({ userId: 1, goalId: 1, status: 1, version: -1 });

const Roadmap = mongoose.model<IRoadmap>("Roadmap", roadmapSchema);

export default Roadmap;
