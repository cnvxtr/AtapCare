import { supabase } from "@/integrations/supabase/client";

export const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  helpdesk: "Helpdesk",
  pm: "Project Manager",
  teknisi: "Teknisi Lapangan",
};

export async function getTechnicians(): Promise<Array<{ id: string; name: string }>> {
  const { data } = await supabase
    .from("users")
    .select("id, full_name")
    .eq("role", "teknisi")
    .eq("is_deleted", false)
    .order("full_name");
  return (data || []).map((u) => ({ id: u.id, name: u.full_name || u.id }));
}
