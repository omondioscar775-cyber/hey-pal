import { model, Schema } from "mongoose";

const window = new Schema(
  {
    day: { type: Number, required: true },
    start: { type: Number, required: true },
    end: { type: Number, required: true },
  },
  { _id: false },
);
const availability = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, unique: true },
    timezone: { type: String, required: true },
    weeklyWindows: { type: [window], default: [] },
    closedDates: { type: [String], default: [] },
  },
  { timestamps: true, collection: "availability" },
);

const block = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true },
    taskId: Schema.Types.ObjectId,
    startAt: { type: Date, required: true },
    endAt: { type: Date, required: true },
    type: {
      type: String,
      enum: ["task", "fixed_commitment", "break"],
      required: true,
    },
    status: {
      type: String,
      enum: ["planned", "completed", "cancelled"],
      default: "planned",
    },
    requestKey: String,
  },
  { timestamps: true, collection: "scheduleBlocks" },
);
block.index({ userId: 1, startAt: 1, endAt: 1 });
block.index({ userId: 1, taskId: 1, startAt: 1 });
block.index(
  { userId: 1, requestKey: 1 },
  {
    unique: true,
    partialFilterExpression: { requestKey: { $type: "string" } },
  },
);

export const AvailabilityModel = model("Availability", availability);
export const ScheduleBlock = model("ScheduleBlock", block);

const scheduleCommit = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, immutable: true },
    requestKey: { type: String, required: true, immutable: true },
    payloadHash: { type: String, required: true, immutable: true },
    blockIds: {
      type: [Schema.Types.ObjectId],
      required: true,
      immutable: true,
    },
  },
  { timestamps: true, collection: "scheduleCommits" },
);
scheduleCommit.index({ userId: 1, requestKey: 1 }, { unique: true });
export const ScheduleCommit = model("ScheduleCommit", scheduleCommit);
