import { createFileRoute, Link } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { AppShell } from "@/components/app-shell";
import { ArrowUpRight, ArrowDownRight, Minus, Filter, Download, Plus } from "lucide-react";
import { getTickets, kpiData, workloadData, trendData, statusColors, priorityColors, type Ticket } from "@/services";

export const Route = createFileRoute("/app/")({
  head: () => ({ meta: [{ title: "Dashboard — Atap Care" }] }),
  component: Dashboard,
});

function Dashboard() {
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getTickets().then((data) => {
      setTickets(data);
      setLoading(false);
    });
  }, []);

  const active = tickets.filter((t) => !["Closed", "Rejected"].includes(t.status)).slice(0, 5);
  const maxWorkload = Math.max(...workloadData.map((w) => w.tickets));

  if (loading) {
    return (
      <AppShell title="Command Center" subtitle="Memuat data…">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="rounded-2xl border border-border bg-card p-5 animate-pulse">
              <div className="h-3 w-20 bg-muted rounded" />
              <div className="h-8 w-16 bg-muted rounded mt-3" />
              <div className="h-3 w-12 bg-muted rounded mt-3" />
            </div>
          ))}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell
      title="Command Center"
      subtitle="Jumat, 17 Juli 2026 · Snapshot 7 hari terakhir"
      actions={
        <div className="flex items-center gap-2">
          <button className="px-3 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-1.5 hover:bg-accent transition">
            <Filter className="h-3.5 w-3.5" /> Filter
          </button>
          <button className="px-3 py-2 rounded-lg border border-border text-sm inline-flex items-center gap-1.5 hover:bg-accent transition">
            <Download className="h-3.5 w-3.5" /> Export
          </button>
          <Link to="/app/tickets" className="px-3 py-2 rounded-lg bg-foreground text-background text-sm inline-flex items-center gap-1.5 hover:bg-foreground/90 transition">
            <Plus className="h-3.5 w-3.5" /> Tiket Manual
          </Link>
        </div>
      }
    >
      {/* KPI grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpiData.map((k) => {
          const TrendIcon = k.trend === "up" ? ArrowUpRight : k.trend === "down" ? ArrowDownRight : Minus;
          const positive = (k.trend === "up" && !k.label.includes("Resolution")) || (k.trend === "down" && k.label.includes("Resolution"));
          return (
            <div key={k.label} className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
              <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
              <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">{k.label}</p>
              <p className="text-4xl font-display font-bold mt-2 tracking-tight">{k.value}</p>
              <div className={`mt-3 inline-flex items-center gap-1 text-xs font-medium ${
                positive ? "text-success" : k.trend === "flat" ? "text-muted-foreground" : "text-destructive"
              }`}>
                <TrendIcon className="h-3 w-3" /> {k.delta}
              </div>
            </div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-3 gap-4 mt-4">
        {/* Trend chart */}
        <div className="lg:col-span-2 rounded-2xl border border-border bg-card p-6">
          <div className="flex items-start justify-between mb-6">
            <div>
              <h3 className="font-display font-bold">Volume Tiket — 7 Hari</h3>
              <p className="text-xs text-muted-foreground mt-0.5">Open vs Resolved harian</p>
            </div>
            <div className="flex items-center gap-3 text-xs">
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground" /> Open</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Resolved</span>
            </div>
          </div>
          <TrendChart />
        </div>

        {/* Workload */}
        <div className="rounded-2xl border border-border bg-card p-6">
          <h3 className="font-display font-bold">Beban Teknisi</h3>
          <p className="text-xs text-muted-foreground mt-0.5 mb-5">Tiket aktif per orang</p>
          <div className="space-y-3">
            {workloadData.map((w) => (
              <div key={w.name}>
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-medium">{w.name}</span>
                  <span className="font-mono text-muted-foreground">{w.tickets}</span>
                </div>
                <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-foreground rounded-full transition-all"
                    style={{ width: `${(w.tickets / maxWorkload) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Active tickets */}
      <div className="mt-4 rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-6 flex items-center justify-between border-b border-border">
          <div>
            <h3 className="font-display font-bold">Tiket Aktif Terkini</h3>
            <p className="text-xs text-muted-foreground mt-0.5">Butuh perhatian segera</p>
          </div>
          <Link to="/app/tickets" className="text-xs font-medium hover:underline inline-flex items-center gap-1">
            Lihat semua <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <div className="divide-y divide-border">
          {active.map((t) => (
            <div key={t.id} className="grid grid-cols-12 items-center gap-3 px-6 py-3.5 hover:bg-accent/40 transition group">
              <div className="col-span-3 min-w-0">
                <p className="font-mono text-[10px] text-muted-foreground">{t.code}</p>
                <p className="text-sm font-medium truncate">{t.equipment}</p>
              </div>
              <div className="col-span-3 min-w-0">
                <p className="text-sm truncate">{t.customer}</p>
                <p className="text-xs text-muted-foreground truncate">{t.company} · {t.location}</p>
              </div>
              <div className="col-span-1">
                <span className={`inline-block text-[10px] font-mono px-1.5 py-0.5 rounded ${priorityColors[t.priority]}`}>
                  {t.priority}
                </span>
              </div>
              <div className="col-span-2">
                <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-2 py-1 rounded border ${statusColors[t.status]}`}>
                  {t.slaPaused && <span className="h-1 w-1 rounded-full bg-warning" />}
                  {t.status}
                </span>
              </div>
              <div className="col-span-2 text-xs text-muted-foreground">
                {t.assignee || <span className="italic">Belum di-assign</span>}
              </div>
              <div className="col-span-1 text-right opacity-0 group-hover:opacity-100 transition">
                <ArrowUpRight className="h-4 w-4 inline" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}

function TrendChart() {
  const w = 600, h = 200, pad = 20;
  const max = Math.max(...trendData.flatMap((d) => [d.open, d.resolved]));
  const x = (i: number) => pad + (i * (w - pad * 2)) / (trendData.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);

  const line = (key: "open" | "resolved") =>
    trendData.map((d, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(d[key])}`).join(" ");

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56">
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)}
                stroke="currentColor" strokeOpacity="0.06" />
        ))}
        <path d={`${line("open")} L${x(trendData.length - 1)},${h - pad} L${x(0)},${h - pad} Z`}
              fill="currentColor" opacity="0.08" />
        <path d={line("open")} fill="none" stroke="currentColor" strokeWidth="2" />
        <path d={line("resolved")} fill="none" stroke="currentColor" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.5" />
        {trendData.map((d, i) => (
          <g key={i}>
            <circle cx={x(i)} cy={y(d.open)} r="3" fill="currentColor" />
            <text x={x(i)} y={h - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.5">{d.day}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
