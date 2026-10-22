import { supabase } from "@/lib/supabase";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string | null;
  target_role?: string | null;
}

export async function getMyNotifications(userId: string): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, read, created_at, ticket_id, target_role")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  return (data || []) as NotificationRow[];
}

export async function getUnreadCount(userId: string): Promise<number> {
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("read", false);
  return count || 0;
}

export async function markAllRead(userId: string): Promise<void> {
  await supabase
    .from("notifications")
    .update({ read: true })
    .eq("user_id", userId)
    .eq("read", false);
}

export async function deleteAllNotifications(userId: string): Promise<void> {
  await supabase.from("notifications").delete().eq("user_id", userId);
}

export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

export function ticketCodeFromNotif(n: Pick<NotificationRow, "title" | "message">): string | null {
  const m = `${n.title || ""} ${n.message || ""}`.match(/ATC-\d{8}-[A-Za-z0-9]+/)
  return m ? m[0] : null
}

export function notifyTicketCode(state: unknown, search: string): string | null {
  const fromState = (state as { __openTicketCode?: string } | null)?.__openTicketCode
  return fromState || new URLSearchParams(search).get("open") || null
}
