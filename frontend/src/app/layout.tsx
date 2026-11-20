import type { Metadata } from "next";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "CircleUp - Goal, Roadmap & Task Tracker",
  description: "Achieve your goals with structured roadmaps and actionable daily tasks.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-[#f4f6f8] text-[#181a20] antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
