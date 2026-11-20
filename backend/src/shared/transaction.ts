import mongoose, { type ClientSession } from "mongoose";
import User from "../models/User.js";
import { ApiError } from "./http.js";

mongoose.set("transactionAsyncLocalStorage", true);

// Taking the same write lock before reading shared state prevents snapshot write skew.
export function ownedTransaction<T>(
  userId: string,
  operation: (session: ClientSession) => Promise<T>,
) {
  return mongoose.connection.transaction(async (session) => {
    const lock = await User.updateOne(
      { _id: userId },
      { $inc: { workspaceRevision: 1 } },
      { session, timestamps: false },
    );
    if (!lock.matchedCount)
      throw new ApiError(404, "ACCOUNT_UNAVAILABLE", "Account unavailable.");
    return operation(session);
  });
}
