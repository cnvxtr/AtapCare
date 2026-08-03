import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./master-data";
import { deliverBroadcast } from "./notifications";

export interface Broadcast {
  id: string;
  title: string;
  message: string;
  recipients: string;
  status: string;
  created_at: string;
}

export const RECIPIENT_OPTIONS: { value: string; label: string }[] = [
  { value: "semua", label: "Semua Pengguna" },
  { value: "helpdesk", label: "Helpdesk" },
  { value: "pm", label: "Project Manager" },
  { value: "teknisi", label: "Teknisi Lapangan" },
  { value: "admin", label: "Admin" },
];

export async function getBroadcasts(): Promise<Broadcast[]> {
  const { data } = await supabase.from("broadcasts").select("*").order("created_at", { ascending: false });
  return (data || []) as Broadcast[];
}

interface NewBroadcast {
  title: string;
  message: string;
  recipients: string;
  scheduleNow: boolean;
  scheduledAt?: string;
}

export async function createBroadcast(
  input: NewBroadcast,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("broadcasts")
    .insert({
      title: input.title,
      message: input.message || "",
      recipients: input.recipients,
      status: "terjadwal",
      scheduled_at: input.scheduleNow ? new Date().toISOString() : input.scheduledAt || null,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity("create_broadcast", "broadcasts", data.id, { title: input.title });
  if (input.scheduleNow) await deliverBroadcast(data.id);
  return { ok: true };
}

export async function cancelBroadcast(id: string): Promise<boolean> {
  const { error } = await supabase
    .from("broadcasts")
    .update({ status: "dibatalkan" })
    .eq("id", id);
  if (error) return false;
  await logActivity("cancel_broadcast", "broadcasts", id);
  return true;
}
