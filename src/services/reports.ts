import { supabase } from "@/integrations/supabase/client";
import { getSites, type SiteRow } from "./master-data";
import { PRIORITY_DEFAULTS } from "./sla";
import { isSlaOverdue } from "./slaCalc";
import { isScheduleOvertime } from "@/components/TicketDrawer";

export interface ReportFilters {
  from?: string;
  to?: string;
  siteId?: string;
  status?: string;
  priority?: string;
  technicianId?: string;
}

export interface TicketReportRow {
  code: string;
  customer: string;
  site: string;
  unit: string;
  priority: string;
  status: string;
  createdAt: string;
  closedAt: string;
  assignee: string;
  duration: string | number;
}

export const TICKET_REPORT_HEADERS = [
  "ID Tiket",
  "Pelanggan",
  "Site",
  "Unit",
  "Prioritas",
  "Status",
  "Tanggal Masuk",
  "Tanggal Selesai",
  "Teknisi",
  "Durasi (jam)",
];

export const KPI_HEADERS = ["Prioritas", "Total", "Terbuka", "Selesai", "Overdue", "FTF (%)"];

export const OVERTIME_HEADERS = [
  "Teknisi",
  "Tanggal",
  "Jam Mulai",
  "Prioritas",
  "Tiket",
];

export const AUDIT_HEADERS = ["Waktu", "User", "Role", "Aktivitas", "Entitas", "Detail"];

export const MASTER_DATA_HEADERS = [
  "Tipe",
  "Nama",
  "Customer",
  "Site",
  "Region",
  "Serial Number",
  "Tipe Unit",
  "Nama PIC",
  "No WA PIC",
  "Alamat",
  "No Telepon",
];

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

async function buildTicketQuery(filters: ReportFilters, statuses?: string[]) {
  let q = supabase
    .from("tickets")
    .select(
      "id, code, customer, site, unit, priority, status, assigned_to, sla_time_left, rejection_reason, created_at, closed_at",
    )
    .order("created_at", { ascending: false });
  if (statuses) q = q.in("status", statuses);
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.status) q = q.eq("status", filters.status);
  if (filters.priority) q = q.eq("priority", filters.priority);
  if (filters.siteId) {
    const { data: site } = await supabase.from("sites").select("name").eq("id", filters.siteId).single();
    if (site?.name) q = q.eq("site", site.name);
  }
  if (filters.technicianId) {
    q = q.eq("assigned_to", filters.technicianId);
  }
  return q;
}

function toTicketRow(
  t: {
    code: string;
    customer: string;
    site: string;
    unit: string;
    priority: string;
    status: string;
    created_at: string;
    closed_at: string | null;
    assigned_to: string | null;
  },
  names?: Map<string, string>,
): TicketReportRow {
  const start = new Date(t.created_at).getTime();
  const end = t.closed_at ? new Date(t.closed_at).getTime() : Date.now();
  const hours = Math.max(0, Math.round(((end - start) / 3600000) * 10) / 10);
  return {
    code: t.code,
    customer: t.customer,
    site: t.site || "—",
    unit: t.unit || "—",
    priority: t.priority || "P3",
    status: t.status,
    createdAt: fmt(t.created_at),
    closedAt: t.closed_at ? fmt(t.closed_at) : "—",
    assignee: t.assigned_to ? names?.get(t.assigned_to) ?? "—" : "—",
    duration: hours,
  };
}

