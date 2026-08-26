import { supabase } from "@/lib/supabase";
import { getSites, type SiteRow } from "./master-data";

export interface ReportFilters {
  from?: string;
  to?: string;
  siteId?: string[];
  status?: string[];
  priority?: string[];
}

// Label status Indonesia untuk filter. "Ditugaskan" mencakup beberapa status
// mentah (UNASSIGNED/SCHEDULED/EN_ROUTE) yang berlabel sama di UI.
export const STATUS_FILTER_GROUPS: Record<string, string[]> = {
  Baru: ["NEW"],
  Diproses: ["OPEN"],
  Ditugaskan: ["UNASSIGNED", "SCHEDULED", "EN_ROUTE"],
  Dikerjakan: ["WORKING"],
  Dijeda: ["PENDING"],
  Selesai: ["RESOLVED"],
  Tutup: ["CLOSED"],
  Dibatalkan: ["VOID"],
  Digabungkan: ["DUPLICATE"],
};

export const STATUS_FILTER_OPTIONS = Object.keys(STATUS_FILTER_GROUPS).map((label) => ({
  value: label,
  label,
}));

export interface TicketReportRow {
  code: string;
  customer: string;
  site: string;
  unit: string;
  serial: string;
  category: string;
  priority: string;
  status: string;
  assignee: string;
  createdAt: string;
  closedAt: string;
}

export const TICKET_REPORT_HEADERS = [
  "ID Tiket",
  "Pelanggan",
  "Site",
  "Unit",
  "Serial Number",
  "Kategori",
  "Prioritas",
  "Status",
  "Teknisi",
  "Tanggal Masuk",
  "Tanggal Keluar",
];

export const ROOTCAUSE_HEADERS = ["Akar Kendala", "Jumlah", "% Total"];

export const SERIAL_NUMBER_HEADERS = ["ID Tiket", "Teknisi", "Tanggal", "Site", "Serial Number"];

export const KPI_HEADERS = ["Prioritas", "Total", "Terbuka", "Selesai", "Overdue", "FTF (%)"];

export const AUDIT_HEADERS = ["Waktu", "User", "Role", "Aktivitas", "Entitas", "Detail"];

const ACTIVE_STATUSES = [
  "NEW",
  "OPEN",
  "UNASSIGNED",
  "SCHEDULED",
  "EN_ROUTE",
  "WORKING",
  "PENDING",
];

function fmt(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("id-ID", { month: "short" })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

// Terima 'YYYY-MM-DD' atau ISO penuh; potong ke bagian tanggal agar tidak crash
// saat nilai sudah berbentuk ISO (new Date('ISO T23:59:59') = Invalid Date).
function dayStart(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toISOString();
}
function dayEnd(date: string): string {
  return new Date(`${date.slice(0, 10)}T23:59:59`).toISOString();
}

async function resolveSiteNames(siteIds?: string[]): Promise<string[]> {
  if (!siteIds?.length) return [];
  const { data: sites } = await supabase.from("sites").select("name").in("id", siteIds);
  return (sites || []).map((s) => s.name).filter(Boolean);
}

async function buildTicketQuery(filters: ReportFilters) {
  let q = supabase
    .from("tickets")
    .select(
      "id, code, customer, site, unit, category, priority, status, assigned_to, rejection_reason, created_at, closed_at",
    )
    .order("created_at", { ascending: false });
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.status?.length) {
    const raws = filters.status.flatMap((s) => STATUS_FILTER_GROUPS[s] ?? [s]);
    if (raws.length) q = q.in("status", raws);
  }
  if (filters.priority?.length) q = q.in("priority", filters.priority);
  const siteNames = await resolveSiteNames(filters.siteId);
  if (siteNames.length) q = q.in("site", siteNames);
  return q;
}

function toTicketRow(
  t: {
    code: string;
    customer: string;
    site: string;
    unit: string;
    category?: string | null;
    priority: string;
    status: string;
    created_at: string;
    closed_at?: string | null;
    assigned_to: string | null;
  },
  names?: Map<string, string>,
  serials?: Map<string, string>,
): TicketReportRow {
  return {
    code: t.code,
    customer: t.customer,
    site: t.site || "—",
    unit: t.unit || "—",
    serial: serials?.get(`${t.site ?? ""}|${t.unit ?? ""}`) ?? "—",
    category: t.category || "—",
    priority: t.priority || "Low",
    status: t.status,
    assignee: t.assigned_to ? names?.get(t.assigned_to) ?? "—" : "—",
    createdAt: fmt(t.created_at),
    closedAt: t.closed_at ? fmt(t.closed_at) : "—",
  };
}

// ponytail: relasi tiket→unit lewat kecocokan nama (site|unit), bukan FK —
// bertahan karena struktur aset legacy; upgrade ke unit_id FK bila relasi dirapikan.
async function loadSerialMap(): Promise<Map<string, string>> {
  const [unitsRes, sitesRes] = await Promise.all([
    supabase.from("units").select("site_id, name, serial_number"),
    supabase.from("sites").select("id, name"),
  ]);
  const siteNames = new Map((sitesRes.data || []).map((s) => [s.id, s.name]));
  const map = new Map<string, string>();
  for (const u of unitsRes.data || []) {
    if (!u.serial_number) continue;
    const site = siteNames.get(u.site_id) ?? "";
    map.set(`${site}|${u.name}`, u.serial_number);
  }
  return map;
}

