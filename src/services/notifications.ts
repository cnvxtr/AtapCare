import { supabase } from "@/integrations/supabase/client";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export async function getMyNotifications(userId: string): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, read, created_at")
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

// Delivery via RPC SECURITY DEFINER: insert notifications untuk user lain +
// flip status broadcast di balik RLS owner-scope.
export async function deliverBroadcast(bid: string): Promise<void> {
  await supabase.rpc("deliver_broadcast", { bid });
}

// Kirim broadcast "terjadwal" yang sudah jatuh tempo. Dipanggil polling 60 detik.
export async function deliverDueBroadcasts(now = new Date()): Promise<void> {
  const { data } = await supabase
    .from("broadcasts")
    .select("id")
    .eq("status", "terjadwal")
    .lte("scheduled_at", now.toISOString());
  for (const b of data || []) await deliverBroadcast(b.id);
}
