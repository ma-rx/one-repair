"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, AuthUser } from "@/lib/api";
import {
  clearAuth, getAccessToken, getUser, roleDefaultRoute,
  setTokens, setUser,
} from "@/lib/auth";

interface AuthContextType {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [user, setUserState] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Rehydrate from cookie on mount
  useEffect(() => {
    const token = getAccessToken();
    const cached = getUser();
    if (token && cached) {
      setUserState(cached);
      setLoading(false);
    } else if (token) {
      // Token exists but no cached user — fetch from /me
      api.me()
        .then((u) => { setUserState(u); setUser(u); })
        .catch(() => { clearAuth(); })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  async function login(email: string, password: string) {
    const { access, refresh, user: authUser } = await api.login(email, password);
    setTokens(access, refresh);
    setUser(authUser);
    setUserState(authUser);
    router.push(roleDefaultRoute(authUser.role));
  }

  function logout() {
    clearAuth();
    setUserState(null);
    router.push("/login");
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
