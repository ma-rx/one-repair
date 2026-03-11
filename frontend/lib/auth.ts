import Cookies from "js-cookie";

const ACCESS_KEY  = "ors_access";
const REFRESH_KEY = "ors_refresh";
const USER_KEY    = "ors_user";

export interface AuthUser {
  id: number;
  email: string;
  first_name: string;
  last_name: string;
  role: "ORS_ADMIN" | "CLIENT_ADMIN" | "CLIENT_MANAGER" | "TECH";
  organization: { id: string; name: string } | null;
}

export function getAccessToken(): string | null {
  return Cookies.get(ACCESS_KEY) ?? null;
}

export function setTokens(access: string, refresh: string): void {
  // 1-day access, 30-day refresh — matches backend JWT settings
  Cookies.set(ACCESS_KEY, access, { expires: 1, sameSite: "lax" });
  Cookies.set(REFRESH_KEY, refresh, { expires: 30, sameSite: "lax" });
}

export function setUser(user: AuthUser): void {
  Cookies.set(USER_KEY, JSON.stringify(user), { expires: 1, sameSite: "lax" });
}

export function getUser(): AuthUser | null {
  const raw = Cookies.get(USER_KEY);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

export function clearAuth(): void {
  Cookies.remove(ACCESS_KEY);
  Cookies.remove(REFRESH_KEY);
  Cookies.remove(USER_KEY);
}

export function roleDefaultRoute(role: AuthUser["role"]): string {
  switch (role) {
    case "ORS_ADMIN":      return "/dispatch";
    case "CLIENT_ADMIN":   return "/portal";
    case "CLIENT_MANAGER": return "/portal";
    case "TECH":           return "/tech";
  }
}
