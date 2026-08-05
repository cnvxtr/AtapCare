import { supabase } from "@/integrations/supabase/client";
import { getSites, type SiteRow } from "./master-data";
import { PRIORITY_DEFAULTS } from "./sla";
import { isSlaOverdue } from "./slaCalc";

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
  priority: string;
  status: string;
  createdAt: string;
  closedAt: string;
  assignee: string;
  duration: string;
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
  "Durasi",
];

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

async function buildTicketQuery(filters: ReportFilters) {
  let q = supabase
    .from("tickets")
    .select(
      "id, code, customer, site, unit, priority, status, assigned_to, sla_time_left, rejection_reason, created_at, closed_at",
    )
    .order("created_at", { ascending: false });
  if (filters.from) q = q.gte("created_at", dayStart(filters.from));
  if (filters.to) q = q.lte("created_at", dayEnd(filters.to));
  if (filters.status?.length) {
    const raws = filters.status.flatMap((s) => STATUS_FILTER_GROUPS[s] ?? [s]);
    if (raws.length) q = q.in("status", raws);
  }
  if (filters.priority?.length) q = q.in("priority", filters.priority);
  if (filters.siteId?.length) {
    const { data: sites } = await supabase.from("sites").select("name").in("id", filters.siteId);
    const names = (sites || []).map((s) => s.name).filter(Boolean);
    if (names.length) q = q.in("site", names);
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
    duration: `${hours} jam`,
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
