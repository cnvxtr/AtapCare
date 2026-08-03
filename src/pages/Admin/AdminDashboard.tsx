import { useState, useEffect } from "react";
import {
  Megaphone,
  AlertTriangle,
  CheckCircle2,
  Users,
  Wrench,
  CalendarOff,
  Ban,
  Clock,
  Timer,
  Loader2,
  Trophy,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import {
  getDashboardData,
  getDefaultRange,
  createBroadcast,
  RECIPIENT_OPTIONS,
  type DashboardData,
  type DateRange,
} from "@/services";

type RangeLabel = "today" | "week" | "month" | "custom";
const RANGE_LABELS: Record<RangeLabel, string> = {
  today: "Hari Ini",
  week: "Minggu Ini",
  month: "Bulan Ini",
  custom: "Custom Range",
};

const DONUT_COLORS = ["#ef4444", "#f59e0b", "#10b981"];

function Donut({ p1, p2, p3 }: { p1: number; p2: number; p3: number }) {
  const total = p1 + p2 + p3;
  if (total === 0) {
    return (
      <div className="h-36 w-36 rounded-full bg-muted grid place-items-center">
        <span className="text-[10px] text-muted-foreground">Tidak ada data</span>
      </div>
    );
  }
  const seg = (v: number) => (v / total) * 360;
  const gradient = `conic-gradient(${DONUT_COLORS[0]} 0deg ${seg(p1)}deg, ${DONUT_COLORS[1]} ${seg(p1)}deg ${seg(p1) + seg(p2)}deg, ${DONUT_COLORS[2]} ${seg(p1) + seg(p2)}deg 360deg)`;
  return (
    <div className="relative h-36 w-36 rounded-full" style={{ background: gradient }}>
      <div className="absolute inset-[22%] rounded-full bg-card grid place-items-center">
        <span className="text-sm font-bold text-foreground">{total}</span>
      </div>
    </div>
  );
}

function KpiCard({
  icon,
  label,
  value,
  note,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  note: string;
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
      <p className="text-[10px] text-muted-foreground mt-1">{note}</p>
    </div>
  );
}

export function AdminDashboard() {
  const [rangeLabel, setRangeLabel] = useState<RangeLabel>("month");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  const [bTitle, setBTitle] = useState("");
  const [bMessage, setBMessage] = useState("");
  const [bRecipients, setBRecipients] = useState("semua");
  const [sending, setSending] = useState(false);

  async function load() {
    setLoading(true);
    let range: DateRange;
    if (rangeLabel === "custom" && customFrom && customTo) {
      range = {
        from: new Date(`${customFrom}T00:00:00`).toISOString(),
        to: new Date(`${customTo}T23:59:59`).toISOString(),
      };
    } else {
      range = getDefaultRange(rangeLabel);
    }
    setData(await getDashboardData(range));
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, [rangeLabel, customFrom, customTo]);

  async function handleBroadcast() {
    if (!bTitle.trim()) {
      toast.error("Judul pengumuman wajib diisi");
      return;
    }
    setSending(true);
    const res = await createBroadcast({
      title: bTitle,
      message: bMessage,
      recipients: bRecipients,
      scheduleNow: true,
    });
    setSending(false);
    if (!res.ok) {
      toast.error(res.error || "Gagal mengirim");
      return;
    }
    toast.success("Pengumuman terkirim ke seluruh pengguna");
    setBTitle("");
    setBMessage("");
    setBroadcastOpen(false);
  }

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat dashboard…
      </div>
    );
  }

  const d = data || {
    slaOverdue: 0,
    ticketsDone: 0,
    activeUsers: 0,
    workOrdersActive: 0,
    onLeaveToday: 0,
    lockedAccounts: 0,
    leaderboard: [],
    priorityDist: { P1: 0, P2: 0, P3: 0 },
    overtimeTickets: 0,
    dataAgeMinutes: 0,
    hasData: false,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <Badge variant="secondary" className="text-[11px]">
            Data diperbarui {d.dataAgeMinutes} menit lalu
          </Badge>
          {!d.hasData && (
            <Badge
              variant="outline"
              className="text-amber-600 border-amber-200 bg-amber-50 text-[11px]"
            >
              Belum ada data pada periode ini
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select value={rangeLabel} onValueChange={(v) => setRangeLabel(v as RangeLabel)}>
            <SelectTrigger className="w-40 h-9 text-xs">
              <SelectValue placeholder="Periode" />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RANGE_LABELS) as RangeLabel[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {RANGE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {rangeLabel === "custom" && (
            <>
              <Input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="w-36 h-9 text-xs"
              />
              <Input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="w-36 h-9 text-xs"
              />
            </>
          )}
          <Button size="sm" onClick={() => setBroadcastOpen(true)}>
            <Megaphone className="h-3.5 w-3.5 mr-1.5" /> Broadcast
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        <KpiCard
          icon={<AlertTriangle className="h-4 w-4" />}
          label="SLA Overdue"
          value={d.slaOverdue}
          note="Tiket aktif melewati target SLA"
          tone="red"
        />
        <KpiCard
          icon={<CheckCircle2 className="h-4 w-4" />}
          label="Tiket Selesai"
          value={d.ticketsDone}
          note="Status CLOSED / DUPLICATE"
          tone="green"
        />
        <KpiCard
          icon={<Users className="h-4 w-4" />}
          label="User Aktif"
          value={d.activeUsers}
          note={`${d.onLeaveToday} cuti · ${d.lockedAccounts} nonaktif`}
        />
        <KpiCard
          icon={<Wrench className="h-4 w-4" />}
          label="WO Berjalan"
          value={d.workOrdersActive}
          note={`${d.overtimeTickets} tiket lembur pada periode`}
          tone="amber"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 rounded-xl border border-border bg-card">
          <div className="px-5 py-4 border-b border-border flex items-center justify-between">
            <div>
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Trophy className="h-4 w-4 text-amber-500" /> Leaderboard Teknisi
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Berdasarkan tiket selesai pada {RANGE_LABELS[rangeLabel].toLowerCase()}
              </p>
            </div>
          </div>
          {d.leaderboard.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Clock className="h-10 w-10 mb-2" />
              <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
              <p className="text-xs mt-1">Tidak ada tiket selesai pada periode ini</p>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {d.leaderboard.map((t, i) => (
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
                          width: `${Math.min(100, (t.completed / (d.leaderboard[0]?.completed || 1)) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                  <Badge
                    variant={t.reworkRate > 15 ? "destructive" : "secondary"}
                    className="text-[10px]"
                  >
                    FTF {100 - t.reworkRate}%
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 flex flex-col items-center justify-center">
          <h3 className="text-sm font-semibold text-foreground self-start mb-4">
            Distribusi Prioritas
          </h3>
          <Donut p1={d.priorityDist.P1} p2={d.priorityDist.P2} p3={d.priorityDist.P3} />
          <div className="w-full mt-4 space-y-2">
            {[
              { label: "P1 — Darurat", value: d.priorityDist.P1, color: DONUT_COLORS[0] },
              { label: "P2 — Penting", value: d.priorityDist.P2, color: DONUT_COLORS[1] },
              { label: "P3 — Normal", value: d.priorityDist.P3, color: DONUT_COLORS[2] },
            ].map((row) => (
              <div key={row.label} className="flex items-center gap-2 text-xs">
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: row.color }} />
                <span className="text-muted-foreground flex-1">{row.label}</span>
                <span className="font-semibold text-foreground">{row.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <span className="h-9 w-9 grid place-items-center rounded-lg bg-muted text-muted-foreground">
            <CalendarOff className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{d.onLeaveToday}</p>
            <p className="text-[11px] text-muted-foreground">Teknisi cuti hari ini</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <span className="h-9 w-9 grid place-items-center rounded-lg bg-red-50 text-red-600">
            <Ban className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{d.lockedAccounts}</p>
            <p className="text-[11px] text-muted-foreground">Akun nonaktif / terkunci</p>
          </div>
        </div>
        <div className="rounded-xl border border-border bg-card p-4 flex items-center gap-3">
          <span className="h-9 w-9 grid place-items-center rounded-lg bg-amber-50 text-amber-600">
            <Timer className="h-4 w-4" />
          </span>
          <div>
            <p className="text-xl font-bold text-foreground">{d.overtimeTickets} tiket</p>
            <p className="text-[11px] text-muted-foreground">Total lembur periode ini</p>
          </div>
        </div>
      </div>

      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Broadcast Pengumuman</DialogTitle>
            <DialogDescription>
              Kirim pengumuman ke seluruh pengguna aplikasi secara instan.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Judul</label>
              <Input
                value={bTitle}
                onChange={(e) => setBTitle(e.target.value)}
                placeholder="cth. Hari libur nasional 17 Agustus"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Isi</label>
              <Textarea
                value={bMessage}
                onChange={(e) => setBMessage(e.target.value)}
                rows={3}
                placeholder="Detail pengumuman…"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Penerima</label>
              <Select value={bRecipients} onValueChange={setBRecipients}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {RECIPIENT_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBroadcastOpen(false)}>
              Batal
            </Button>
            <Button onClick={handleBroadcast} disabled={sending}>
              {sending ? "Mengirim…" : "Kirim Sekarang"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

