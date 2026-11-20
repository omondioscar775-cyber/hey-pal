const day = 86_400_000;

const dayFormatter = (timezone: string) =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });

export function localDate(
  at: Date,
  timezone: string,
  formatter = dayFormatter(timezone),
) {
  const parts = Object.fromEntries(
    formatter.formatToParts(at).map(({ type, value }) => [type, value]),
  );
  return parts.year + "-" + parts.month + "-" + parts.day;
}

export function startOfLocalDate(date: string, timezone: string) {
  const center = Date.parse(date);
  const formatter = dayFormatter(timezone);
  let low = center - 2 * day;
  let high = center + 2 * day;
  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (localDate(new Date(mid), timezone, formatter) < date) low = mid + 1;
    else high = mid;
  }
  return new Date(low);
}

export function addCalendarDays(date: string, count: number) {
  return new Date(Date.parse(date) + count * day).toISOString().slice(0, 10);
}
