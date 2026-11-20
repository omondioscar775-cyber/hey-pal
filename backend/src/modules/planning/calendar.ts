export type Window = { day: number; start: number; end: number };
export type Interval = { startAt: Date; endAt: Date };
export type Availability = {
  timezone: string;
  weeklyWindows: Window[];
  closedDates: string[];
};
const minute = 60_000;

export function overlaps(a: Interval, b: Interval) {
  return a.startAt < b.endAt && b.startAt < a.endAt;
}

export function availableIntervals(
  config: Availability,
  range: Interval,
  reserved: Interval[],
): Interval[] {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone: config.timezone,
    weekday: "short",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const windows = weekdays.map((_day, index) =>
    config.weeklyWindows.filter((window) => window.day === index),
  );
  const closed = new Set(config.closedDates);
  const busy = [...reserved].sort(
    (a, b) => a.startAt.getTime() - b.startAt.getTime(),
  );
  const free: Interval[] = [];
  let blocked = 0;
  let start: number | undefined;
  let cursor = Math.ceil(range.startAt.getTime() / minute) * minute;
  for (; cursor + minute <= range.endAt.getTime(); cursor += minute) {
    while (busy[blocked] && busy[blocked].endAt.getTime() <= cursor) blocked++;
    let open =
      !busy[blocked] || busy[blocked].startAt.getTime() >= cursor + minute;
    if (open) {
      const parts = Object.fromEntries(
        formatter.formatToParts(cursor).map(({ type, value }) => [type, value]),
      );
      const localMinute = Number(parts.hour) * 60 + Number(parts.minute);
      open =
        !closed.has(parts.year + "-" + parts.month + "-" + parts.day) &&
        windows[weekdays.indexOf(parts.weekday)].some(
          (window) => window.start <= localMinute && window.end > localMinute,
        );
    }
    if (open) start ??= cursor;
    else if (start !== undefined) {
      free.push({ startAt: new Date(start), endAt: new Date(cursor) });
      start = undefined;
    }
  }
  if (start !== undefined)
    free.push({ startAt: new Date(start), endAt: new Date(cursor) });
  return free;
}
