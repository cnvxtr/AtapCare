import { supabase } from "@/lib/supabase";
import { getCustomers, getSites, getUnits } from "./master-data";

interface LeaderboardRow {
  name: string;
  completed: number;
}

export interface AdminMonthlyData {
  ticketsDone: number;
  leaderboard: LeaderboardRow[];
}

export interface AdminSystemData {
  totalCustomerAccounts: number;
  totalUsers: number;
  totalCompanies: number;
  totalUnits: number;
  unitDist: { name: string; count: number }[];
}

export async function getAdminSystemData(): Promise<AdminSystemData> {
  const [usersRes, customers, sites, units] = await Promise.all([
    supabase.from("users").select("id, role, status").eq("is_deleted", false),
    getCustomers(),
    getSites(),
    getUnits(),
  ]);

  const activeUsers = (usersRes.data || []).filter(
    (u) => !u.status || u.status === "aktif",
  );
  const totalUsers = activeUsers.length;
  const totalCustomerAccounts = activeUsers.filter(
    (u) => u.role === "customer",
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

  return { totalCustomerAccounts, totalUsers, totalCompanies: customers.length, totalUnits: units.length, unitDist };
}

export async function getAdminMonthlyData(): Promise<AdminMonthlyData> {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();

  const [closedRes, usersRes, assignmentsRes] = await Promise.all([
    supabase
      .from("tickets")
      .select("id, assigned_to")
      .eq("status", "CLOSED")
      .gte("created_at", monthStart),
    supabase
      .from("users")
      .select("id, full_name")
      .eq("is_deleted", false),
    supabase
      .from("ticket_assignments")
      .select("ticket_id, user_id, role"),
  ]);

  const closed = closedRes.data || [];
  const users = usersRes.data || [];
  const userNameById = new Map(users.map((u) => [u.id, u.full_name]));

  const closedIds = new Set(closed.map((t) => t.id));
  const counts = new Map<string, number>();
  for (const t of closed) {
    if (!t.assigned_to) continue; // tiket tanpa penugasan bukan bagian leaderboard teknisi
    const name = userNameById.get(t.assigned_to) || "Teknisi";
    counts.set(name, (counts.get(name) || 0) + 1);
  }
  // Pendukung (role 'teknisi') ikut dihitung sebagai 1 tiket per tiket CLOSED
  // periode ini; gabung ke skor yang sama dengan lead.
  for (const a of assignmentsRes.data || []) {
    if (a.role !== "teknisi" || !closedIds.has(a.ticket_id)) continue;
    const name = userNameById.get(a.user_id) || "Teknisi";
    counts.set(name, (counts.get(name) || 0) + 1);
  }

  // Union nama lead + pendukung: teknisi yang hanya jadi pendukung tetap muncul.
  const leaderboard = Array.from(counts.entries()).map(([name, completed]) => ({
    name,
    completed,
  })).sort((a, b) => b.completed - a.completed);

  return { ticketsDone: closed.length, leaderboard };
}
