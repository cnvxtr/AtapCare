import { useState, useEffect } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Users,
  Wrench,
  Clock,
  Loader2,
} from "lucide-react";
import {
  getAdminRealtimeData,
  getAdminMonthlyData,
  getAdminFrt,
  type AdminRealtimeData,
  type AdminMonthlyData,
  type AdminFrtData,
} from "@/services";
import { PriorityDonut, PriorityLegend } from "@/components/PriorityDonut";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function KpiCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "red" | "green" | "amber";
}) {
  const toneClass =
    tone === "red"
      ? "bg-red-50 text-red-600"
      : tone === "green"
        ? "bg-emerald-50 text-emerald-600"
        : tone === "amber"
          ? "bg-amber-50 text-amber-600"
          : "bg-muted text-muted-foreground";
  return (
    <div className="rounded-xl border border-border bg-card p-5">
      <div className="flex items-center gap-2 mb-1">
        <span className={`h-8 w-8 grid place-items-center rounded-lg ${toneClass}`}>{icon}</span>
        <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {label}
        </span>
      </div>
      <p className="text-3xl font-bold text-foreground mt-3">{value}</p>
    </div>
  );
}

export function AdminDashboard() {
  const [rt, setRt] = useState<AdminRealtimeData | null>(null);
  const [monthly, setMonthly] = useState<AdminMonthlyData | null>(null);
  const [frt, setFrt] = useState<AdminFrtData | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadRealtime() {
    setRt(await getAdminRealtimeData());
    setLoading(false);
  }

  async function loadMonthly() {
    setMonthly(await getAdminMonthlyData());
    setFrt(await getAdminFrt());
  }

  useEffect(() => {
    loadRealtime();
    loadMonthly();
    const id = setInterval(loadRealtime, 60_000);
    return () => clearInterval(id);
  }, []);

  const r = rt || { activeUsers: 0, workOrdersActive: 0, slaOverdue: 0, priorityDist: { P1: 0, P2: 0, P3: 0 } };
  const m = monthly || { ticketsDone: 0, leaderboard: [] };

  const bulanIni = BULAN[new Date().getMonth()];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="User Aktif"
          value={r.activeUsers}
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="Dikerjakan"
          value={r.workOrdersActive}
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tiket Selesai"
          value={m.ticketsDone}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label={`FRT Rata-rata (${bulanIni})`}
          value={frt && frt.responded > 0 ? `${frt.avgHours.toFixed(1)} jam` : "—"}
        />
        <div className="bg-red-600 border border-red-700 rounded-xl p-5 relative overflow-hidden">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> SLA Overdue
              </p>
              <h3 className="text-3xl font-bold text-white mt-2">{r.slaOverdue}</h3>
            </div>
            <span className="p-2 bg-white/20 border border-white/30 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-white" />
            </span>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-xl border border-border bg-card">
          <div className="px-5 py-4 flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                Leaderboard Teknisi ({bulanIni})
              </h3>
            </div>
          </div>
          {m.leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
              <p className="text-xs mt-1">Tidak ada tiket selesai pada periode ini</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {m.leaderboard.map((t, i) => (
                <div key={t.name} className="flex items-center gap-4 px-5 py-3.5">
                  <div
                    className={`h-8 w-8 grid place-items-center rounded-full text-xs font-bold ${
                      i === 0
                        ? "bg-amber-100 text-amber-700"
                        : i === 1
                          ? "bg-muted text-foreground"
                          : i === 2
                            ? "bg-orange-100 text-orange-700"
                            : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{t.name}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {t.completed} tiket · rework {t.rework} ({t.reworkRate}%)
                    </p>
                  </div>
                  <div className="flex-1 max-w-[200px] hidden sm:block">
                    <div className="h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${Math.min(100, (t.completed / (m.leaderboard[0]?.completed || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.5 rounded ${
                      t.reworkRate > 15
                        ? "bg-red-50 text-red-600"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    FTF {100 - t.reworkRate}%
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center">
          <div className="flex items-center justify-between w-full mb-4">
            <h3 className="text-sm font-semibold text-foreground">Distribusi Prioritas</h3>
            <PriorityLegend />
          </div>
          <PriorityDonut p1={r.priorityDist.P1} p2={r.priorityDist.P2} p3={r.priorityDist.P3} />
        </div>
      </div>
    </div>
  );
}
