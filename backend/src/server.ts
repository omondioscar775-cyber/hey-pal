import "dotenv/config";
import { createServer } from "node:http";
import { once } from "node:events";
import mongoose from "mongoose";
import app from "./app.js";
import connectDatabase from "./config/database.js";
import { readEnvironment } from "./config/environment.js";

export async function start() {
  const config = readEnvironment();
  if (config.NODE_ENV === "production")
    process.env.REQUIRE_MANAGED_SESSIONS ??= "true";
  await connectDatabase(config.MONGODB_URI);

  const server = createServer(app);
  try {
    const listening = once(server, "listening");
    server.listen(config.PORT, "0.0.0.0");
    await listening;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    const message =
      code === "EADDRINUSE"
        ? "The port is already in use."
        : code === "EACCES"
          ? "Permission denied while binding the port."
          : "The HTTP listener could not bind.";
    console.error(
      JSON.stringify({
        event: "server_listen_failed",
        port: config.PORT,
        code,
        message,
      }),
    );
    await mongoose.disconnect();
    process.exitCode = 1;
    return;
  }

  console.info(
    JSON.stringify({ event: "server_listening", port: config.PORT }),
  );
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
  server.on("error", (error: NodeJS.ErrnoException) => {
    console.error(
      JSON.stringify({ event: "listener_error", code: error.code }),
    );
    process.exitCode = 1;
    stop();
  });
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
  const name = error instanceof Error ? error.name : undefined;
  console.error(
    JSON.stringify({
      event: "startup_failed",
      configuration,
      type: name,
      message: configuration ?? "Database connection or initialization failed.",
    }),
  );
  await mongoose.disconnect().catch(() => undefined);
  process.exitCode = 1;
});
