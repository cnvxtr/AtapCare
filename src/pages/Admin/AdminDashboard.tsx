import { useState, useEffect } from "react";
import {
  Building2,
  Users,
  Wrench,
  Clock,
} from "lucide-react";
import { motion } from "framer-motion";
import {
  getAdminSystemData,
  getAdminMonthlyData,
  getAdminFrt,
  type AdminSystemData,
  type AdminMonthlyData,
  type AdminFrtData,
} from "@/services";
import AnimatedNumber from "@/components/AnimatedNumber";

const BULAN = [
  "Januari", "Februari", "Maret", "April", "Mei", "Juni",
  "Juli", "Agustus", "September", "Oktober", "November", "Desember",
];

function KpiCard({
  icon,
  label,
  value,
  tone = "muted",
  decimals = 0,
  suffix,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  tone?: "red" | "green" | "amber" | "muted";
  decimals?: number;
  suffix?: string;
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
      <p className="text-3xl font-bold text-foreground mt-3">
        {typeof value === "number" ? <AnimatedNumber value={value} decimals={decimals} /> : value}
        {typeof value === "number" && suffix && (
          <span className="text-base font-medium text-muted-foreground">{suffix}</span>
        )}
      </p>
    </div>
  );
}

export function AdminDashboard() {
  const [data, setData] = useState<AdminSystemData | null>(null);
  const [monthly, setMonthly] = useState<AdminMonthlyData | null>(null);
  const [frt, setFrt] = useState<AdminFrtData | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      const [d, m, f] = await Promise.all([
        getAdminSystemData(),
        getAdminMonthlyData(),
        getAdminFrt(),
      ]);
      if (active) {
        setData(d);
        setMonthly(m);
        setFrt(f);
      }
    }
    load();
    const id = setInterval(load, 60_000);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, []);

  const d = data || { totalUsers: 0, totalCustomers: 0, totalUnits: 0, unitDist: [] };
  const m = monthly || { ticketsDone: 0, leaderboard: [] };
  const bulanIni = BULAN[new Date().getMonth()];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="Total Pengguna Sistem"
          value={d.totalUsers}
        />
        <KpiCard
          icon={<Building2 className="h-4 w-4" />}
          label="Total Pelanggan"
          value={d.totalCustomers}
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="Total Unit Aktif"
          value={d.totalUnits}
        />
        <KpiCard
          icon={<Clock className="h-4 w-4" />}
          label={`FRT Helpdesk (${bulanIni})`}
          value={frt && frt.responded > 0 ? frt.avgHours : "—"}
          decimals={1}
          suffix=" jam"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Unit per Site
          </h3>
        </div>
        {d.unitDist.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Building2 className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">Belum ada data</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[21rem] overflow-y-auto scrollbar-transparent">
            {d.unitDist.map((s, i) => (
              <div key={s.name} className="flex items-center gap-3 px-5 py-3">
                <span className={`w-6 text-xs font-bold ${i === 0 ? "text-amber-600" : "text-muted-foreground"}`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-sm font-medium text-foreground truncate">{s.name}</p>
                    <span className="text-xs font-bold text-muted-foreground ml-2">{s.count}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(100, (s.count / (d.unitDist[0]?.count || 1)) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 * i }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-xl border border-border bg-card">
        <div className="px-5 py-4">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Wrench className="h-4 w-4" /> Leaderboard Teknisi ({bulanIni})
          </h3>
        </div>
        {m.leaderboard.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
            <Clock className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium">Belum ada data</p>
            <p className="text-xs mt-1">Tidak ada tiket selesai pada periode ini</p>
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[21rem] overflow-y-auto scrollbar-transparent">
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
                <p className="text-sm font-semibold text-foreground truncate flex-1">{t.name}</p>
                <span className="text-xs font-bold text-muted-foreground">{t.completed} tiket</span>
              </div>
            ))}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}
