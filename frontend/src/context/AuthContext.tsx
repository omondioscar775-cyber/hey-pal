"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import type { User } from "../types/index";
import { authApi, getToken, removeToken } from "../lib/api";

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refreshUser = async () => {
    const savedToken = getToken();
    if (!savedToken) {
      setUser(null);
      setTokenState(null);
      setIsLoading(false);
      return;
    }

    setTokenState(savedToken);

    try {
      const res = await authApi.getMe();
      if (res.success && res.user) {
        setUser(res.user);
      } else {
        removeToken();
        setUser(null);
        setTokenState(null);
      }
    } catch (err) {
      console.error("Auth check failed:", err);
      removeToken();
      setUser(null);
      setTokenState(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    const savedToken = getToken();

    if (!savedToken) {
      void Promise.resolve().then(() => {
        if (!cancelled) setIsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }

    void authApi
      .getMe()
      .then((res) => {
        if (cancelled) return;
        if (res.success && res.user) {
          setUser(res.user);
          setTokenState(savedToken);
        } else {
          removeToken();
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error("Auth check failed:", err);
        removeToken();
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const login = async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.login(email, password);
      setUser(res.user);
      setTokenState(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const register = async (name: string, email: string, password: string) => {
    setIsLoading(true);
    try {
      const res = await authApi.register(name, email, password);
      setUser(res.user);
      setTokenState(res.token);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    removeToken();
    setUser(null);
    setTokenState(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
