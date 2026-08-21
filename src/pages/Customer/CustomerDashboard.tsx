import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { useAuth } from '../../context/AuthContext'
import { Badge } from '../../components/Badge'
import { ClipboardCheck, ChevronRight, AlertTriangle, CheckCircle2, Plus } from 'lucide-react'

export default function CustomerDashboard() {
    const navigate = useNavigate()
    const { user } = useAuth()
    const { tickets } = useTickets()

    const myTickets = tickets.filter(t =>
        t.customer === user?.full_name || t.company === user?.full_name
    )

    const openCount = myTickets.filter(t => !['RESOLVED', 'CLOSED', 'VOID', 'DUPLICATE', 'REJECTED'].includes(t.status)).length
    const closedCount = myTickets.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <p className="text-2xl font-display font-bold tracking-tight">Selamat datang, {user?.full_name}</p>
                <button onClick={() => navigate('/customer/report')} className="px-4 py-2.5 bg-foreground text-background rounded-[3px] text-sm font-semibold hover:opacity-90 transition inline-flex items-center gap-2">
                    <Plus className="h-5 w-5" /> Lapor Masalah
                </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-card border border-border rounded-lg p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 text-amber-600 rounded-lg"><AlertTriangle className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground">Tiket Aktif</p>
                            <p className="text-2xl font-bold">{openCount}</p>
                        </div>
                    </div>
                </div>
                <div className="bg-card border border-border rounded-lg p-5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 text-emerald-600 rounded-lg"><CheckCircle2 className="h-5 w-5" /></div>
                        <div>
                            <p className="text-xs text-muted-foreground">Selesai</p>
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
                        Belum ada tiket. Klik "+ Lapor Masalah" untuk membuat tiket baru.
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
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-semibold font-mono">{ticket.code}</span>
                                        <Badge status={ticket.status} />
                                        {ticket.priority && <Badge priority={ticket.priority} />}
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
