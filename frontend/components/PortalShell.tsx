"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Wrench,
  ClipboardList,
  MapPin,
  Cpu,
  FileText,
  LogOut,
  BarChart2,
  Package,
} from "lucide-react";

const portalNav = [
  { label: "New Ticket",      href: "/scan",            icon: Wrench        },
  { label: "Tickets",         href: "/portal/tickets",  icon: ClipboardList },
  { label: "Parts Approval",  href: "/portal/parts",    icon: Package       },
  { label: "Stores",          href: "/portal/stores",   icon: MapPin        },
  { label: "Assets",          href: "/portal/assets",   icon: Cpu           },
  { label: "Invoices",        href: "/portal/invoices", icon: FileText      },
  { label: "Analytics",       href: "/portal/kpis",     icon: BarChart2     },
];

export default function PortalShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  return (
    <div className="min-h-screen bg-slate-100">
      <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-10">
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
          <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500">
            <Wrench className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="text-white font-semibold text-sm leading-tight">One Repair</p>
            <p className="text-slate-400 text-xs">{user?.organization?.name ?? "Client Portal"}</p>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-0.5">
          <p className="text-slate-500 text-xs font-medium uppercase tracking-wider px-3 py-2">
            Main Menu
          </p>
          {portalNav.map(({ label, href, icon: Icon }) => {
            const active = pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? "bg-blue-500/20 text-blue-400"
                    : "text-slate-400 hover:bg-slate-800 hover:text-slate-100"
                }`}
              >
                <Icon className="w-4.5 h-4.5 shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* Bottom */}
        <div className="px-3 py-4 border-t border-slate-700/60">
          <div className="flex items-center gap-3 px-3 py-3">
            <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
              {initials}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-slate-200 text-xs font-medium truncate">
                {user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "—"}
              </p>
              <p className="text-slate-500 text-xs truncate">Client Admin</p>
            </div>
            <button onClick={logout} className="text-slate-500 hover:text-slate-300" title="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      <div className="pl-64">
        <main className="p-8">{children}</main>
      </div>
    </div>
  );
}
