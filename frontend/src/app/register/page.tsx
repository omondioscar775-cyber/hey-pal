"use client";

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import Navbar from "../../components/Navbar";

export default function RegisterPage() {
  const router = useRouter();
  const { register } = useAuth();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await register(name, email, password);
      router.push("/");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Registration failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col app-shell">
      <Navbar />

      <main className="relative flex-1 flex items-center justify-center p-4 py-10 overflow-hidden">
        <div className="absolute inset-0 hero-grid opacity-60 pointer-events-none" />
        <div className="relative w-full max-w-md surface-card rounded-[24px] p-8 sm:p-10 shadow-[0_24px_70px_rgba(32,35,48,.10)]">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-[#20212a]">
              Create your account
            </h1>
            <p className="text-sm text-[#777b87] mt-1">
              Start turning your big ambitions into actionable milestones
            </p>
          </div>

          {error && (
            <div className="mb-4 p-3 text-sm rounded-xl bg-red-50 dark:bg-red-950/40 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#555861] uppercase tracking-wider mb-1">
                Full Name
              </label>
              <input
                type="text"
                required
                placeholder="Alex Morgan"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dfe2e8] bg-[#f8f9fb] text-[#252731] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#555861] uppercase tracking-wider mb-1">
                Email Address
              </label>
              <input
                type="email"
                required
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dfe2e8] bg-[#f8f9fb] text-[#252731] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#555861] uppercase tracking-wider mb-1">
                Password (min 8 characters)
              </label>
              <input
                type="password"
                required
                minLength={8}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-[#dfe2e8] bg-[#f8f9fb] text-[#252731] focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-sm shadow-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Creating account..." : "Sign Up"}
            </button>
          </form>

          <div className="mt-6 text-center text-xs text-zinc-500">
            Already have an account?{" "}
            <Link
              href="/login"
              className="font-semibold text-indigo-600 dark:text-indigo-400 hover:underline"
            >
              Sign in
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
