import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from './AuthContext'

export type TicketStatus = 'NEW' | 'OPEN' | 'UNASSIGNED' | 'SCHEDULED' | 'EN_ROUTE' | 'WORKING' | 'PENDING' | 'RESOLVED' | 'CLOSED' | 'VOID' | 'DUPLICATE' | 'REJECTED'
export type Priority = 'P1' | 'P2' | 'P3'

export interface TicketActivity {
    id: string
    timestamp: string
    user: string
    action: string
    details?: string
}

export interface Ticket {
    id: string
    code: string
    customer: string
    company: string
    site?: string
    unit?: string
    assignedTo?: string
    status: TicketStatus
    priority?: Priority
    slaTimeLeft: number
    createdAt: string
    closedAt?: string
    photoUrl?: string
    resolvedBy?: 'helpdesk' | 'technician'
    category?: string
    location?: string
    description?: string
    rejectionReason?: string
    activities: TicketActivity[]
}

interface SupabaseTicketRow {
    id: string
    code: string
    customer: string
    company: string
    site?: string
    unit?: string
    assigned_to?: string
    status: TicketStatus
    priority?: Priority
    sla_time_left?: number
    created_at: string
    closed_at?: string
    photo_url?: string
    resolved_by?: 'helpdesk' | 'technician'
    category?: string
    location?: string
    description?: string
    rejection_reason?: string
    created_by?: string
    updated_at?: string
    activities?: SupabaseActivityRow[]
}

interface SupabaseActivityRow {
    id: string
    created_at: string
    user_name?: string
    action: string
    details?: string
}

interface AddTicketData {
    reporterName: string
    company?: string
    site?: string
    unit?: string
    category?: string
    location?: string
    description?: string
    photoUrl?: string
    initialStatus?: TicketStatus
    priority?: Priority
    catatanInternal?: string
}

interface TicketUpdatePayload {
    status: TicketStatus
    updated_at: string
    priority?: Priority
    resolved_by?: 'helpdesk' | 'technician'
    rejection_reason?: string
    closed_at?: string
}

interface TicketContextType {
    tickets: Ticket[]
    loading: boolean
    updateTicketStatus: (id: string, newStatus: TicketStatus, actionDetails?: string, newPriority?: Priority, resolvedBy?: 'helpdesk' | 'technician', rejectionReason?: string) => Promise<void>
    addTicket: (data: AddTicketData) => Promise<void>
    getTicketCount: (status: TicketStatus) => number
}

const TicketContext = createContext<TicketContextType | undefined>(undefined)

