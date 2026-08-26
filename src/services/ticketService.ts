import { supabase } from '@/lib/supabase'
import { uploadAttachment } from '@/services/photoService'

export function generateTicketCode(): string {
  const now = new Date()
  const y = now.getFullYear()
  const m = String(now.getMonth() + 1).padStart(2, '0')
  const d = String(now.getDate()).padStart(2, '0')
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  let rand = ''
  for (let i = 0; i < 4; i++) rand += chars[Math.floor(Math.random() * chars.length)]
  return `ATC-${y}${m}${d}-${rand}`
}

export interface CreateTicketPayload {
  reporterName: string
  position: string
  phone: string
  site: string
  unit: string
  description: string
  photos?: File[]
  onUploadProgress?: (fraction: number) => void
}

export async function createTicket(data: CreateTicketPayload) {
  let photos: string[] = []
  if (data.photos?.length) {
    // Foto portal → Storage (bukan data URL) agar kolom DB tidak membengkak (K2).
    const folder = `ticket-photos/guest/${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`
    try {
      const files = data.photos
      const fracs = new Array(files.length).fill(0)
      photos = await Promise.all(files.map((f, i) => uploadAttachment(f, folder, (p) => {
        fracs[i] = p
        data.onUploadProgress?.(fracs.reduce((a, b) => a + b, 0) / files.length)
      })))
    } catch {
      return { error: 'Gagal mengunggah foto. Silakan coba lagi.' }
    }
  }

  // RPC SECURITY DEFINER: validasi + insert dilakukan di sisi server (RLS anon
  // tidak lagi mengizinkan insert langsung ke tickets/activities).
  const { data: result, error } = await supabase.rpc("create_public_ticket", {
    p_reporter_name: data.reporterName,
    p_position: data.position,
    p_phone: data.phone,
    p_site: data.site,
    p_unit: data.unit,
    p_description: data.description,
    p_photos: photos,
  })

  if (error) {
    console.error("createTicket error:", error)
    return { error: 'Gagal mengirim tiket. Silakan coba lagi.' }
  }

  const res = result as { code?: string; error?: string }
  if (res.error) return { error: res.error }
  return { code: res.code }
}

// Tandai konfirmasi WA terkirim (Jalur B) → auto-close cron menutup setelah 24 jam (K3).
export async function setConfirmSent(ticketId: string): Promise<boolean> {
  const { error } = await supabase.rpc("set_confirm_sent", { p_ticket_id: ticketId })
  return !error
}

// Teknisi pendukung meminta pengalihan penanggung jawab (persetujuan PM via
// approve_backup). Sinyal + audit; bukan takeover langsung.
export async function requestBackup(ticketId: string, reason?: string | null): Promise<boolean> {
  const { error } = await supabase.rpc("request_backup", { p_ticket_id: ticketId, p_reason: reason ?? null })
  return !error
}

export interface BackupRequest {
  requester_id: string
  requester_name: string
  requested_at: string
}

// Request pengalihan yang masih menunggu persetujuan PM (null jika tidak ada).
export async function getBackupRequest(ticketId: string): Promise<BackupRequest | null> {
  const { data, error } = await supabase.rpc("get_backup_request", { p_ticket_id: ticketId })
  if (error) return null
  return (data as BackupRequest) || null
}

export async function approveBackup(ticketId: string): Promise<boolean> {
  const { error } = await supabase.rpc("approve_backup", { p_ticket_id: ticketId })
  return !error
}

export async function rejectBackup(ticketId: string): Promise<boolean> {
  const { error } = await supabase.rpc("reject_backup", { p_ticket_id: ticketId })
  return !error
}

// Teknisi pendukung (role 'teknisi' di ticket_assignments) yang sedang ditugaskan.
// Dipakai prefill form ganti teknisi; lead ada di tickets.assigned_to.
export async function getSupportMemberIds(ticketId: string): Promise<string[]> {
  const { data } = await supabase
    .from("ticket_assignments")
    .select("user_id")
    .eq("ticket_id", ticketId)
    .eq("role", "teknisi")
  return (data ?? []).map((r) => r.user_id)
}

// Isi kategori/akar kendala tiket (RPC terpisah dari transisi status).
export async function setTicketCatalog(
  ticketId: string,
  categoryId?: string | null,
  rootCauseId?: string | null,
  rootCauseNote?: string | null,
): Promise<boolean> {
  const { error } = await supabase.rpc("set_ticket_catalog", {
    p_ticket_id: ticketId,
    p_category_id: categoryId ?? null,
    p_root_cause_id: rootCauseId ?? null,
    p_root_cause_note: rootCauseNote ?? null,
  });
  return !error;
}

export interface LandingStats {
  active_units: number
  customers: string[]
  total_tickets: number
  resolved_this_month: number
  sla: Record<string, number>
}

export async function getLandingStats(): Promise<LandingStats> {
  const { data } = await supabase.rpc("get_landing_stats")
  return (
    data ?? { active_units: 0, customers: [], total_tickets: 0, resolved_this_month: 0, sla: { P1: 4, P2: 24, P3: 72 } }
  ) as LandingStats
}

export async function recordGps(ticketId: string, lat: number, lon: number, phase: 'start' | 'end') {
  const { error } = await supabase.rpc("record_gps", {
    p_ticket_id: ticketId,
    p_lat: lat,
    p_lon: lon,
    p_phase: phase,
  })
  return !error
}

export interface GpsPoint {
  lat: number
  lon: number
  phase: 'start' | 'end'
  captured_at: string
}

export async function getTicketGps(code: string): Promise<GpsPoint[]> {
  const { data } = await supabase
    .from("ticket_gps")
    .select("lat, lon, phase, captured_at, tickets!inner(code)")
    .eq("tickets.code", code)
  return (data ?? []) as unknown as GpsPoint[]
}
