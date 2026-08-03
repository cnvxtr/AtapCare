import { supabase } from '@/lib/supabase'
import { compressImage } from '@/lib/image'

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
}

export async function createTicket(data: CreateTicketPayload) {
  let photos: string[] = []
  if (data.photos?.length) photos = await Promise.all(data.photos.map(compressImage))

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

export async function getTicketByCode(code: string) {
  const { data, error } = await supabase.rpc("get_ticket_for_tracking", { p_code: code })
  if (error || !data) return null

  const d = data as {
    status?: string
    site?: string
    unit?: string
    created_at?: string
    updated_at?: string
    technician_name?: string | null
  }
  if (!d.status) return null

  return {
    status: d.status,
    site: d.site || '-',
    unit: d.unit || '-',
    createdAt: d.created_at ?? '',
    updatedAt: d.updated_at ?? '',
    technicianName: d.technician_name ?? null,
  }
}

export const SITES = ['Merak', 'Bakauheni', 'Balongan', 'Sungai Ambawang']
export const UNITS = ['VMS Display Panel', 'VMS Controller', 'Sensor Loop', 'TC 200', 'TC 300']
