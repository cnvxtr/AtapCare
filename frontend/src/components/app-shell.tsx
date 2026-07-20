import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard, Ticket, Package, Users, BarChart3, Settings,
  Bell, Search, Command, ChevronRight,
} from "lucide-react";

const nav = [
  { to: "/app", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { to: "/app/tickets", label: "Tickets", icon: Ticket, badge: "23" },
  { to: "/app/inventory", label: "Inventory", icon: Package, badge: "!" },
  { to: "/app/technicians", label: "Technicians", icon: Users },
  { to: "/app/reports", label: "Reports", icon: BarChart3 },
  { to: "/app/settings", label: "Settings", icon: Settings },
];

export function AppShell({ children, title, subtitle, actions }: {
  children: ReactNode; title: string; subtitle?: string; actions?: ReactNode;
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-card sticky top-0 h-screen">
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="relative">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background grid place-items-center font-display font-bold">
              A
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold tracking-tight">Atap Care</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Ops Console</span>
          </div>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">Workspace</div>
          {nav.map((item) => {
            const active = item.exact ? pathname === item.to : pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
                {item.badge && (
                  <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                    item.badge === "!"
                      ? "bg-destructive text-destructive-foreground pulse-ring"
                      : active ? "bg-background/20 text-background" : "bg-muted text-foreground"
                  }`}>
                    {item.badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="p-3 border-t border-border">
          <div className="glass rounded-xl p-3 relative overflow-hidden">
            <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-foreground/5 blur-2xl" />
            <div className="flex items-center gap-2 mb-1">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-xs font-bold">
                KS
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate">Kustiara</p>
                <p className="text-[10px] text-muted-foreground">Helpdesk</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="h-full px-6 flex items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest">/ Atap Care</span>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium truncate">{title}</span>
            </div>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card w-72 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="flex-1">Cari tiket, SN, teknisi…</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted flex items-center gap-0.5">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </div>
            <button className="relative h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent transition">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive pulse-ring" />
            </button>
          </div>
        </header>

        {/* Page header */}
        <div className="px-6 pt-8 pb-6 border-b border-border bg-gradient-to-b from-card to-background">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">{title}</h1>
              {subtitle && <p className="text-sm text-muted-foreground mt-1.5">{subtitle}</p>}
            </div>
            {actions}
          </div>
        </div>

        <main className="p-6 flex-1">{children}</main>
      </div>
    </div>
  );
}
