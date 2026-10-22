import { supabase } from "@/lib/supabase";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Administrator",
  helpdesk: "Helpdesk",
  pm: "Project Manager",
  teknisi: "Teknisi Lapangan",
  executive: "Executive",
  customer: "Pelanggan",
};

export async function getTechnicians(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .or("role.eq.teknisi,roles.like.%teknisi%")
    .eq("is_deleted", false)
    .eq("status", "aktif")
    .order("full_name");
  return (data || []).map((u) => ({ id: u.id, name: u.full_name || u.id }));
}
