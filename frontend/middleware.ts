import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const PUBLIC_PATHS = ["/login"];

// Routes that each role is allowed to access (prefix match)
const ROLE_ALLOWED: Record<string, string[]> = {
  ORS_ADMIN:      ["/dispatch", "/scan", "/organizations", "/stores", "/assets", "/inventory", "/kpis"],
  CLIENT_ADMIN:   ["/portal", "/scan"],
  CLIENT_MANAGER: ["/manager"],
  TECH:           ["/tech"],
};

export function middleware(request: NextRequest) {
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
        const user = JSON.parse(raw);
        const defaults: Record<string, string> = {
          ORS_ADMIN: "/dispatch",
          CLIENT_ADMIN: "/portal",
          CLIENT_MANAGER: "/manager",
          TECH: "/tech",
        };
        dest = defaults[user.role] ?? "/dispatch";
      }
    } catch {/* ignore */}
    return NextResponse.redirect(new URL(dest, request.url));
  }

  // Role-based access control
  if (token && !isPublic) {
    try {
      const raw = request.cookies.get("ors_user")?.value;
      if (raw) {
        const user = JSON.parse(raw);
        const allowed = ROLE_ALLOWED[user.role] ?? [];
        const hasAccess = allowed.some((p) => pathname.startsWith(p));
        if (!hasAccess) {
          const defaults: Record<string, string> = {
            ORS_ADMIN: "/dispatch",
            CLIENT_ADMIN: "/portal",
            CLIENT_MANAGER: "/manager",
            TECH: "/tech",
          };
          const dest = defaults[user.role] ?? "/login";
          return NextResponse.redirect(new URL(dest, request.url));
        }
      }
    } catch {/* ignore — let request through if cookie malformed */}
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.png$).*)"],
};
