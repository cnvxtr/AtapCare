import { supabase } from "@/lib/supabase";

export interface ReportFilters {
  from?: string;
  to?: string;
  company?: string[];
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

export interface TicketReportRow {
  code: string;
  customer: string;
  company: string;
  site: string;
  unit: string;
  serial: string;
  category: string;
  priority: string;
  status: string;
  assignee: string;
  createdAt: string;
  closedAt: string;
  problemDesc: string;
  resultDesc: string;
}

// Tabel layar: tanpa kolom deskripsi (deskripsi hanya muncul di export).
export const TICKET_REPORT_TABLE_HEADERS = [
  "ID Tiket",
  "Pelanggan",
  "Perusahaan",
  "Site",
  "Unit",
  "Serial Number",
  "Temuan Awal",
  "Prioritas",
  "Status",
  "Teknisi",
  "Tanggal Masuk",
  "Tanggal Keluar",
];

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
  "Deskripsi Hasil",
  "Prioritas",
  "Status",
  "Teknisi",
  "Tanggal Masuk",
  "Tanggal Keluar",
];

// Indeks ulang kolom: dari urutan properti TicketReportRow (Object.values) ke
// urutan export. problemDesc (12) → kolom 7, resultDesc (13) → kolom 9.
export const TICKET_EXPORT_INDEXES = [0, 1, 2, 3, 4, 5, 12, 6, 13, 7, 8, 9, 10, 11];

export const ROOTCAUSE_HEADERS = ["Temuan Akhir", "Jumlah", "% Total"];

export const SERIAL_NUMBER_HEADERS = ["ID Tiket", "Teknisi", "Tanggal", "Site", "Serial Number"];

export const KPI_HEADERS = ["Prioritas", "Total", "Terbuka", "Selesai", "Overdue", "FTF (%)"];

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
      "id, code, customer, company, site, unit, category, category_id, problem_categories(name), description, priority, status, assigned_to, rejection_reason, created_at, closed_at",
    )
    .order("created_at", { ascending: false });
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.status?.length) {
    const raws = filters.status.flatMap((s) => STATUS_FILTER_GROUPS[s] ?? [s]);
    if (raws.length) q = q.in("status", raws);
  }
  if (filters.priority?.length) q = q.in("priority", filters.priority);
  if (filters.company?.length) q = q.in("company", filters.company);
  return q;
}

function toTicketRow(
  t: {
    code: string;
    customer: string;
    company: string;
    site: string;
    unit: string;
    category?: string | null;
    problem_categories?: { name?: string } | { name?: string }[] | null;
    description?: string | null;
    priority: string;
    status: string;
    created_at: string;
    closed_at?: string | null;
    assigned_to: string | null;
  },
  names?: Map<string, string>,
  serials?: Map<string, string>,
): TicketReportRow {
  // Deskripsi masalah: buang baris metadata (Jabatan/WA Pelapor) yang ditulis
  // RPC pembuatan tiket, sisakan keluhan dari pelapor / catatan helpdesk.
  const rawDesc = (t.description || "").trim();
  const problemDesc = rawDesc
    .replace(/^Jabatan:\s*.+\n?/m, "")
    .replace(/^WA Pelapor:\s*.+\n?/m, "")
    .replace(/^\n+/, "")
    .trim() || "—";
  const catName = Array.isArray(t.problem_categories)
    ? t.problem_categories[0]?.name
    : t.problem_categories?.name;
  return {
    code: t.code,
    customer: t.customer,
    company: t.company || "—",
    site: t.site || "—",
    unit: t.unit || "—",
    serial: serials?.get(`${t.site ?? ""}|${t.unit ?? ""}`) ?? "—",
    // Temuan Awal dari relasi category_id, bukan kolom legacy `category`
    // (yang pernah diisi nama unit oleh RPC lama create_public_ticket).
    category: catName || "—",
    priority: t.priority || "Low",
    status: t.status,
    assignee: t.assigned_to ? names?.get(t.assigned_to) ?? "—" : "—",
    createdAt: fmt(t.created_at),
    closedAt: t.closed_at ? fmt(t.closed_at) : "—",
    problemDesc,
    resultDesc: "—",
  };
}

// Deskripsi hasil: catatan penyelesaian dari aktivitas teknisi ("Selesai: …")
// atau catatan remote helpdesk ("Remote Berhasil …"). Ambil segmen "Selesai"
// bila ada; selain itu segmen pertama (tanpa prefix "Catatan Internal:").
// Segmen foto/serial number tidak boleh bocor ke laporan.
function extractResultDesc(details?: string): string {
  if (!details) return "—";
  const d = details.replace(/^Catatan Internal:\s*/, "").trim();
  const segments = d.split(" | ").map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return "—";
  const resolved = segments.find((s) => /^Selesai\b/.test(s));
  const first = resolved ?? segments[0];
  if (/^Foto \(|^Serial Number:/.test(first)) return "—";
  return first.replace(/^Selesai:\s*/, "").replace(/^Selesai\b/, "").trim() || "—";
}

export async function getTicketReport(filters: ReportFilters): Promise<TicketReportRow[]> {
  const [res, usersRes, serials] = await Promise.all([
    buildTicketQuery(filters),
    supabase.from("users").select("id, full_name"),
    loadSerialMap(),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  const raw = res.data || [];
  const resultById = new Map<string, string>();
  const ids = raw.map((t) => t.id).filter(Boolean);
  if (ids.length) {
    const { data: acts } = await supabase
      .from("activities")
      .select("ticket_id, created_at, action, details")
      .in("ticket_id", ids)
      .in("action", ["Tugas diselesaikan", "Tiket dibuat dengan status Selesai"])
      .order("created_at", { ascending: false });
    const latestByTicket = new Map<string, { created_at: string; details?: string }>();
    for (const a of acts || []) {
      if (!latestByTicket.has(a.ticket_id)) latestByTicket.set(a.ticket_id, a);
    }
    for (const [ticketId, a] of latestByTicket) resultById.set(ticketId, extractResultDesc(a.details));
  }
  return raw.map((t) => ({ ...toTicketRow(t, names, serials), resultDesc: resultById.get(t.id) ?? "—" }));
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

// ── Top 10 Temuan Akhir ──
export async function getRootCauseReport(
  filters: ReportFilters,
): Promise<Record<string, string | number>[]> {
  let q = supabase
    .from("tickets")
    .select("root_cause_id, root_causes(name), created_at, company");
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.company?.length) q = q.in("company", filters.company);
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
      "Temuan Akhir": name,
      Jumlah: count,
      "% Total": Math.round((count / total) * 100),
    }));
  if (noCause > 0) {
    top.push({
      "Temuan Akhir": "Tanpa temuan akhir",
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