export async function getTicketReport(filters: ReportFilters): Promise<TicketReportRow[]> {
  const [res, usersRes] = await Promise.all([
    buildTicketQuery(filters),
    supabase.from("users").select("id, full_name"),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  return (res.data || []).map((t) => toTicketRow(t, names));
}

export async function getArchiveSnapshot(filters: ReportFilters): Promise<TicketReportRow[]> {
  const [res, usersRes] = await Promise.all([
    buildTicketQuery(filters, ["CLOSED", "DUPLICATE", "VOID"]),
    supabase.from("users").select("id, full_name"),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  return (res.data || []).map((t) => toTicketRow(t, names));
}

export async function getKpiReport(filters: ReportFilters): Promise<Record<string, string | number>[]> {
  const { data } = await buildTicketQuery(filters);
  const [slaRes, holidaysRes] = await Promise.all([
    supabase.from("sla_config").select("priority, target_hours"),
    supabase.from("holidays").select("date").eq("is_active", true),
  ]);
  const slaTargets = Object.fromEntries(
    (slaRes.data || []).map((r) => [r.priority, Number(r.target_hours)]),
  );
  const holidays = (holidaysRes.data || []).map((h) => h.date);
  const tickets = data || [];
  const rows: Record<string, string | number>[] = [];
  for (const p of ["P1", "P2", "P3"]) {
    const group = tickets.filter((t) => t.priority === p);
    if (group.length === 0) continue;
    const closed = group.filter((t) => t.status === "CLOSED" || t.status === "DUPLICATE");
    const active = group.filter((t) => ACTIVE_STATUSES.includes(t.status));
    const overdue = active.filter((t) => {
      const target = slaTargets[t.priority] ?? PRIORITY_DEFAULTS[t.priority];
      return !!target && isSlaOverdue(t.created_at, target, holidays);
    }).length;
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

// Jadwal penugasan ditulis sebagai string di detail aktivitas ("Jadwal: YYYY-MM-DD HH:mm").
// Ambil dari aktivitas terbaru (pola sama dengan getAssignmentInfo di TicketDrawer).
function findJadwal(items: { details?: string | null }[]): string | undefined {
  for (const act of [...items].reverse()) {
    const m = (act.details || "").match(/Jadwal:\s*([^.]+)/);
    if (m) return m[1].trim();
  }
  return undefined;
}

export async function getOvertimeReport(
  filters: ReportFilters,
): Promise<Record<string, string | number>[]> {
  const [res, usersRes] = await Promise.all([
    buildTicketQuery(filters),
    supabase.from("users").select("id, full_name"),
  ]);
  const names = new Map((usersRes.data || []).map((u) => [u.id, u.full_name]));
  const tickets = res.data || [];
  if (tickets.length === 0) return [];

  const { data: activities } = await supabase
    .from("activities")
    .select("ticket_id, action, details")
    .in("ticket_id", tickets.map((t) => t.id));

  const byTicket = new Map<string, { details?: string | null }[]>();
  for (const a of activities || []) {
    const list = byTicket.get(a.ticket_id) || [];
    list.push(a);
    byTicket.set(a.ticket_id, list);
  }

  const rows: Record<string, string | number>[] = [];
  for (const t of tickets) {
    const jadwal = findJadwal(byTicket.get(t.id) || []);
    // isScheduleOvertime: akhir pekan ATAU jam di luar 08.15–17.00 WIB.
    if (!jadwal || !isScheduleOvertime(jadwal)) continue;
    const [tanggal, jam] = jadwal.split(" ");
    rows.push({
      teknisi: t.assigned_to ? names.get(t.assigned_to) || "-" : "-",
      tanggal: tanggal || jadwal,
      jam: jam || "",
      prioritas: t.priority || "P3",
      tiket: t.code,
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

export async function getMasterDataReport(): Promise<Record<string, string>[]> {
  const [customers, sites, units, regions] = await Promise.all([
    supabase.from("customers").select("id, name, address, phone"),
    supabase.from("sites").select("id, name, customer_id, region_id, pic_name, pic_phone, address"),
    supabase.from("units").select("id, name, site_id, serial_number, type"),
    supabase.from("regions").select("id, name"),
  ]);
  const customerName = new Map((customers.data || []).map((c) => [c.id, c.name]));
  const regionName = new Map((regions.data || []).map((r) => [r.id, r.name]));
  const siteById = new Map((sites.data || []).map((s) => [s.id, s]));
  const rows: Record<string, string>[] = [];
  for (const c of customers.data || [])
    rows.push({
      tipe: "Customer",
      nama: c.name,
      customer: c.name,
      site: "",
      region: "",
      serial: "",
      tipe_unit: "",
      pic: "",
      wa: "",
      alamat: c.address || "",
      telepon: c.phone || "",
    });
  for (const s of sites.data || [])
    rows.push({
      tipe: "Site",
      nama: s.name,
      customer: customerName.get(s.customer_id) || "",
      site: s.name,
      region: regionName.get(s.region_id) || "",
      serial: "",
      tipe_unit: "",
      pic: s.pic_name || "",
      wa: s.pic_phone || "",
      alamat: s.address || "",
      telepon: "",
    });
  for (const u of units.data || []) {
    const site = siteById.get(u.site_id);
    rows.push({
      tipe: "Unit",
      nama: u.name,
      customer: customerName.get(site?.customer_id) || "",
      site: site?.name || "",
      region: "",
      serial: u.serial_number || "",
      tipe_unit: u.type || "",
      pic: "",
      wa: "",
      alamat: "",
      telepon: "",
    });
  }
  return rows;
}

export { getSites, type SiteRow };
