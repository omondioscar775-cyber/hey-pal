"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiRequest } from "../lib/api";
import { weekRange } from "../lib/planning";
import { ErrorState } from "./AppShell";

const fields = {
  accomplishments: "What did you accomplish?",
  challenges: "What was difficult?",
  lessons: "What helped you make progress?",
  nextWeekAdjustments: "What would you change next week?",
};
type Review = Record<keyof typeof fields, string> & {
  outcomeEvidence: string[];
};
const empty: Review = {
  accomplishments: "",
  challenges: "",
  lessons: "",
  nextWeekAdjustments: "",
  outcomeEvidence: [],
};

export function WeeklyReview() {
  const [week] = useState(() => weekRange()[0]);
  const [answers, setAnswers] = useState<Review>();
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const endpoint = "/progress/reviews/" + week;

  useEffect(() => {
    let cancelled = false;
    void apiRequest<{ review: Review | null }>(endpoint)
      .then(({ review }) => {
        if (!cancelled) setAnswers(review ?? empty);
      })
      .catch((error: unknown) => {
        if (!cancelled)
          setError(
            error instanceof Error
              ? error.message
              : "Could not load your review.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [endpoint]);

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setNotice("");
    setError("");
    try {
      await apiRequest(endpoint, {
        method: "PUT",
        body: JSON.stringify(answers),
      });
      setNotice("Review saved.");
    } catch (error) {
      setError(
        error instanceof Error ? error.message : "Could not save your review.",
      );
    } finally {
      setPending(false);
    }
  }

  return (
    <section className="card stack">
      <h2>Weekly review</h2>
      {error && <ErrorState message={error} />}
      {notice && <p role="status">{notice}</p>}
      {!answers ? (
        !error && <p role="status">Loading your review…</p>
      ) : (
        <form className="form" onSubmit={save}>
          {Object.entries(fields).map(([key, question]) => (
            <label key={key}>
              {question}
              <textarea
                value={answers[key as keyof typeof fields]}
                maxLength={2000}
                onChange={(event) =>
                  setAnswers({ ...answers, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <button className="button" disabled={pending}>
            {pending ? "Saving…" : "Save Review"}
          </button>
        </form>
      )}
    </section>
  );
}
