"use client";

import { useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { ErrorState } from "./AppShell";

type Availability = {
  timezone: string;
  weeklyWindows: { day: number; start: number; end: number }[];
  closedDates: string[];
};
const days = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];
const displayTime = (minute: number) =>
  String(Math.floor(minute / 60)).padStart(2, "0") +
  ":" +
  String(minute % 60).padStart(2, "0");
const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

export function AvailabilityEditor() {
  const [draft, setDraft] = useState<Availability>();
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  async function load() {
    setPending(true);
    setError("");
    try {
      const result = await apiRequest<{ availability: Availability | null }>(
        "/planner/availability",
      );
      setDraft(
        result.availability ?? {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          weeklyWindows: [],
          closedDates: [],
        },
      );
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not load availability.",
      );
    } finally {
      setPending(false);
    }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setMessage("");
    setPending(true);
    try {
      const result = await apiRequest<{ availability: Availability }>(
        "/planner/availability",
        {
          method: "PUT",
          body: JSON.stringify(draft),
        },
      );
      setDraft(result.availability);
      setMessage("Availability saved.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save availability.",
      );
    } finally {
      setPending(false);
    }
  }
  return (
    <section className="card stack">
      <h2>Schedule availability</h2>
      {error && <ErrorState message={error} />}
      {message && <p role="status">{message}</p>}
      {!draft ? (
        <button
          className="button secondary"
          disabled={pending}
          onClick={() => void load()}
        >
          Edit availability
        </button>
      ) : (
        <form className="form" onSubmit={save}>
          <label>
            IANA timezone
            <input
              required
              value={draft.timezone}
              onChange={(event) =>
                setDraft({ ...draft, timezone: event.target.value })
              }
            />
          </label>
          {draft.weeklyWindows.map((slot, index) => {
            const update = (patch: Partial<typeof slot>) =>
              setDraft({
                ...draft,
                weeklyWindows: draft.weeklyWindows.map((item, position) =>
                  position === index ? { ...item, ...patch } : item,
                ),
              });
            return (
              <fieldset className="form" key={index}>
                <legend>Availability window {index + 1}</legend>
                <label>
                  Day
                  <select
                    value={slot.day}
                    onChange={(event) =>
                      update({ day: Number(event.target.value) })
                    }
                  >
                    {days.map((day, index) => (
                      <option key={day} value={index}>
                        {day}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Start
                  <input
                    type="time"
                    required
                    value={displayTime(slot.start)}
                    onChange={(event) =>
                      update({ start: toMinutes(event.target.value) })
                    }
                  />
                </label>
                <label>
                  End
                  <select
                    value={slot.end === 1440 ? "midnight" : "time"}
                    onChange={(event) =>
                      update({
                        end: event.target.value === "midnight" ? 1440 : 1020,
                      })
                    }
                  >
                    <option value="time">Choose time</option>
                    <option value="midnight">End of day</option>
                  </select>
                </label>
                {slot.end < 1440 && (
                  <label>
                    End time
                    <input
                      type="time"
                      required
                      value={displayTime(slot.end)}
                      onChange={(event) =>
                        update({ end: toMinutes(event.target.value) })
                      }
                    />
                  </label>
                )}
                <button
                  type="button"
                  className="button secondary"
                  onClick={() =>
                    setDraft({
                      ...draft,
                      weeklyWindows: draft.weeklyWindows.filter(
                        (_, position) => position !== index,
                      ),
                    })
                  }
                >
                  Remove window
                </button>
              </fieldset>
            );
          })}
          <button
            type="button"
            className="button secondary"
            disabled={draft.weeklyWindows.length >= 70}
            onClick={() =>
              setDraft({
                ...draft,
                weeklyWindows: [
                  ...draft.weeklyWindows,
                  { day: 1, start: 540, end: 1020 },
                ],
              })
            }
          >
            Add window
          </button>
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Save availability"}
          </button>
        </form>
      )}
    </section>
  );
}
