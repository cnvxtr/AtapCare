import { useNavigate } from 'react-router-dom'
import { useTickets } from '../../context/TicketContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { useEffect, useState } from 'react'
import { Badge } from '../../components/Badge'
import { ClipboardCheck, ChevronRight, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'

export default function CustomerDashboard() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { tickets } = useTickets()
    const [companyName, setCompanyName] = useState('')

    useEffect(() => {
        if (!user?.customer_id) { setCompanyName(''); return }
        supabase.from('customers').select('name').eq('id', user.customer_id).single().then(({ data }) => {
            setCompanyName((data as { name: string } | null)?.name || '')
        })
    }, [user?.customer_id])

    const myTickets = tickets.filter(t =>
        companyName && (t.company === companyName || t.customer === user?.full_name)
    )

    const openCount = myTickets.filter(t => !['RESOLVED', 'CLOSED', 'VOID', 'DUPLICATE', 'REJECTED'].includes(t.status)).length
    const closedCount = myTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
                <p className="text-2xl font-display font-bold tracking-tight">Selamat datang, {user?.full_name}</p>
                <button onClick={() => navigate('/customer/report')} className="px-4 py-2.5 bg-foreground text-background rounded-[3px] text-sm font-semibold hover:opacity-90 transition inline-flex items-center gap-2">
                    <Plus className="h-5 w-5" /> Lapor Kendala
                </button>
            </div>

            <div className="grid grid-cols-2 gap-3 max-w-sm">
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <span className="h-8 w-8 grid place-items-center rounded-lg bg-amber-50 text-amber-600">
                            <AlertTriangle className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Tiket Aktif</p>
                            <p className="text-2xl font-bold">{openCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2">
                        <span className="h-8 w-8 grid place-items-center rounded-lg bg-emerald-50 text-emerald-600">
                            <CheckCircle2 className="h-4 w-4" />
                        </span>
                        <div>
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Selesai</p>
                            <p className="text-2xl font-bold">{closedCount}</p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="bg-card border border-border rounded-lg overflow-hidden">
                <div className="px-5 py-4 border-b border-border">
                    <h2 className="font-display font-bold">Riwayat Tiket</h2>
                </div>
                {myTickets.length === 0 ? (
                    <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                        Belum ada tiket. Klik "+ Lapor Kendala" untuk membuat tiket baru.
                    </div>
                ) : (
                    <div className="divide-y divide-border">
                        {myTickets.map(ticket => (
                            <button key={ticket.id} onClick={() => navigate(`/customer/ticket/${ticket.code}`)}
                                className="w-full flex items-center gap-4 px-5 py-4 hover:bg-muted/50 transition text-left">
                                <div className="shrink-0">
                                    <ClipboardCheck className="h-5 w-5 text-muted-foreground" />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <span className="text-sm font-semibold font-mono">{ticket.code}</span>
                                        <Badge type="status" value={ticket.status} />
                                        {ticket.priority && <Badge type="priority" value={ticket.priority} />}
                                    </div>
                                    <p className="text-xs text-muted-foreground mt-1 truncate">{ticket.description}</p>
                                </div>
                                <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                            </button>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
