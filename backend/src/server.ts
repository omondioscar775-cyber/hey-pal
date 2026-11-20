import "dotenv/config";
import mongoose from "mongoose";
import app from "./app.js";
import connectDatabase from "./config/database.js";
import { readEnvironment } from "./config/environment.js";

async function start() {
  const config = readEnvironment();
  if (config.NODE_ENV === "production")
    process.env.REQUIRE_MANAGED_SESSIONS ??= "true";
  await connectDatabase(config.MONGODB_URI);
  const server = app.listen(config.PORT, () => {
    console.info(
      JSON.stringify({ event: "server_listening", port: config.PORT }),
    );
  });
  server.on("error", () => {
    console.error(
      JSON.stringify({ event: "server_listen_failed", port: config.PORT }),
    );
    void mongoose.disconnect().finally(() => {
      process.exitCode = 1;
    });
  });
  const stop = () => {
    const limit = setTimeout(() => server.closeAllConnections(), 10_000);
    limit.unref();
    server.close(() => {
      clearTimeout(limit);
      void mongoose.disconnect().catch(() => {
        process.exitCode = 1;
      });
    });
  };
  process.once("SIGINT", stop);
  process.once("SIGTERM", stop);
}

void start().catch(async (error: unknown) => {
  const configuration =
    error instanceof Error &&
    /^(Invalid environment fields:|CLIENT_URL must|A MongoDB replica)/.test(
      error.message,
    )
      ? error.message
      : undefined;
  console.error(JSON.stringify({ event: "startup_failed", configuration }));
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
