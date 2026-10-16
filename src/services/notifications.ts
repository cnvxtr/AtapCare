import { supabase } from "@/lib/supabase";

export interface NotificationRow {
  id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  ticket_id?: string | null;
}

// 50 notif terbaru (read maupun belum). Notif yang sudah dibaca tetap tampil
// (redup) sampai dihapus lewat tombol Hapus; badge dihitung terpisah.
export async function getMyNotifications(userId: string): Promise<NotificationRow[]> {
  const { data } = await supabase
    .from("notifications")
    .select("id, title, message, read, created_at, ticket_id")
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

// Tandai satu notif dibaca (dipakai setelah aksi inline, agar tidak muncul lagi).
export async function markNotificationRead(id: string): Promise<void> {
  await supabase.from("notifications").update({ read: true }).eq("id", id);
}

// Kode tiket selalu disertakan di judul/pesan notif (mis. "Tiket ATC-20261012-3
// selesai"). column ticket_id di DB praktis selalu NULL, jadi kode diambil dari
// teks. ponytail: bergantung pada format kode ATC-YYYYMMDD-xxxx yang konsisten;
// kalau format berubah, isi kolom ticket_id di fungsi notify_* lalu baca itu.
export function ticketCodeFromNotif(n: Pick<NotificationRow, "title" | "message">): string | null {
  const m = `${n.title || ""} ${n.message || ""}`.match(/ATC-\d{8}-[A-Za-z0-9]+/)
  return m ? m[0] : null
}

// Kode tiket tujuan dari navigasi notif: lewat router state (klik di dalam
// aplikasi) atau query ?open= (deep link push browser / APK).
export function notifyTicketCode(state: unknown, search: string): string | null {
  const fromState = (state as { __openTicketCode?: string } | null)?.__openTicketCode
  return fromState || new URLSearchParams(search).get("open") || null
}
