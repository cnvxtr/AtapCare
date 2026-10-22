import { supabase } from "@/lib/supabase";
import { formatDuration } from "@/lib/utils";

export interface ReportFilters {
  from?: string;
  to?: string;
  company?: string[];
  site?: string[];
  unit?: string[];
  status?: string[];
  priority?: string[];
}

export interface TicketReportRow {
  code: string;
  customer: string;
  company: string;
  site: string;
  unit: string;
  serial: string;
  category: string;
  rootCause: string;
  priority: string;
  status: string;
  assignee: string;
  timeRange: string;
  duration: string;
  problemDesc: string;
  support: string;
  createdAt: string;
  closedAt: string;
  source: string;
}

// Tabel layar: tanpa kolom deskripsi (deskripsi hanya muncul di export).
// No. urut dirender terpisah di AdminReports; Serial Number & Jam Masuk–Keluar dihapus.
export const TICKET_REPORT_TABLE_HEADERS = [
  "ID Tiket",
  "Pelanggan",
  "Perusahaan",
  "Site",
  "Unit",
  "Temuan Akhir",
  "Prioritas",
  "Status",
  "Teknisi",
  "Durasi",
];

// Indeks layar pada Object.values(TicketReportRow); Serial Number (5),
// Temuan Awal (6) & Jam Masuk–Keluar (11) dibuang.
export const TICKET_REPORT_TABLE_INDEXES = [0, 1, 2, 3, 4, 7, 8, 9, 10, 12];

// Urutan kolom export tiket: deskripsi disisipkan, tabel layar tidak berubah.
export const TICKET_REPORT_HEADERS = [
  "ID Tiket",
  "Pelanggan",
  "Perusahaan",
  "Site",
  "Unit",
  "Serial Number",
  "Deskripsi Masalah",
  "Temuan Awal",
  "Temuan Akhir",
  "Prioritas",
  "Status",
  "Teknisi",
  "Teknisi Pendukung",
  "Jam Masuk–Keluar",
  "Durasi",
];

// Indeks ulang kolom: dari urutan properti TicketReportRow (Object.values) ke
// urutan export. problemDesc (12) → kolom 7, rootCause (7) → kolom 9,
// support (13) → kolom 13 (setelah Teknisi), timeRange (11) → kolom 14.
export const TICKET_EXPORT_INDEXES = [0, 1, 2, 3, 4, 5, 13, 6, 7, 8, 9, 10, 14, 11, 12];

export const SERIAL_NUMBER_HEADERS = ["ID Tiket", "Teknisi", "Site", "Unit", "Jam Masuk–Keluar", "Serial Number"];

export const KPI_HEADERS = ["Prioritas", "Total"];

