import { z } from "zod";
import { ApiError } from "./http.js";

export const objectId = z
  .string()
  .regex(/^[a-f0-9]{24}$/i)
  .transform((id) => id.toLowerCase());
export const instant = z.iso
  .datetime({ offset: true })
  .transform((value) => new Date(value));
export const calendarDate = z.iso.date();
export const timezone = z
  .string()
  .max(100)
  .refine((value) => {
    try {
      return (
        !value.startsWith("+") &&
        !value.startsWith("-") &&
        Boolean(new Intl.DateTimeFormat("en", { timeZone: value }))
      );
    } catch {
      return false;
    }
  }, "Use a valid IANA timezone.");

export function parse<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success)
    throw new ApiError(
      400,
      "VALIDATION_ERROR",
      "The submitted data is invalid.",
      result.error.issues,
    );
  return result.data;
}
export const paging = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional(),
  before: objectId.optional(),
});

export function paged<T extends { _id: { toString(): string } }>(
  list: T[],
  limit?: number,
) {
  if (!limit) return { items: list };
  const items = list.slice(0, limit);
  return {
    items,
    nextCursor: list.length > limit ? items.at(-1)?._id.toString() : null,
  };
}
