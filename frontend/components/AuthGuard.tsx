"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

const PUBLIC_PATHS = ["/login"];

const ROLE_ALLOWED: Record<string, string[]> = {
  ORS_ADMIN:      ["/dispatch", "/scan", "/organizations", "/stores", "/assets", "/inventory", "/users", "/kpis", "/pricing", "/calendar"],
  CLIENT_ADMIN:   ["/portal", "/scan"],
  CLIENT_MANAGER: ["/manager"],
  TECH:           ["/tech", "/scan"],
};

const ROLE_DEFAULTS: Record<string, string> = {
  ORS_ADMIN:      "/dispatch",
  CLIENT_ADMIN:   "/portal",
  CLIENT_MANAGER: "/manager",
  TECH:           "/tech",
};

export default function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;

    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    // Not logged in → go to login
    if (!user && !isPublic) {
      router.replace(`/login?next=${encodeURIComponent(pathname)}`);
      return;
    }

    // Logged in → don't stay on login
    if (user && pathname === "/login") {
      router.replace(ROLE_DEFAULTS[user.role] ?? "/dispatch");
      return;
    }

    // Wrong role → redirect to their home
    if (user && !isPublic) {
      const allowed = ROLE_ALLOWED[user.role] ?? [];
      const hasAccess = allowed.some((p) => pathname.startsWith(p));
      if (!hasAccess) {
        router.replace(ROLE_DEFAULTS[user.role] ?? "/login");
      }
    }
  }, [user, loading, pathname]);

  // Show nothing while auth is resolving to avoid flash
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <>{children}</>;
}
