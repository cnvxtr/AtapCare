import { useState } from 'react'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Eye, X, Clock, AlertTriangle, Truck, Calendar } from 'lucide-react'
import { Badge } from '../../components/Badge'

export default function Active() {
    const { tickets } = useTickets()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)

    // Filter tiket yang sedang dalam proses (Monitoring Mode)
    const activeStatuses = ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE', 'WORKING', 'PENDING']
    const activeTickets = tickets.filter(t => activeStatuses.includes(t.status))

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'UNASSIGNED': return <AlertTriangle className="w-4 h-4 text-blue-600" />
            case 'SCHEDULED': return <Calendar className="w-4 h-4 text-purple-600" />
            case 'EN_ROUTE': return <Truck className="w-4 h-4 text-indigo-600" />
            case 'WORKING': return <Clock className="w-4 h-4 text-amber-600" />
            case 'PENDING': return <Clock className="w-4 h-4 text-muted-foreground" />
            default: return null
        }
    }

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground">Monitoring Tiket Aktif</h2>
                    <p className="text-sm text-muted-foreground mt-1">Pantau progres tiket yang sedang ditangani PM & Teknisi</p>
                </div>
                <span className="bg-blue-50 text-blue-600 px-3 py-1.5 rounded-full text-sm font-medium border border-blue-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-blue-600 rounded-full animate-pulse"></span>
                    {activeTickets.length} Tiket Sedang Diproses
                </span>
            </div>

            <div className="bg-card rounded-xl border-2 border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <table className="w-full text-left">
                            <thead className="bg-muted text-muted-foreground text-xs uppercase border-b-2 border-border">
                                <tr>
                                    <th className="p-4 font-semibold">Kode Tiket</th>
                                    <th className="p-4 font-semibold">Pelapor</th>
                                    <th className="p-4 font-semibold">Site</th>
                                    <th className="p-4 font-semibold">Unit</th>
                                    <th className="p-4 font-semibold">Prioritas</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold">Assigned To</th>
                                    <th className="p-4 font-semibold text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {activeTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={8} className="p-8 text-center text-muted-foreground">
                                            Tidak ada tiket yang sedang dalam proses monitoring.
                                        </td>
                                    </tr>
                                ) : (
                                    activeTickets.map(ticket => (
                                        <tr key={ticket.id} className="hover:bg-muted transition-colors">
                                            <td className="p-4 font-mono text-sm text-foreground font-medium whitespace-nowrap">{ticket.code}</td>
                                            <td className="p-4 text-foreground text-sm">{ticket.customer}</td>
                                            <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">{ticket.site || '-'}</td>
                                            <td className="p-4 text-muted-foreground text-sm truncate max-w-[100px]" title={ticket.unit}>{ticket.unit || '-'}</td>
                                            <td className="p-4">
                                                <Badge type="priority" value={ticket.priority || '-'} />
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(ticket.status)}
                                                    <span className="text-sm font-medium text-foreground whitespace-nowrap">{ticket.status}</span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">{ticket.assignedTo || 'Belum ditugaskan'}</td>
                                            <td className="p-4 text-right">
                                                <button
                                                    onClick={() => setSelectedTicket(ticket)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-muted text-muted-foreground hover:bg-accent rounded-lg text-xs font-semibold transition-colors"
                                                >
                                                    <Eye className="w-3.5 h-3.5" /> Lihat
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
                <div className="px-4 py-2 bg-muted border-t-2 border-border text-xs text-muted-foreground text-center sm:hidden">
                    ← Geser ke samping untuk lihat semua kolom →
                </div>
            </div>

            {/* DRAWER MONITORING (READ ONLY) */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-card w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-card border-b-2 border-border p-5 flex justify-between items-center z-10">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">{selectedTicket.code}</h3>
                                <p className="text-sm text-muted-foreground">Status: <span className="font-bold">{selectedTicket.status}</span></p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 space-y-4 flex-1">
                            <div className="bg-blue-50 border-2 border-blue-200 p-4 rounded-lg flex items-start gap-3">
                                <Eye className="w-5 h-5 text-blue-600 mt-0.5" />
                                <div>
                                    <p className="text-sm font-bold text-blue-900">Monitoring Mode (Read Only)</p>
                                    <p className="text-xs text-blue-700 mt-1">Tiket ini sedang ditangani oleh PM Lead atau Teknisi Lapangan. Anda hanya dapat melihat progresnya.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted p-3 rounded border border-border"><p className="text-xs text-muted-foreground">Pelapor</p><p className="font-medium">{selectedTicket.customer}</p></div>
                                <div className="bg-muted p-3 rounded border border-border"><p className="text-xs text-muted-foreground">Site / Unit</p><p className="font-medium">{selectedTicket.site} - {selectedTicket.unit}</p></div>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground mb-1">Deskripsi Keluhan</p>
                                <p className="text-sm bg-muted p-3 rounded border border-border">{selectedTicket.description || '-'}</p>
                            </div>

                            <div>
                                <p className="text-xs text-muted-foreground mb-2">Riwayat Aktivitas</p>
                                <div className="space-y-3 border-l-2 border-border ml-3 pl-4">
                                    {selectedTicket.activities.map((act, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-foreground"></div>
                                            <p className="text-xs text-muted-foreground">{act.timestamp}</p>
                                            <p className="text-sm font-medium">{act.action}</p>
                                            {act.details && <p className="text-xs text-muted-foreground mt-1">{act.details}</p>}
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}