export const TicketProvider = ({ children }: { children: ReactNode }) => {
    const [tickets, setTickets] = useState<Ticket[]>([])
    const [loading, setLoading] = useState(true)
    const { user } = useAuth()

    const fetchTickets = useCallback(async () => {
        const { data, error } = await supabase
            .from('tickets')
            .select('*, activities(*)')
            .order('created_at', { ascending: false })

        if (error) {
            console.error('Error fetching tickets:', error)
        } else {
            const mappedTickets: Ticket[] = (data || []).map((t: SupabaseTicketRow) => ({
                id: t.id,
                code: t.code,
                customer: t.customer,
                company: t.company,
                site: t.site,
                unit: t.unit,
                assignedTo: t.assigned_to || '-',
                status: t.status,
                priority: t.priority,
                slaTimeLeft: t.sla_time_left || 24,
                createdAt: t.created_at,
                closedAt: t.closed_at,
                photoUrl: t.photo_url,
                resolvedBy: t.resolved_by,
                category: t.category,
                location: t.location,
                description: t.description,
                rejectionReason: t.rejection_reason,
                activities: (t.activities || []).map((a: SupabaseActivityRow) => ({
                    id: a.id,
                    timestamp: new Date(a.created_at).toLocaleString('id-ID'),
                    user: a.user_name || 'Sistem',
                    action: a.action,
                    details: a.details
                }))
            }))
            setTickets(mappedTickets)
        }
        setLoading(false)
    }, [])

    useEffect(() => {
        if (!user) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            setLoading(false)
            return
        }

        fetchTickets()

        const channel = supabase
            .channel('realtime-atapcare')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'tickets' }, () => {
                fetchTickets()
            })
            .on('postgres_changes', { event: '*', schema: 'public', table: 'activities' }, () => {
                fetchTickets()
            })
            .subscribe()

        return () => {
            supabase.removeChannel(channel)
        }
    }, [user, fetchTickets])

    const addTicket = async (data: AddTicketData) => {
        if (!user) return
        const today = new Date().toISOString().split('T')[0].replace(/-/g, '')
        const randomNum = Math.floor(Math.random() * 1000).toString().padStart(3, '0')
        const code = `ATP-${today}-${randomNum}`

        const initialStatus = data.initialStatus || 'NEW'
        const initialPriority = data.priority || 'P2'

        const { data: newTicket, error } = await supabase
            .from('tickets')
            .insert({
                code,
                customer: data.reporterName,
                company: data.company || 'Internal',
                site: data.site,
                unit: data.unit,
                status: initialStatus,
                priority: initialPriority,
                category: data.category,
                location: data.location,
                description: data.description,
                photo_url: data.photoUrl,
                created_by: user.id
            })
            .select()
            .single()

        if (error) {
            console.error('Error adding ticket:', error)
            alert('Gagal menyimpan tiket: ' + error.message)
        } else {
            await supabase.from('activities').insert({
                ticket_id: newTicket.id,
                user_id: user.id,
                user_name: user.full_name || user.email,
                action: `Tiket dibuat dengan status ${initialStatus}`,
                details: data.catatanInternal ? `Catatan Internal: ${data.catatanInternal}` : undefined
            })
            await fetchTickets()
        }
    }

    const updateTicketStatus = async (
        id: string,
        newStatus: TicketStatus,
        actionDetails?: string,
        newPriority?: Priority,
        resolvedBy?: 'helpdesk' | 'technician',
        rejectionReason?: string
    ) => {
        if (!user) return

        const actionMap: Record<TicketStatus, string> = {
            'NEW': 'Status diubah ke NEW', 'OPEN': 'Tiket divalidasi & dibuka',
            'UNASSIGNED': 'Tiket dieskalasi ke PM Lead', 'SCHEDULED': 'Tiket dijadwalkan',
            'EN_ROUTE': 'Teknisi dalam perjalanan', 'WORKING': 'Pekerjaan dimulai',
            'PENDING': 'Tiket di-pending', 'RESOLVED': 'Tugas diselesaikan (Resolved)',
            'CLOSED': 'Tiket ditutup (Closed)', 'REJECTED': 'Tiket ditolak',
            'VOID': 'Tiket dibatalkan (Void)', 'DUPLICATE': 'Tiket diduplikasi'
        }

        const updatePayload: TicketUpdatePayload = {
            status: newStatus,
            updated_at: new Date().toISOString()
        }
        if (newPriority) updatePayload.priority = newPriority
        if (resolvedBy) updatePayload.resolved_by = resolvedBy
        if (rejectionReason) updatePayload.rejection_reason = rejectionReason
        if (newStatus === 'CLOSED' || newStatus === 'VOID' || newStatus === 'DUPLICATE') {
            updatePayload.closed_at = new Date().toISOString()
        }

        const { error: ticketError } = await supabase.from('tickets').update(updatePayload).eq('id', id)

        const { error: activityError } = await supabase.from('activities').insert({
            ticket_id: id,
            user_id: user.id,
            user_name: user.full_name || user.email,
            action: actionMap[newStatus],
            details: actionDetails || rejectionReason
        })

        if (ticketError || activityError) {
            console.error('Error updating status:', ticketError, activityError)
        } else {
            await fetchTickets()
        }
    }

    const getTicketCount = (status: TicketStatus) => tickets.filter(t => t.status === status).length

    if (loading) {
        return <div className="flex h-screen items-center justify-center bg-muted">Memuat data tiket...</div>
    }

    return (
        <TicketContext.Provider value={{ tickets, loading, updateTicketStatus, addTicket, getTicketCount }}>
            {children}
        </TicketContext.Provider>
    )
}

// eslint-disable-next-line react-refresh/only-export-components
export const useTickets = () => {
    const context = useContext(TicketContext)
    if (!context) throw new Error('useTickets harus dipakai di dalam TicketProvider')
    return context
}
