"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { useAuth } from "../context/AuthContext";
import { apiRequest } from "../lib/api";
import { ErrorState } from "./AppShell";

export default function AuthScreen({
  mode,
}: {
  mode: "login" | "register" | "forgot" | "reset";
}) {
  const { login, register } = useAuth();
  const router = useRouter();
  const [visible, setVisible] = useState(false);
  const [pending, setPending] = useState(false);
  const [notice, setNotice] = useState("");
  const [error, setError] = useState("");
  const creating = mode === "register";
  const recovery = mode === "forgot" || mode === "reset";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const email = String(values.get("email")).trim();
    const password = String(values.get("password"));
    setPending(true);
    setError("");
    try {
      if (recovery) {
        const token =
          new URLSearchParams(window.location.hash.slice(1)).get("token") ??
          new URLSearchParams(window.location.search).get("token");
        const result = await apiRequest<{ message: string }>(
          "/auth/password-reset/" +
            (mode === "forgot" ? "request" : "complete"),
          {
            method: "POST",
            body: JSON.stringify(
              mode === "forgot" ? { email } : { password, token },
            ),
          },
        );
        setNotice(result.message);
        if (mode === "reset")
          window.history.replaceState(null, "", window.location.pathname);
        return;
      }
      if (creating)
        await register(String(values.get("name")).trim(), email, password);
      else await login(email, password);
      router.replace(creating ? "/onboarding" : "/dashboard");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Please try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="auth-page">
      <aside className="auth-aside">
        <Link className="brand" href="/">
          ◉ CircleUp
        </Link>
        <div>
          <h2>From ambition to achievement, together.</h2>
          <p>Make time for what matters. Grow together.</p>
        </div>
      </aside>
      <main className="auth-main">
        <div>
          <h1>
            {recovery
              ? "Password recovery"
              : creating
                ? "Start your journey"
                : "Welcome back"}
          </h1>
          {recovery ? (
            <>
              {error && <ErrorState message={error} />}
              {notice && <p role="status">{notice}</p>}
              {!notice && (
                <form className="form" onSubmit={submit}>
                  {mode === "forgot" ? (
                    <label>
                      Email
                      <input
                        type="email"
                        name="email"
                        required
                        autoComplete="email"
                      />
                    </label>
                  ) : (
                    <label>
                      New password
                      <input
                        type="password"
                        name="password"
                        required
                        minLength={8}
                        maxLength={128}
                        autoComplete="new-password"
                      />
                    </label>
                  )}
                  <button className="button" disabled={pending}>
                    {pending
                      ? "Please wait…"
                      : mode === "forgot"
                        ? "Request reset link"
                        : "Update password"}
                  </button>
                </form>
              )}
              <p>
                <Link className="text-link" href="/login">
                  Back to log in
                </Link>
              </p>
            </>
          ) : (
            <>
              <p>
                {creating
                  ? "Create your CircleUp account to set your first goal."
                  : "Log in to continue to your workspace."}
              </p>
              {error && <ErrorState message={error} />}
              <form className="form" onSubmit={submit}>
                {creating && (
                  <label>
                    Name
                    <input
                      name="name"
                      required
                      minLength={2}
                      maxLength={80}
                      autoComplete="name"
                    />
                  </label>
                )}
                <label>
                  Email
                  <input
                    type="email"
                    name="email"
                    required
                    autoComplete="email"
                  />
                </label>
                <label>
                  Password
                  <input
                    name="password"
                    type={visible ? "text" : "password"}
                    required
                    minLength={creating ? 8 : undefined}
                    maxLength={creating ? 128 : undefined}
                    autoComplete={
                      creating ? "new-password" : "current-password"
                    }
                  />
                </label>
                <div className="row">
                  <button
                    type="button"
                    className="text-link"
                    aria-pressed={visible}
                    onClick={() => setVisible(!visible)}
                  >
                    {visible ? "Hide password" : "Show password"}
                  </button>
                  {!creating && (
                    <Link className="text-link" href="/forgot-password">
                      Forgot password?
                    </Link>
                  )}
                </div>
                <button className="button" disabled={pending}>
                  {pending
                    ? "Please wait…"
                    : creating
                      ? "Create account"
                      : "Log in"}
                </button>
              </form>
              <p>
                {creating ? "Already have an account?" : "New to CircleUp?"}{" "}
                <Link
                  className="text-link"
                  href={creating ? "/login" : "/register"}
                >
                  {creating ? "Log in" : "Create an account"}
                </Link>
              </p>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
