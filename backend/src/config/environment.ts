import { z } from "zod";

const environment = z
  .object({
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    MONGODB_URI: z.string().regex(/^mongodb(\+srv)?:\/\//),
    JWT_SECRET: z.string().min(32),
    PORT: z.coerce.number().int().min(1).max(65535).default(5000),
    CLIENT_URL: z.url().default("http://localhost:3000"),
    PASSWORD_RESET_WEBHOOK: z
      .url()
      .refine((value) => new URL(value).protocol === "https:")
      .optional(),
    PASSWORD_RESET_WEBHOOK_SECRET: z.string().min(32).optional(),
  })
  .refine(
    (value) =>
      Boolean(value.PASSWORD_RESET_WEBHOOK) ===
      Boolean(value.PASSWORD_RESET_WEBHOOK_SECRET),
    {
      path: ["PASSWORD_RESET_WEBHOOK"],
      message: "Configure both webhook variables together.",
    },
  );

export function readEnvironment() {
  const parsed = environment.safeParse(process.env);
  if (!parsed.success)
    throw new Error(
      "Invalid environment fields: " +
        parsed.error.issues.map((issue) => issue.path.join(".")).join(", "),
    );
  const config = parsed.data;
  if (
    config.NODE_ENV === "production" &&
    new URL(config.CLIENT_URL).protocol !== "https:"
  ) {
    throw new Error("CLIENT_URL must use HTTPS in production.");
  }
  return config;
}
