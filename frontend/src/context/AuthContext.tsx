"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import type { User } from "../types";
import { authApi, ApiError } from "../lib/api";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  sessionError: string;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setLoading] = useState(true);
  const [sessionError, setSessionError] = useState("");
  const refreshUser = useCallback(async () => {
    try {
      setUser((await authApi.getMe()).user);
      setSessionError("");
    } catch (error) {
      setUser(null);
      setSessionError(
        error instanceof ApiError && error.status === 401
          ? ""
          : "Your session could not be checked.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    localStorage.removeItem("circleup_token");
    void Promise.resolve().then(refreshUser);
    const expire = () => setUser(null);
    window.addEventListener("circleup:expired", expire);
    return () => window.removeEventListener("circleup:expired", expire);
  }, [refreshUser]);

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: Boolean(user),
        sessionError,
        refreshUser,
        login: async (...args) => {
          setUser((await authApi.login(...args)).user);
          setSessionError("");
        },
        register: async (...args) => {
          setUser((await authApi.register(...args)).user);
          setSessionError("");
        },
        logout: async () => {
          try {
            await authApi.logout();
            setUser(null);
          } catch {
            setSessionError("Sign-out failed. Please try again.");
          }
        },
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth requires AuthProvider");
  return context;
}
