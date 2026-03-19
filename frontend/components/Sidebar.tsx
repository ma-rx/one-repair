"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import {
  Wrench,
  ClipboardList,
  Package,
  BarChart3,
  Settings,
  Bell,
  LogOut,
  QrCode,
  Building2,
  MapPin,
  Cpu,
  Users,
  CalendarDays,
  BookOpen,
  Tag,
} from "lucide-react";

const orsNav = [
  { label: "New Ticket",     href: "/scan",             icon: QrCode       },
  { label: "Dispatch",       href: "/dispatch",         icon: ClipboardList },
  { label: "Calendar",       href: "/calendar",         icon: CalendarDays },
  { label: "Parts Needed",   href: "/dispatch/parts",   icon: Package      },
  { label: "Organizations",  href: "/organizations",    icon: Building2    },
  { label: "Stores",         href: "/stores",           icon: MapPin       },
  { label: "Equipment",      href: "/equipment",        icon: Wrench       },
  { label: "Assets",         href: "/assets",           icon: Cpu          },
  { label: "Inventory",      href: "/inventory",        icon: Package      },
  { label: "Users",          href: "/users",            icon: Users        },
  { label: "Knowledge Base", href: "/knowledge",        icon: BookOpen     },
  { label: "Codes",          href: "/codes",            icon: Tag          },
  { label: "KPIs",           href: "/kpis",             icon: BarChart3    },
];

const clientNav = [
  { label: "New Ticket", href: "/scan",     icon: QrCode       },
  { label: "Dispatch",   href: "/dispatch", icon: ClipboardList },
  { label: "Stores",     href: "/stores",   icon: MapPin       },
  { label: "Assets",     href: "/assets",   icon: Cpu          },
  { label: "Inventory",  href: "/inventory", icon: Package     },
  { label: "KPIs",       href: "/kpis",     icon: BarChart3    },
];

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const nav = user?.role === "ORS_ADMIN" ? orsNav : clientNav;
  const initials = user
    ? `${user.first_name?.[0] ?? ""}${user.last_name?.[0] ?? ""}`.toUpperCase() || "?"
    : "?";

  return (
    <aside className="fixed inset-y-0 left-0 w-64 bg-slate-900 flex flex-col z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-6 py-5 border-b border-slate-700/60">
        <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500">
          <Wrench className="w-5 h-5 text-white" />
        </div>
        <div>
          <p className="text-white font-semibold text-sm leading-tight">One Repair</p>
          <p className="text-slate-400 text-xs">Solutions</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        <p className="text-slate-500 text-xs font-medium uppercase tracking-wider px-3 py-2">
          Main Menu
        </p>
        {nav.map(({ label, href, icon: Icon }) => {
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
      <div className="px-3 py-4 border-t border-slate-700/60 space-y-0.5">
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
          <Bell className="w-4.5 h-4.5 shrink-0" />
          Notifications
        </button>
        <button className="flex items-center gap-3 w-full px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-slate-800 hover:text-slate-100 transition-colors">
          <Settings className="w-4.5 h-4.5 shrink-0" />
          Settings
        </button>
        <div className="flex items-center gap-3 px-3 py-3 mt-1">
          <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-slate-200 text-xs font-medium truncate">
              {user ? `${user.first_name} ${user.last_name}`.trim() || user.email : "—"}
            </p>
            <p className="text-slate-500 text-xs truncate">{user?.role ?? ""}</p>
          </div>
          <button onClick={logout} className="text-slate-500 hover:text-slate-300" title="Sign out">
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
