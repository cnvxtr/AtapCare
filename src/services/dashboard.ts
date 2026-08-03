import { supabase } from "@/integrations/supabase/client";
import { PRIORITY_DEFAULTS } from "./sla";
import { isSlaOverdue } from "./slaCalc";
import { getOvertimeReport } from "./reports";

export interface DateRange {
  from: string;
  to: string;
}

export type RangeLabel = "today" | "week" | "month" | "custom";

export interface LeaderboardRow {
  name: string;
  completed: number;
  rework: number;
  reworkRate: number;
}

export interface DashboardData {
  slaOverdue: number;
  ticketsDone: number;
  activeUsers: number;
  workOrdersActive: number;
  onLeaveToday: number;
  lockedAccounts: number;
  leaderboard: LeaderboardRow[];
  priorityDist: Record<"P1" | "P2" | "P3", number>;
  overtimeTickets: number;
  dataAgeMinutes: number;
  hasData: boolean;
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

export function getDefaultRange(label: RangeLabel): DateRange {
  const now = new Date();
  const start = new Date(now);
  if (label === "today") {
    start.setHours(0, 0, 0, 0);
  } else if (label === "week") {
    // Minggu kalender dimulai Senin (hari ini minus offset ISO weekday).
    const day = (start.getDay() + 6) % 7; // 0 = Senin
    start.setDate(start.getDate() - day);
    start.setHours(0, 0, 0, 0);
  } else if (label === "month") {
    start.setDate(1);
    start.setHours(0, 0, 0, 0);
  } else {
    // custom: fallback 30 hari terakhir bila picker belum diisi
    start.setDate(start.getDate() - 30);
    start.setHours(0, 0, 0, 0);
  }
  return { from: start.toISOString(), to: now.toISOString() };
}

export async function getDashboardData(range: DateRange): Promise<DashboardData> {
  const [ticketsRes, usersRes, slaRes, holidaysRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, priority, status, assigned_to, sla_time_left, rejection_reason, created_at, closed_at")
      .gte("created_at", range.from)
      .lte("created_at", range.to),
    supabase
      .from("users")
      .select("id, full_name, status, role")
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
  const userNameById = new Map(users.map((u) => [u.id, u.full_name]));

  const active = tickets.filter((t) => ACTIVE_STATUSES.includes(t.status));
  const closed = tickets.filter((t) => t.status === "CLOSED" || t.status === "DUPLICATE");

  // sla_time_left di DB tidak pernah diisi; overdue dihitung real-time dari created_at,
  // target SLA per prioritas, dan jam operasional (lihat slaCalc).
  const slaOverdue = active.filter((t) => {
    const target = slaTargets[t.priority] ?? PRIORITY_DEFAULTS[t.priority];
    return !!target && isSlaOverdue(t.created_at, target, holidays);
  }).length;

  const priorityDist = { P1: 0, P2: 0, P3: 0 } as Record<"P1" | "P2" | "P3", number>;
  for (const t of tickets) {
    const p = t.priority as "P1" | "P2" | "P3";
    if (p === "P1" || p === "P2" || p === "P3") priorityDist[p]++;
  }

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

  // ponytail: durasi lembur per tiket tidak tercatat (tidak ada "jam selesai"),
  // jadi KPI = jumlah tiket yang dijadwalkan di luar jam operasional/weekend.
  const overtimeTickets = (await getOvertimeReport({ from: range.from, to: range.to })).length;

  return {
    slaOverdue,
    ticketsDone: closed.length,
    activeUsers: users.filter((u) => !u.status || u.status === "aktif").length,
    workOrdersActive: tickets.filter((t) => t.status === "WORKING").length,
    onLeaveToday: users.filter((u) => u.status === "cuti").length,
    lockedAccounts: users.filter((u) => u.status === "nonaktif").length,
    leaderboard,
    priorityDist,
    overtimeTickets,
    dataAgeMinutes: 0,
    hasData: tickets.length > 0,
  };
}
