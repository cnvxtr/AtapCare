import { useState, useEffect } from "react";
import { Clock, Calendar, Loader2, Plus, Trash2, Save, Snowflake } from "lucide-react";
import { toast } from "sonner";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  getSlaConfig,
  saveSlaTarget,
  getHolidays,
  addHoliday,
  deleteHoliday,
  toggleHoliday,
  PRIORITY_DEFAULTS,
  type HolidayRow,
} from "@/services";

const PRIORITY_LABELS: Record<string, string> = {
  P1: "P1 — Darurat",
  P2: "P2 — Penting",
  P3: "P3 — Normal",
};

const PRIORITY_COLORS: Record<string, string> = {
  P1: "bg-red-100 text-red-700 border-red-200",
  P2: "bg-yellow-100 text-yellow-700 border-yellow-200",
  P3: "bg-muted text-muted-foreground border-border",
};

export function AdminSlaConfig() {
  const [holidays, setHolidays] = useState<HolidayRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [newHolidayName, setNewHolidayName] = useState("");
  const [newHolidayDate, setNewHolidayDate] = useState("");

  const [editHours, setEditHours] = useState<Record<string, number>>({});
  const [savedHours, setSavedHours] = useState<Record<string, number>>({});

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    const [presetRows, holidayRows] = await Promise.all([getSlaConfig(), getHolidays()]);
    const hours: Record<string, number> = {};
    for (const p of presetRows) hours[p.priority] = p.target_hours;
    setEditHours(hours);
    setSavedHours(hours);
    setHolidays(holidayRows);
    setLoading(false);
  }

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

  async function handleAddHoliday() {
    if (!newHolidayName.trim() || !newHolidayDate) return;
    setSaving(true);
    const res = await addHoliday(newHolidayName, newHolidayDate);
    setSaving(false);
    if (!res.ok) {
      toast.error(res.error || "Gagal menambahkan hari libur");
      return;
    }
    setNewHolidayName("");
    setNewHolidayDate("");
    toast.success("Hari libur berhasil ditambahkan");
    loadData();
  }

  async function handleDeleteHoliday(id: string) {
    const ok = await deleteHoliday(id);
    if (ok) {
      toast.success("Hari libur berhasil dihapus");
      loadData();
    }
  }

  async function handleToggleHoliday(h: HolidayRow, checked: boolean) {
    const ok = await toggleHoliday(h.id, checked);
    if (ok) {
      toast.success(checked ? `${h.name} diaktifkan (SLA freeze)` : `${h.name} dinonaktifkan`);
      setHolidays((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_active: checked } : x)));
    }
  }

  const activeHolidayCount = holidays.filter((h) => h.is_active).length;
  // Bandingkan dengan tanggal WIB (UTC+7), bukan UTC — blueprint memakai WIB utk semua timer.
  const wib = new Date(Date.now() + 7 * 60 * 60 * 1000);
  const todayWib = `${wib.getUTCFullYear()}-${String(wib.getUTCMonth() + 1).padStart(2, "0")}-${String(wib.getUTCDate()).padStart(2, "0")}`;
  const isTodayHoliday = holidays.some(
    (h) => h.is_active && h.date === todayWib,
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Memuat konfigurasi…
      </div>
    );
  }

  return (
    <div className="grid md:grid-cols-2 gap-6">
      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Target SLA</h3>
        </div>
        <p className="text-xs text-muted-foreground mb-5">
          Batas waktu penyelesaian tiket per prioritas (jam). Libur aktif membekukan SLA secara
          global.
        </p>

        <div className="space-y-4">
          {(["P1", "P2", "P3"] as const).map((priority) => {
            const dirty = editHours[priority] !== savedHours[priority];
            return (
              <div key={priority} className={`rounded-lg border p-4 ${PRIORITY_COLORS[priority]}`}>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-semibold">{PRIORITY_LABELS[priority]}</span>
                  <span className="text-[10px] font-mono text-muted-foreground">
                    Default: {PRIORITY_DEFAULTS[priority]} jam
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    value={editHours[priority] ?? PRIORITY_DEFAULTS[priority]}
                    onChange={(e) =>
                      setEditHours((prev) => ({ ...prev, [priority]: Number(e.target.value) }))
                    }
                    className="w-24 h-9 px-3 rounded-lg border border-border bg-card text-sm text-center font-mono text-foreground outline-none focus:border-ring"
                    min={1}
                  />
                  <span className="text-xs text-muted-foreground">jam</span>
                  <button
                    onClick={() => handleSavePreset(priority)}
                    disabled={saving || !dirty}
                    className="ml-auto h-9 px-4 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-40 inline-flex items-center gap-1.5"
                  >
                    <Save className="h-3.5 w-3.5" /> Simpan
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6">
        <div className="flex items-center gap-2 mb-1">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <h3 className="text-sm font-semibold text-foreground">Kalender Libur</h3>
        </div>
        <div className="flex items-center gap-2 mb-5">
          <p className="text-xs text-muted-foreground">Tanggal merah aktif membekukan SLA secara global.</p>
          <div className="ml-auto flex items-center gap-1.5">
            <Badge
              variant={isTodayHoliday ? "default" : "secondary"}
              className={`text-[10px] ${isTodayHoliday ? "bg-blue-600" : ""}`}
            >
              <Snowflake className="h-3 w-3 mr-1" />
              {isTodayHoliday ? "SLA BEKU HARI INI" : "SLA Normal"}
            </Badge>
            <Badge variant="outline" className="text-[10px]">
              {activeHolidayCount} libur aktif
            </Badge>
          </div>
        </div>

        <div className="flex items-center gap-2 mb-4">
          <input
            value={newHolidayName}
            onChange={(e) => setNewHolidayName(e.target.value)}
            placeholder="Nama libur"
            className="flex-1 h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
          />
          <input
            type="date"
            value={newHolidayDate}
            onChange={(e) => setNewHolidayDate(e.target.value)}
            className="h-9 px-3 rounded-lg border border-border bg-muted text-sm text-foreground outline-none focus:border-ring"
          />
          <button
            onClick={handleAddHoliday}
            disabled={!newHolidayName.trim() || !newHolidayDate || saving}
            className="h-9 px-3 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition disabled:opacity-50 inline-flex items-center gap-1"
          >
            <Plus className="h-3.5 w-3.5" /> Tambah
          </button>
        </div>

        {holidays.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
            <Calendar className="h-10 w-10 mb-2" />
            <p className="text-sm font-medium text-muted-foreground">Belum ada data</p>
            <p className="text-xs mt-1">Gunakan form di atas untuk mendaftarkan hari libur</p>
          </div>
        ) : (
          <div className="space-y-2 max-h-[400px] overflow-y-auto">
            {holidays.map((h) => (
              <div
                key={h.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition ${h.is_active ? "border-blue-100 bg-blue-50/40" : "border-border bg-muted opacity-60"}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{h.name}</p>
                    {h.is_active && (
                      <Badge className="text-[9px] bg-blue-600 px-1.5 py-0">FREEZE</Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground font-mono">
                    {new Date(h.date).toLocaleDateString("id-ID", {
                      day: "numeric",
                      month: "long",
                      year: "numeric",
                    })}
                  </p>
                </div>
                <Switch
                  checked={h.is_active}
                  onCheckedChange={(checked) => handleToggleHoliday(h, checked)}
                  aria-label={`Aktifkan libur ${h.name}`}
                />
                <button
                  onClick={() => handleDeleteHoliday(h.id)}
                  className="p-1.5 rounded hover:bg-red-50 transition text-red-500"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

