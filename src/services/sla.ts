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
  kind: string; // 'holiday' (nasional) | 'leave' (cuti bersama)
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

// Sinkronkan hari libur (nasional + cuti bersama) tahun berjalan dari API publik
// tanggalmerah.upset.dev. Insert hanya tanggal yang belum ada; row lama dipertahankan
// status is_active-nya. Cuti bersama ikut membekukan SLA seperti libur nasional.
// ponytail: API pihak ketiga gratis — jika mati, ganti konstanta URL ini.
const NATIONAL_HOLIDAY_API = "https://tanggalmerah.upset.dev/api/holidays";

// ponytail: panggilan bersamaan (StrictMode dev, klik cepat) ikut satu proses yang sama
// supaya tidak insert ganda; setiap sync juga membersihkan duplikat DB yang sudah terlanjur ada.
let syncInFlight: Promise<{ added: number; error?: string }> | null = null;

export function syncHolidays(): Promise<{ added: number; error?: string }> {
  if (!syncInFlight) {
    syncInFlight = doSyncHolidays().finally(() => {
      syncInFlight = null;
    });
  }
  return syncInFlight;
}

async function doSyncHolidays(): Promise<{ added: number; error?: string }> {
  const year = new Date().getFullYear();
  try {
    await cleanupDuplicateHolidays();
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${NATIONAL_HOLIDAY_API}?year=${year}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) return { added: 0, error: `HTTP ${res.status}` };
    const body = (await res.json()) as {
      data?: { date: string; name: string; type: string }[];
    };
    const byDate = new Map<string, { date: string; name: string; type: string }>();
    for (const r of body.data || []) {
      if (r.date && !byDate.has(r.date)) byDate.set(r.date, r);
    }
    const rows = [...byDate.values()];
    if (!rows.length) return { added: 0 };
    const existing = new Map((await getHolidays()).map((h) => [h.date, h]));
    const fresh = rows.filter((r) => !existing.has(r.date));
    const stale = rows.filter((r) => {
      const cur = existing.get(r.date);
      return !!cur && (cur.kind !== r.type || cur.name !== r.name);
    });
    if (fresh.length) {
      const { error } = await supabase.from("holidays").insert(
        fresh.map((r) => ({ name: r.name, date: r.date, is_active: true, kind: r.type })),
      );
      if (error) return { added: 0, error: error.message };
    }
    // Backfill kind untuk data lama (sebelum kolom kind ada) dan koreksi nama.
    for (const r of stale) {
      const cur = existing.get(r.date)!;
      await supabase.from("holidays").update({ kind: r.type, name: r.name }).eq("id", cur.id);
    }
    await logActivity("sync_holidays", "holidays", String(year), {
      added: fresh.length,
      updated: stale.length,
    });
    return { added: fresh.length };
  } catch (e) {
    return { added: 0, error: e instanceof Error ? e.message : "gagal" };
  }
}

// Sisa satu baris per tanggal (prioritas is_active, lalu id terkecil), hapus sisanya.
async function cleanupDuplicateHolidays(): Promise<void> {
  const rows = (await getHolidays()).sort(
    (a, b) =>
      a.date.localeCompare(b.date) ||
      (a.is_active === b.is_active ? a.id.localeCompare(b.id) : a.is_active ? -1 : 1),
  );
  const keep = new Map<string, string>();
  for (const r of rows) if (!keep.has(r.date)) keep.set(r.date, r.id);
  const ids = rows.filter((r) => keep.get(r.date) !== r.id).map((r) => r.id);
  if (ids.length) await supabase.from("holidays").delete().in("id", ids);
}
