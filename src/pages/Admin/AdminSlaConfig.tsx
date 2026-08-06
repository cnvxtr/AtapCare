import { useState, useEffect } from "react";
import { Clock, CalendarDays, Loader2, RefreshCw, Save } from "lucide-react";
import { toast } from "sonner";
import { CalendarDate, getLocalTimeZone, today } from "@internationalized/date";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar-rac";
import {
  getSlaConfig,
  saveSlaTarget,
  getHolidays,
  syncHolidays,
  PRIORITY_DEFAULTS,
  type HolidayRow,
} from "@/services";

const PRIORITY_LABELS: Record<string, string> = {
  P1: "P1 — Darurat",
  P2: "P2 — Penting",
  P3: "P3 — Normal",
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: "border-red-600 bg-red-600/10",
  P2: "border-amber-500 bg-amber-500/10",
  P3: "border-blue-500 bg-blue-500/10",
};

export function AdminSlaConfig() {
  const [holidayCount, setHolidayCount] = useState(0);
  const [holidayRows, setHolidayRows] = useState<HolidayRow[]>([]);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);

  const [editHours, setEditHours] = useState<Record<string, number>>({});
  const [savedHours, setSavedHours] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  const year = new Date().getFullYear();
  const todayWib = today(getLocalTimeZone()).toString();
  // Hitungan real-time: hari libur aktif dari hari ini sampai akhir tahun.
  const countRemaining = (rows: HolidayRow[]) =>
    rows.filter((h) => h.is_active && h.date.startsWith(String(year)) && h.date >= todayWib).length;

  async function loadData() {
    setLoading(true);
    const [presetRows, holidayRows] = await Promise.all([getSlaConfig(), getHolidays()]);
    const hours: Record<string, number> = {};
    for (const p of presetRows) hours[p.priority] = p.target_hours;
    setEditHours(hours);
    setSavedHours(hours);
    setHolidayCount(countRemaining(holidayRows));
    setLoading(false);
    handleSync(true);
  }

  async function handleSync(silent = false) {
    setSyncing(true);
    const res = await syncHolidays();
    if (res.added > 0) {
      const rows = await getHolidays();
      setHolidayCount(countRemaining(rows));
    }
    setSyncing(false);
    if (silent) return;
    if (res.error) {
      toast.error(`Gagal sinkronisasi hari libur: ${res.error}`);
    } else {
      toast.success(
        res.added > 0 ? `${res.added} hari libur baru ditambahkan` : "Hari libur sudah mutakhir",
      );
    }
  }

  async function openHolidayCalendar() {
    setCalendarOpen(true);
    const rows = await getHolidays();
    setHolidayRows(rows);
  }

  const remaining = holidayRows
    .filter((h) => h.is_active && h.date.startsWith(String(year)) && h.date >= todayWib)
    .sort((a, b) => a.date.localeCompare(b.date));

  async function handleSavePreset(priority: string) {
    const hours = editHours[priority];
    if (!hours || hours < 1) {
      toast.error("Target SLA minimal 1 jam");
      return;
    }
    setSaving(true);
    const ok = await saveSlaTarget(priority, hours);
    setSaving(false);
    if (!ok) {
      toast.error("Gagal menyimpan target SLA");
      return;
    }
    toast.success(`Target SLA ${priority} disimpan (${hours} jam)`);
    setSavedHours((prev) => ({ ...prev, [priority]: hours }));
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat konfigurasi…
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <div className="flex items-center gap-2 mb-1">
        <Clock className="h-4 w-4 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Target SLA</h3>
      </div>
      <p className="text-xs text-muted-foreground mb-3">
        Batas waktu penyelesaian tiket per prioritas (jam). Hari libur (nasional, cuti bersama,
        Sabtu/Minggu) otomatis membekukan SLA.
      </p>

      <div className="flex items-center gap-3 mb-5">
        <button
          onClick={() => handleSync()}
          disabled={syncing}
          className="inline-flex items-center gap-1.5 h-7 px-2.5 rounded-[3px] border border-border text-xs text-muted-foreground hover:bg-muted transition disabled:opacity-50"
        >
          <RefreshCw className={`h-3 w-3 ${syncing ? "animate-spin" : ""}`} />
          Sinkronkan libur
        </button>
        <button
          onClick={openHolidayCalendar}
          title="Lihat kalender hari libur"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition"
        >
          <CalendarDays className="h-3.5 w-3.5" />
          {holidayCount} hari libur tersisa
        </button>
      </div>

      <div className="space-y-4">
        {(["P1", "P2", "P3"] as const).map((priority) => {
          const dirty = editHours[priority] !== savedHours[priority];
          return (
            <div key={priority} className={`rounded-lg border p-4 ${PRIORITY_COLORS[priority]}`}>
              <h4 className="text-sm font-semibold mb-3">{PRIORITY_LABELS[priority]}</h4>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  value={editHours[priority] ?? PRIORITY_DEFAULTS[priority]}
                  onChange={(e) =>
                    setEditHours((prev) => ({ ...prev, [priority]: Number(e.target.value) }))
                  }
                  className="w-24 h-9 px-3 rounded-[3px] border border-border bg-card text-sm text-center font-mono text-foreground outline-none focus:border-ring"
                  min={1}
                />
                <span className="text-xs text-muted-foreground">jam</span>
                <button
                  onClick={() => handleSavePreset(priority)}
                  disabled={saving || !dirty}
                  className="ml-auto h-9 px-4 rounded-[3px] bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-40 inline-flex items-center gap-1.5"
                >
                  <Save className="h-3.5 w-3.5" /> Simpan
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <Dialog open={calendarOpen} onOpenChange={setCalendarOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Hari Libur dan Cuti {year}</DialogTitle>
            <DialogDescription>
              {remaining.length} hari libur tersisa (hari ini s.d. akhir tahun).
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-center pt-2">
            <Calendar
              holidayDates={new Set(remaining.map((h) => h.date))}
              minValue={today(getLocalTimeZone())}
              maxValue={new CalendarDate(year, 12, 31)}
              isReadOnly
            />
          </div>
          <p className="text-center text-[10px] text-muted-foreground">
            Tanggal merah = hari libur (nasional &amp; cuti bersama)
          </p>
          <div className="max-h-64 overflow-y-auto space-y-1.5 border-t border-border pt-3">
            {remaining.map((h) => (
              <div key={h.id} className="flex items-center justify-between gap-3 text-xs">
                <span className="flex items-center gap-2 min-w-0">
                  <span className="text-foreground truncate">{h.name}</span>
                  <span
                    className={`text-[9px] px-1.5 py-px rounded border shrink-0 ${
                      h.kind === "leave"
                        ? "bg-amber-500/15 text-amber-600 border-amber-500/40"
                        : "bg-blue-600/15 text-blue-600 border-blue-600/40"
                    }`}
                  >
                    {h.kind === "leave" ? "Cuti" : "Nasional"}
                  </span>
                </span>
                <span className="font-mono text-muted-foreground whitespace-nowrap">
                  {new Date(`${h.date}T00:00:00`).toLocaleDateString("id-ID", {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