function fmt(date: string | null): string {
  if (!date) return "—";
  const d = new Date(date);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("id-ID", { month: "short" })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtShort(date: string): string {
  const d = new Date(date);
  return `${d.getDate()} ${d.toLocaleString("id-ID", { month: "short" })}`;
}

function fmtTime(date: string): string {
  const d = new Date(date);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatTimeRange(start: string, end?: string | null): string {
  const y1 = new Date(start).getFullYear();
  if (!end) return `${fmtShort(start)}, ${fmtTime(start)} ${y1} - —`;
  const y2 = new Date(end).getFullYear();
  if (y1 === y2) {
    return `${fmtShort(start)}, ${fmtTime(start)} - ${fmtShort(end)}, ${fmtTime(end)} ${y2}`;
  }
  return `${fmtShort(start)} ${y1}, ${fmtTime(start)} - ${fmtShort(end)} ${y2}, ${fmtTime(end)}`;
}

// Terima 'YYYY-MM-DD' atau ISO penuh; potong ke bagian tanggal agar tidak crash
// saat nilai sudah berbentuk ISO (new Date('ISO T23:59:59') = Invalid Date).
function dayStart(date: string): string {
  return new Date(`${date.slice(0, 10)}T00:00:00`).toISOString();
}
function dayEnd(date: string): string {
  return new Date(`${date.slice(0, 10)}T23:59:59`).toISOString();
}

// Daftar perusahaan (distinct dari tiket) untuk opsi filter laporan.
// 'Internal' (fallback tiket yang dibuat helpdesk tanpa pilihan) tidak
// ditampilkan — tiket internal menyimpan nama perusahaan asli sejak 2026.
export async function getReportCompanies(): Promise<string[]> {
  const { data } = await supabase.from("tickets").select("company").order("company");
  return [
    ...new Set((data || []).map((r) => r.company).filter((c): c is string => Boolean(c) && c !== "Internal")),
  ];
}

async function buildTicketQuery(filters: ReportFilters) {
  let q = supabase
    .from("tickets")
    .select(
      "id, code, customer, company, site, unit, category, category_id, category_note, problem_categories(name), root_cause_id, root_cause_note, root_causes(name), description, priority, status, assigned_to, rejection_reason, created_at, closed_at, source",
    )
    .order("created_at", { ascending: false });
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.status?.length) q = q.in("status", filters.status);
  if (filters.priority?.length) q = q.in("priority", filters.priority);
  if (filters.company?.length) q = q.in("company", filters.company);
  if (filters.site?.length) q = q.in("site", filters.site);
  if (filters.unit?.length) q = q.in("unit", filters.unit);
  return q;
}

function toTicketRow(
  t: {
    id: string;
    code: string;
    customer: string;
    company: string;
    site: string;
    unit: string;
    category?: string | null;
    category_note?: string | null;
    problem_categories?: { name?: string } | { name?: string }[] | null;
    root_cause_id?: string | null;
    root_cause_note?: string | null;
    root_causes?: { name?: string } | { name?: string }[] | null;
    description?: string | null;
    priority: string;
    status: string;
    created_at: string;
    closed_at?: string | null;
    assigned_to: string | null;
    source?: string | null;
  },
  names?: Map<string, string>,
  serials?: Map<string, string>,
  supportById?: Map<string, string>,
): TicketReportRow {
  // Deskripsi masalah: buang baris metadata (Jabatan/WA Pelapor) yang ditulis
  // RPC pembuatan tiket, sisakan keluhan dari pelapor / catatan helpdesk.
  const rawDesc = (t.description || "").trim();
  const problemDesc = rawDesc
    .replace(/^Jabatan:[^\n]*\n?/m, "")
    .replace(/^WA Pelapor:[^\n]*\n?/m, "")
    .replace(/^\n+/, "")
    .trim() || "—";
  const catName = Array.isArray(t.problem_categories)
    ? t.problem_categories[0]?.name
    : t.problem_categories?.name;
  const rootCauseName = Array.isArray(t.root_causes)
    ? t.root_causes[0]?.name
    : t.root_causes?.name;
  return {
    code: t.code,
    customer: t.customer,
    company: t.company || "—",
    site: t.site || "—",
    unit: t.unit || "—",
    serial: serials?.get(`${t.site ?? ""}|${t.unit ?? ""}`) ?? "—",
    // Temuan Awal dari relasi category_id, bukan kolom legacy `category`
    // (yang pernah diisi nama unit oleh RPC lama create_public_ticket).
    category: t.category_note?.trim() || catName || "—",
    rootCause: t.root_cause_note?.trim() || rootCauseName || "—",
    priority: t.priority || "—",
    status: t.status,
    assignee: t.assigned_to ? names?.get(t.assigned_to) ?? "—" : "—",
    timeRange: formatTimeRange(t.created_at, t.closed_at),
    duration: t.status === "CLOSED" ? formatDuration(t.created_at, t.closed_at) : "—",
    problemDesc,
    support: supportById?.get(t.id) ?? "—",
    createdAt: fmt(t.created_at),
    closedAt: t.closed_at ? fmt(t.closed_at) : "—",
    source: t.source || "public",
  };
}

// Deskripsi hasil: catatan penyelesaian dari aktivitas teknisi ("Selesai: …")
// atau catatan remote helpdesk ("Remote Berhasil …"). Ambil segmen "Selesai"
// bila ada; selain itu segmen pertama (tanpa prefix "Catatan Internal:").
// Segmen foto/serial number tidak boleh bocor ke laporan.
export async function getTicketReport(filters: ReportFilters): Promise<TicketReportRow[]> {
  const [res, usersRes, serials] = await Promise.all([
    buildTicketQuery(filters),
    supabase.from("users").select("id, full_name"),
    loadSerialMap(),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  const raw = res.data || [];
  const supportById = new Map<string, string>();
  const ids = raw.map((t) => t.id).filter(Boolean);
  if (ids.length) {
    const { data: supports } = await supabase
      .from("ticket_assignments")
      .select("ticket_id, user_id")
      .in("ticket_id", ids)
      .eq("role", "teknisi");
    const supportNamesByTicket = new Map<string, string[]>();
    for (const a of supports || []) {
      const name = names.get(a.user_id);
      if (!name) continue;
      const list = supportNamesByTicket.get(a.ticket_id) || [];
      list.push(name);
      supportNamesByTicket.set(a.ticket_id, list);
    }
    for (const [ticketId, list] of supportNamesByTicket) {
      supportById.set(ticketId, list.join(", "));
    }
  }
  return raw.map((t) => toTicketRow(t, names, serials, supportById));
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

export async function getKpiReport(filters: ReportFilters): Promise<Record<string, string | number>[]> {
  const { data } = await buildTicketQuery(filters);
  const tickets = data || [];
  const rows: Record<string, string | number>[] = [];
  for (const p of ["Critical", "Medium", "Low"]) {
    const group = tickets.filter(
      (t) => t.priority === p && !["VOID", "DUPLICATE", "REJECTED"].includes(t.status),
    );
    if (group.length === 0) continue;
    rows.push({
      priority: p,
      total: group.length,
    });
  }
  return rows;
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
  let byId = new Map<string, {
    code: string;
    site: string;
    unit: string;
    created_at: string;
    closed_at: string | null;
  }>();
  if (ids.length) {
    const { data: tickets } = await supabase
      .from("tickets")
      .select("id, code, site, unit, created_at, closed_at")
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
        Site: t?.site || "—",
        Unit: t?.unit || "—",
        "Jam Masuk–Keluar": t ? formatTimeRange(t.created_at, t.closed_at) : "—",
        "Serial Number": (m[1] ?? m[2]).trim(),
      },
    ];
  });
}
