import { supabase } from "@/integrations/supabase/client";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string | null;
}

// Unread-only: notif yang sudah ditandai dibaca tidak muncul lagi (persisten
// antar sesi), sinkron dengan badge. History lama tidak bisa dilihat kembali.
export async function getMyNotifications(userId: string): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, read, created_at, ticket_id")
    .eq("user_id", userId)
    .eq("read", false)
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

// Tandai satu notif dibaca (dipakai setelah aksi inline, agar tidak muncul lagi).
export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}