export async function getTicketReport(filters: ReportFilters): Promise<TicketReportRow[]> {
  const [res, usersRes, serials] = await Promise.all([
    buildTicketQuery(filters),
    supabase.from("users").select("id, full_name"),
    loadSerialMap(),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  return (res.data || []).map((t) => toTicketRow(t, names, serials));
}

export async function getKpiReport(filters: ReportFilters): Promise<Record<string, string | number>[]> {
  const { data } = await buildTicketQuery(filters);
  const tickets = data || [];
  const rows: Record<string, string | number>[] = [];
  for (const p of ["Critical", "Medium", "Low"]) {
    const group = tickets.filter((t) => t.priority === p);
    if (group.length === 0) continue;
    const closed = group.filter((t) => ["CLOSED", "VOID", "DUPLICATE"].includes(t.status));
    const active = group.filter((t) => ACTIVE_STATUSES.includes(t.status));
    // Overdue dihitung server-side (compute_sla_batch) agar selaras dengan
    // sisa SLA di drawer — target live dari sla_config, hitung dari jam WORKING.
    let overdue = 0;
    const activeIds = active.map((t) => t.id);
    if (activeIds.length) {
      const { data: sla } = await supabase.rpc("compute_sla_batch", { p_ids: activeIds });
      const slaRows = (sla || []) as { ticket_id: string; remaining_hours: number | null }[];
      const remaining = new Map(slaRows.map((r) => [r.ticket_id, r.remaining_hours]));
      overdue = active.filter((t) => {
        const rem = remaining.get(t.id);
        return rem != null && rem <= 0;
      }).length;
    }
    const rework = closed.filter((t) => t.rejection_reason).length;
    rows.push({
      priority: p,
      total: group.length,
      terbuka: active.length,
      selesai: closed.length,
      overdue,
      ftf: closed.length ? Math.round(((closed.length - rework) / closed.length) * 100) : 100,
    });
  }
  return rows;
}

export async function getAuditReport(
  filters: ReportFilters,
): Promise<Record<string, string>[]> {
  let q = supabase
    .from("audit_logs")
    .select("created_at, actor_name, metadata, action, entity_type, entity_id")
    .order("created_at", { ascending: false });
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  const { data } = await q;
  return (data || []).map((r) => {
    const meta = (r.metadata as Record<string, unknown>) || {};
    return {
      waktu: fmt(r.created_at),
      user: r.actor_name ?? "—",
      role: String(meta.role ?? meta.active_role ?? "—"),
      aktivitas: r.action,
      entitas: r.entity_type ?? "—",
      detail: r.entity_id ? r.entity_id.slice(0, 8) : "—",
    };
  });
}

export { getSites, type SiteRow };

// ── Top 10 Akar Kendala ──
export async function getRootCauseReport(
  filters: ReportFilters,
): Promise<Record<string, string | number>[]> {
  let q = supabase
    .from("tickets")
    .select("root_cause_id, root_causes(name), created_at, site");
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  const siteNames = await resolveSiteNames(filters.siteId);
  if (siteNames.length) q = q.in("site", siteNames);
  const { data } = await q;
  const rows = data || [];

  const counts = new Map<string, number>();
  let noCause = 0;
  for (const t of rows) {
    const name = (t as { root_causes?: { name?: string } | null }).root_causes?.name;
    if (name) counts.set(name, (counts.get(name) ?? 0) + 1);
    else noCause++;
  }
  const total = rows.length || 1;
  const top = [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({
      "Akar Kendala": name,
      Jumlah: count,
      "% Total": Math.round((count / total) * 100),
    }));
  if (noCause > 0) {
    top.push({
      "Akar Kendala": "Tanpa akar kendala",
      Jumlah: noCause,
      "% Total": Math.round((noCause / total) * 100),
    });
  }
  return top;
}

// ── Riwayat Serial Number (parse dari aktivitas 'Tugas diselesaikan') ──
// ponytail: serial number tak terstruktur (teks di activity) — parsing teks
// untuk laporan retroaktif; kolom terstruktur bila butuh inventory/cost.
// Format lama 'Sparepart:' tetap dibaca agar data historis tidak hilang.
export async function getSerialNumberReport(
  filters: ReportFilters,
): Promise<Record<string, string>[]> {
  let q = supabase
    .from("activities")
    .select("id, created_at, user_name, action, details, ticket_id")
    .eq("action", "Tugas diselesaikan")
    .or("details.ilike.%Sparepart:%,details.ilike.%Serial Number:%");
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  const { data } = await q;

  const ids = [...new Set((data || []).map((a) => a.ticket_id).filter(Boolean))];
  let byId = new Map<string, { code: string; site: string }>();
  if (ids.length) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, code, site")
      .in("id", ids);
    byId = new Map((tickets || []).map((t) => [t.id, t]));
  }

  return (data || []).flatMap((a) => {
    const m = a.details.match(/Serial Number:\s*([^|]+)|Sparepart:\s*([^|]+)/);
    if (!m) return [];
    const t = byId.get(a.ticket_id);
    return [
      {
        "ID Tiket": t?.code ?? "—",
        Teknisi: a.user_name ?? "—",
        Tanggal: fmt(a.created_at),
        Site: t?.site || "—",
        "Serial Number": (m[1] ?? m[2]).trim(),
      },
    ];
  });
}
