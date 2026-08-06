import { supabase } from "@/integrations/supabase/client";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  helpdesk: "Helpdesk",
  pm: "Project Manager",
  teknisi: "Teknisi Lapangan",
};

export async function getTechnicians(): Promise<Array<{ id: string; name: string }>> {
  // Role teknisi bisa jadi role aktif ATAU ada di daftar roles multi-role
  // (mis. admin+teknisi) — kolom roles berisi CSV (migration 12).
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .or("role.eq.teknisi,roles.like.%teknisi%")
    .eq("is_deleted", false)
    .order("full_name");
  return (data || []).map((u) => ({ id: u.id, name: u.full_name || u.id }));
}
