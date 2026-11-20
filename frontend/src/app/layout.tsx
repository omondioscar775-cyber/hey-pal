import type { Metadata } from "next";
import "@fontsource-variable/inter";
import "./globals.css";
import { AuthProvider } from "../context/AuthContext";

export const metadata: Metadata = {
  title: "CircleUp | From Ambition to Achievement",
  description:
    "Build realistic plans, focus on what matters, and find your way forward when plans change.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full antialiased">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
