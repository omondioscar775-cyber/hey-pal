"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "../context/AuthContext";

export default function Navbar() {
  const { user, isAuthenticated, logout } = useAuth();
  const pathname = usePathname();

  const navLinks = [
    { label: "Dashboard", href: "/" },
    { label: "Goals & Roadmaps", href: "/goals" },
    { label: "Tasks", href: "/tasks" },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-zinc-200/80 bg-white/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-[72px] flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-8">
          <Link href="/" className="flex items-center gap-2 group">
            <div className="w-10 h-10 rounded-[13px] bg-[#5b5ce2] flex items-center justify-center text-white shadow-[0_8px_18px_rgba(91,92,226,.22)] group-hover:scale-105 transition-transform">
              <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2.2">
                <circle cx="12" cy="12" r="7" />
                <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
              </svg>
            </div>
            <span className="font-bold text-xl tracking-[-0.03em] text-zinc-900">
              CircleUp
            </span>
          </Link>

          {/* Navigation Links */}
          {isAuthenticated && (
            <nav className="hidden md:flex items-center gap-1">
              {navLinks.map((link) => {
                const isActive = pathname === link.href;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`px-3.5 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? "bg-indigo-50 text-indigo-700"
                        : "text-[#6f7480] hover:text-[#20212a] hover:bg-zinc-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                );
              })}
            </nav>
          )}
        </div>

        {/* Right side controls */}
        <div className="flex items-center gap-3">
          {isAuthenticated ? (
            <div className="flex items-center gap-4">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-sm font-semibold text-zinc-900 dark:text-zinc-100 leading-tight">
                  {user?.name}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  {user?.email}
                </span>
              </div>
              <button
                onClick={logout}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-semibold text-[#343741] hover:text-[#5b5ce2] transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-sm transition-colors"
              >
                Get Started
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
