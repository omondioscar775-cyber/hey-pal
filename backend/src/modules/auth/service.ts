import type { ClientSession } from "mongoose";
import { createHash, randomBytes } from "node:crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { z } from "zod";
import type { Request, Response } from "express";
import { AuthSession, PasswordReset } from "./models.js";
import User from "../../models/User.js";
import { ApiError } from "../../shared/http.js";
import { parse } from "../../shared/validation.js";
import { ownedTransaction } from "../../shared/transaction.js";

const lifetime = 7 * 24 * 60 * 60;
export const password = z
  .string()
  .min(8)
  .max(128)
  .refine(
    (value) => Buffer.byteLength(value, "utf8") <= 72,
    "Password must fit within bcrypt's 72-byte limit.",
  );
const hash = (value: string) =>
  createHash("sha256").update(value).digest("hex");

export async function issueToken(
  userId: string,
  credentialStamp?: Date,
  databaseSession?: ClientSession,
) {
  const secret = process.env.JWT_SECRET;
  if (!secret)
    throw new ApiError(
      503,
      "AUTH_UNAVAILABLE",
      "Authentication is unavailable.",
    );
  const session = await new AuthSession({
    userId,
    credentialStamp,
    expiresAt: new Date(Date.now() + lifetime * 1000),
  }).save({ session: databaseSession });
  return jwt.sign({ userId }, secret, {
    algorithm: "HS256",
    expiresIn: lifetime,
    jwtid: session.id,
  });
}

export async function logout(req: Request, res: Response) {
  if (req.sessionId)
    await AuthSession.updateOne(
      { _id: req.sessionId, userId: req.userId },
      { revokedAt: new Date() },
    );
  res.json({ success: true });
}

export async function requestReset(req: Request, res: Response) {
  const { email } = parse(
    z.object({ email: z.email().trim().toLowerCase() }),
    req.body,
  );
  const endpoint = process.env.PASSWORD_RESET_WEBHOOK;
  const webhookSecret = process.env.PASSWORD_RESET_WEBHOOK_SECRET;
  if (!endpoint || !webhookSecret)
    throw new ApiError(
      503,
      "RESET_UNAVAILABLE",
      "Password reset delivery is unavailable.",
    );
  const user = await User.findOne({
    email,
    accountStatus: { $nin: ["suspended", "deleted"] },
  });
  if (user) {
    const token = randomBytes(32).toString("hex");
    const record = await PasswordReset.create({
      userId: user._id,
      tokenHash: hash(token),
      expiresAt: new Date(Date.now() + 30 * 60_000),
    });
    try {
      const result = await fetch(endpoint, {
        method: "POST",
        redirect: "error",
        signal: AbortSignal.timeout(5000),
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + webhookSecret,
        },
        body: JSON.stringify({ email, token, expiresAt: record.expiresAt }),
      });
      if (!result.ok) throw new Error("Delivery rejected");
    } catch {
      await PasswordReset.deleteOne({ _id: record._id });
      console.error(
        JSON.stringify({ event: "password_reset_delivery_failed" }),
      );
    }
  }
  res.status(202).json({
    success: true,
    message:
      "If the account can receive mail, reset instructions will be sent.",
  });
}

export async function completeReset(req: Request, res: Response) {
  const input = parse(
    z.object({ token: z.string().regex(/^[a-f0-9]{64}$/), password }),
    req.body,
  );
  const filter = {
    tokenHash: hash(input.token),
    expiresAt: { $gt: new Date() },
  };
  const existing = await PasswordReset.findOne(filter);
  if (!existing)
    throw new ApiError(
      400,
      "INVALID_RESET",
      "This password reset is invalid or expired.",
    );
  const passwordHash = await bcrypt.hash(input.password, 12);
  await ownedTransaction(existing.userId.toString(), async (session) => {
    const reset = await PasswordReset.findOneAndDelete(
      { ...filter, expiresAt: { $gt: new Date() } },
      { session },
    );
    if (!reset)
      throw new ApiError(
        400,
        "INVALID_RESET",
        "This password reset is invalid or expired.",
      );
    await User.updateOne(
      { _id: reset.userId },
      { password: passwordHash, credentialsChangedAt: new Date() },
      { session },
    );
    await AuthSession.updateMany(
      { userId: reset.userId, revokedAt: { $exists: false } },
      { revokedAt: new Date() },
      { session },
    );
    await PasswordReset.deleteMany({ userId: reset.userId }, { session });
  });
  res.json({
    success: true,
    message: "Password updated. Please sign in again.",
  });
}
