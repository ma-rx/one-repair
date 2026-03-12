import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

const ROLE_ALLOWED: Record<string, string[]> = {
  ORS_ADMIN:      ["/dispatch", "/scan", "/organizations", "/stores", "/assets", "/inventory", "/users", "/kpis"],
  CLIENT_ADMIN:   ["/portal", "/scan"],
  CLIENT_MANAGER: ["/manager"],
  TECH:           ["/tech"],
};

const ROLE_DEFAULTS: Record<string, string> = {
  ORS_ADMIN:      "/dispatch",
  CLIENT_ADMIN:   "/portal",
  CLIENT_MANAGER: "/manager",
  TECH:           "/tech",
};

export function middleware(request: NextRequest) {
  try {
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("ors_access")?.value;
    const isPublic = PUBLIC_PATHS.some((p) => pathname.startsWith(p));

    // Not logged in → redirect to login
    if (!token && !isPublic) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Already logged in → redirect away from login
    if (token && pathname === "/login") {
      let dest = "/dispatch";
      try {
        const raw = request.cookies.get("ors_user")?.value;
        if (raw) {
          const user = JSON.parse(decodeURIComponent(raw));
          dest = ROLE_DEFAULTS[user.role] ?? "/dispatch";
        }
      } catch { /* ignore */ }
      return NextResponse.redirect(new URL(dest, request.url));
    }

    // Role-based access control
    if (token && !isPublic) {
      try {
        const raw = request.cookies.get("ors_user")?.value;
        if (raw) {
          const user = JSON.parse(decodeURIComponent(raw));
          const allowed = ROLE_ALLOWED[user.role] ?? [];
          const hasAccess = allowed.some((p) => pathname.startsWith(p));
          if (!hasAccess) {
            const dest = ROLE_DEFAULTS[user.role] ?? "/login";
            return NextResponse.redirect(new URL(dest, request.url));
          }
        }
      } catch { /* let request through */ }
    }

    return NextResponse.next();
  } catch {
    // Never crash middleware — just let the request through
    return NextResponse.next();
  }
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
