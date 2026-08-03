import { supabase } from "@/integrations/supabase/client";
import { logActivity } from "./master-data";

export interface SlaPreset {
  id: string;
  priority: string;
  target_hours: number;
}

export interface HolidayRow {
  id: string;
  name: string;
  date: string;
  is_active: boolean;
}

export const PRIORITY_DEFAULTS: Record<string, number> = { P1: 4, P2: 24, P3: 72 };

interface SlaBatchRow {
  ticket_id: string;
  remaining_hours: number;
}

// Sisa SLA (jam) per tiket, dihitung server-side (RPC compute_sla_batch).
// Negatif = overdue. Kosong/error → kembalikan map kosong (pemanggil fallback).
export async function fetchSlaRemaining(ticketIds: string[]): Promise<Map<string, number>> {
  const m = new Map<string, number>();
  if (!ticketIds.length) return m;
  const { data, error } = await supabase.rpc("compute_sla_batch", { p_ids: ticketIds });
  if (error || !data) return m;
  for (const row of data as SlaBatchRow[]) {
    m.set(row.ticket_id, Number(row.remaining_hours));
  }
  return m;
}

export async function getSlaConfig(): Promise<SlaPreset[]> {
  const { data } = await supabase.from("sla_config").select("*").order("priority");
  const rows = (data || []) as SlaPreset[];
  if (rows.length === 0) {
    for (const [priority, target_hours] of Object.entries(PRIORITY_DEFAULTS)) {
      await supabase.from("sla_config").upsert({ priority, target_hours }, { onConflict: "priority" }).select();
    }
    const { data: seeded } = await supabase.from("sla_config").select("*").order("priority");
    return (seeded || []) as SlaPreset[];
  }
  return rows;
}

export async function saveSlaTarget(priority: string, hours: number): Promise<boolean> {
  const { data: existing } = await supabase
    .from("sla_config")
    .select("target_hours")
    .eq("priority", priority)
    .maybeSingle();
  const { error } = await supabase
    .from("sla_config")
    .upsert({ priority, target_hours: hours }, { onConflict: "priority" });
  if (error) return false;
  await logActivity("update_sla", "sla_config", priority, {
    before: existing?.target_hours,
    after: hours,
  });
  return true;
}

export async function getHolidays(): Promise<HolidayRow[]> {
  const { data } = await supabase.from("holidays").select("*").order("date");
  return (data || []) as HolidayRow[];
}

export async function addHoliday(
  name: string,
  date: string,
): Promise<{ ok: boolean; error?: string }> {
  const { data, error } = await supabase
    .from("holidays")
    .insert({ name, date, is_active: true })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logActivity("add_holiday", "holidays", data.id, { name, date });
  return { ok: true };
}

export async function deleteHoliday(id: string): Promise<boolean> {
  const { error } = await supabase.from("holidays").delete().eq("id", id);
  if (error) return false;
  await logActivity("delete_holiday", "holidays", id);
  return true;
}

export async function toggleHoliday(id: string, active: boolean): Promise<boolean> {
  const { error } = await supabase.from("holidays").update({ is_active: active }).eq("id", id);
  if (error) return false;
  await logActivity("toggle_holiday", "holidays", id, { is_active: active });
  return true;
}
