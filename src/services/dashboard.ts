import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_DEFAULTS } from "./sla";
import { isSlaOverdue } from "./slaCalc";

export interface AdminRealtimeData {
  activeUsers: number;
  workOrdersActive: number;
  slaOverdue: number;
  priorityDist: Record<"P1" | "P2" | "P3", number>;
}

export interface LeaderboardRow {
  name: string;
  completed: number;
  rework: number;
  reworkRate: number;
}

export interface AdminMonthlyData {
  ticketsDone: number;
  leaderboard: LeaderboardRow[];
}

const ACTIVE_STATUSES = [
  "NEW",
  "OPEN",
  "UNASSIGNED",
  "SCHEDULED",
  "EN_ROUTE",
  "WORKING",
  "PENDING",
];

export async function getAdminRealtimeData(): Promise<AdminRealtimeData> {
  const [ticketsRes, usersRes, slaRes, holidaysRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, priority, status, created_at"),
    supabase
      .from("users")
      .select("id, status")
      .eq("is_deleted", false),
    supabase.from("sla_config").select("priority, target_hours"),
    supabase.from("holidays").select("date").eq("is_active", true),
  ]);

  const tickets = ticketsRes.data || [];
  const users = usersRes.data || [];
  const slaTargets = Object.fromEntries(
    (slaRes.data || []).map((r) => [r.priority, Number(r.target_hours)]),
  );
  const holidays = (holidaysRes.data || []).map((h) => h.date);

  const activeUsers = users.filter((u) => !u.status || u.status === "aktif").length;
  const workOrdersActive = tickets.filter((t) => t.status === "WORKING").length;

  const active = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const slaOverdue = active.filter((t) => {
    const target = slaTargets[t.priority] ?? PRIORITY_DEFAULTS[t.priority];
    return !!target && isSlaOverdue(t.created_at, target, holidays);
  }).length;

  const priorityDist = { P1: 0, P2: 0, P3: 0 } as Record<"P1" | "P2" | "P3", number>;
  for (const t of tickets) {
    if (t.status === "CLOSED") continue;
    const p = t.priority as "P1" | "P2" | "P3";
    if (p === "P1" || p === "P2" || p === "P3") priorityDist[p]++;
  }

  return { activeUsers, workOrdersActive, slaOverdue, priorityDist };
}

export interface AdminFrtData {
  avgHours: number;
  responded: number;
  total: number;
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
    if (a.action.startsWith("Tiket dibuat")) continue;
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
      .select("id, assigned_to, rejection_reason")
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

  const byTech = new Map<string, { completed: number; rework: number }>();
  for (const t of closed) {
    const name = t.assigned_to ? userNameById.get(t.assigned_to) || "Teknisi" : "Unassigned";
    const cur = byTech.get(name) || { completed: 0, rework: 0 };
    cur.completed++;
    if (t.rejection_reason) cur.rework++;
    byTech.set(name, cur);
  }

  const leaderboard = Array.from(byTech.entries()).map(([name, v]) => ({
    name,
    completed: v.completed,
    rework: v.rework,
    reworkRate: v.completed ? Math.round((v.rework / v.completed) * 100) : 0,
  }));

  return { ticketsDone: closed.length, leaderboard };
}
