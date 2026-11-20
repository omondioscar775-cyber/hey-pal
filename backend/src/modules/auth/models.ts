import { model, Schema } from "mongoose";

const session = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: Date,
    credentialStamp: Date,
  },
  { timestamps: true },
);
session.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const reset = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, required: true, index: true },
    tokenHash: { type: String, required: true, unique: true, select: false },
    expiresAt: { type: Date, required: true },
  },
  { timestamps: true },
);
reset.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const AuthSession = model("AuthSession", session);
export const PasswordReset = model("PasswordReset", reset);
