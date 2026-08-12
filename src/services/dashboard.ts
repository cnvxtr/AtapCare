import { supabase } from "@/integrations/supabase/client";
import { getCustomers, getSites, getUnits } from "./master-data";

export interface AdminActivityRow {
  waktu: string;
  user: string;
  aktivitas: string;
}

export interface AdminFrtData {
  avgHours: number;
  responded: number;
  total: number;
}

export interface LeaderboardRow {
  name: string;
  completed: number;
}

export interface AdminMonthlyData {
  ticketsDone: number;
  leaderboard: LeaderboardRow[];
}

export interface AdminSystemData {
  totalUsers: number;
  totalCustomers: number;
  totalUnits: number;
  unitDist: { name: string; count: number }[];
}

const ACTIVITY_LABELS: Record<string, string> = {
  update_sla: "mengubah target SLA",
  sync_holidays: "menyinkronkan hari libur",
  update_user: "memperbarui user",
  reset_password: "mereset password user",
  delete_user: "menghapus user",
  archive_reveal: "membuka arsip",
  create: "menambah",
  update: "mengubah",
  soft_delete: "mengarsipkan",
  restore: "memulihkan",
};

const ENTITY_LABELS: Record<string, string> = {
  customers: "pelanggan",
  sites: "site",
  units: "unit",
  problem_categories: "kategori masalah",
  root_causes: "akar masalah",
  sla_config: "SLA",
  holidays: "hari libur",
  users: "user",
};

function fmtWaktu(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getDate()).padStart(2, "0")} ${d.toLocaleString("id-ID", { month: "short" })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function labelActivity(action: string, entityType: string, metadata: Record<string, unknown> | null): string {
  const verb = ACTIVITY_LABELS[action] || action;
  const entity = ENTITY_LABELS[entityType] || entityType;
  const name = typeof metadata?.name === "string" ? metadata.name : undefined;
  return name ? `${verb} ${entity} "${name}"` : `${verb} ${entity}`;
}

export async function getAdminSystemData(): Promise<AdminSystemData> {
  const [usersRes, customers, sites, units] = await Promise.all([
    supabase.from("users").select("id, status").eq("is_deleted", false),
    getCustomers(),
    getSites(),
    getUnits(),
  ]);

  const totalUsers = (usersRes.data || []).filter(
    (u) => !u.status || u.status === "aktif",
  ).length;

  const siteNameById = new Map(sites.map((s) => [s.id, s.name]));
  const siteCounts = new Map<string, number>();
  for (const u of units) {
    const name = siteNameById.get(u.site_id) || "Tanpa Site";
    siteCounts.set(name, (siteCounts.get(name) || 0) + 1);
  }
  const unitDist = Array.from(siteCounts.entries())
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { totalUsers, totalCustomers: customers.length, totalUnits: units.length, unitDist };
}

export async function getAdminActivities(limit = 10): Promise<AdminActivityRow[]> {
  const { data } = await supabase
    .from("audit_logs")
    .select("created_at, actor_name, action, entity_type, metadata")
    .order("created_at", { ascending: false })
    .limit(limit);

  return (data || []).map((r) => ({
    waktu: fmtWaktu(r.created_at),
    user: r.actor_name || "—",
    aktivitas: labelActivity(r.action, r.entity_type, (r.metadata as Record<string, unknown>) || null),
  }));
}

export async function getAdminFrt(): Promise<AdminFrtData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [ticketsRes, activitiesRes] = await Promise.all([
    supabase.from("tickets").select("id, created_at").gte("created_at", monthStart),
    supabase.from("activities").select("ticket_id, created_at, action"),
  ]);

  const tickets = ticketsRes.data || [];
  const createdById = new Map(tickets.map((t) => [t.id, new Date(t.created_at).getTime()]));
  const activities = (activitiesRes.data || []).filter((a) => createdById.has(a.ticket_id));

  const respondedAt = new Map<string, number>();
  for (const a of activities) {
    if (a.action !== "Tiket divalidasi") continue;
    const ms = new Date(a.created_at).getTime() - createdById.get(a.ticket_id)!;
    const prev = respondedAt.get(a.ticket_id);
    if (prev === undefined || ms < prev) respondedAt.set(a.ticket_id, ms);
  }

  const values = [...respondedAt.values()].filter((ms) => ms >= 0);
  const avgHours = values.length ? values.reduce((s, v) => s + v, 0) / values.length / 3_600_000 : 0;

  return { avgHours, responded: values.length, total: tickets.length };
}

export async function getAdminMonthlyData(): Promise<AdminMonthlyData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [closedRes, usersRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, assigned_to")
      .eq("status", "CLOSED")
      .gte("created_at", monthStart),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("is_deleted", false),
  ]);

  const closed = closedRes.data || [];
  const users = usersRes.data || [];
  const userNameById = new Map(users.map((u) => [u.id, u.full_name]));

  const counts = new Map<string, number>();
  for (const t of closed) {
    const name = t.assigned_to ? userNameById.get(t.assigned_to) || "Teknisi" : "Unassigned";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  const leaderboard = Array.from(counts.entries()).map(([name, completed]) => ({
    name,
    completed,
  }));

  return { ticketsDone: closed.length, leaderboard };
}
