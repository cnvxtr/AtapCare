import { supabase } from '@/lib/supabase'

function generateCode(): string {
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
}

export async function createTicket(data: CreateTicketPayload) {
  const code = generateCode()

  const { error } = await supabase.from('tickets').insert({
    code,
    customer: data.reporterName,
    company: data.site,
    site: data.site,
    unit: data.unit,
    location: data.site,
    category: data.unit,
    description: `Jabatan: ${data.position}\nWA Pelapor: ${data.phone}\n\n${data.description}`,
    status: 'NEW',
    priority: 'P2',
    created_by: null,
  })

  if (error) {
    console.error('createTicket error:', error)
    const isFK = error.code === '23503'
    return {
      error: isFK
        ? 'Site atau Unit belum terdaftar di sistem. Silakan hubungi Helpdesk via WhatsApp Group.'
        : 'Gagal mengirim tiket. Silakan coba lagi.',
    }
  }

  return { code }
}

export async function getTicketByCode(code: string) {
  const { data, error } = await supabase
    .from('tickets')
    .select('status, site, unit, location, description, created_at, updated_at, assigned_to')
    .eq('code', code)
    .single()

  if (error || !data) return null

  let technicianName: string | null = null
  if (data.assigned_to) {
    const { data: userData } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', data.assigned_to)
      .single()
    technicianName = userData?.full_name || null
  }

  return {
    status: data.status,
    site: data.site || '-',
    unit: data.unit || '-',
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    technicianName,
  }
}

export const SITES = ['Merak', 'Bakauheni', 'Balongan', 'Sungai Ambawang']
export const UNITS = ['VMS Display Panel', 'VMS Controller', 'Sensor Loop', 'TC 200', 'TC 300']
