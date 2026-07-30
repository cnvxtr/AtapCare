import { useState } from 'react'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Archive as ArchiveIcon, RotateCcw, Download, Search, Filter } from 'lucide-react'
import { Badge } from '../../components/Badge'

export default function Archive() {
    const { tickets, updateTicketStatus } = useTickets()
    // Filter hanya tiket yang sudah final: CLOSED, VOID, DUPLICATE
    const archivedTickets = tickets.filter(t => ['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status))

    const [searchTerm, setSearchTerm] = useState('')
    const [statusFilter, setStatusFilter] = useState('all')

    // Logika Reopen: Hanya CLOSED yang bisa di-reopen dalam 7 hari
    const canReopen = (ticket: Ticket) => {
        if (ticket.status !== 'CLOSED' || !ticket.closedAt) return false
        const closedDate = new Date(ticket.closedAt)
        const now = new Date()
        const diffTime = Math.abs(now.getTime() - closedDate.getTime())
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
        return diffDays <= 7
    }

    const handleReopen = (ticket: Ticket) => {
        if (confirm(`Yakin ingin membuka kembali tiket ${ticket.code}? Tiket akan kembali ke status WORKING untuk ditindaklanjuti.`)) {
            updateTicketStatus(ticket.id, 'WORKING', 'Tiket di-reopen oleh Helpdesk')
        }
    }

    const handleExportCSV = () => {
        const headers = ['Kode Tiket', 'Pelanggan', 'Perusahaan', 'Site', 'Unit', 'Prioritas', 'Status', 'Tanggal Tutup']
        const rows = archivedTickets.map(t => [
            t.code, t.customer, t.company, t.site || '-', t.unit || '-', t.priority || '-', t.status, t.closedAt ? new Date(t.closedAt).toLocaleDateString('id-ID') : '-'
        ])
        const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(row => row.join(','))].join('\n')
        const encodedUri = encodeURI(csvContent)
        const link = document.createElement("a")
        link.setAttribute("href", encodedUri)
        link.setAttribute("download", `Arsip_Tiket_${new Date().toISOString().split('T')[0]}.csv`)
        document.body.appendChild(link)
        link.click()
        document.body.removeChild(link)
    }

    const filteredTickets = archivedTickets.filter(t => {
        const matchSearch = t.code.toLowerCase().includes(searchTerm.toLowerCase()) || t.customer.toLowerCase().includes(searchTerm.toLowerCase())
        const matchStatus = statusFilter === 'all' || t.status === statusFilter
        return matchSearch && matchStatus
    })

    return (
        <div className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground flex items-center gap-2">
                        <ArchiveIcon className="w-6 h-6 text-muted-foreground" />
                        Arsip & Closing
                    </h2>
                    <p className="text-sm text-muted-foreground mt-1">Riwayat tiket CLOSED, VOID, dan DUPLICATE</p>
                </div>
                <button
                    onClick={handleExportCSV}
                    className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-100 rounded-lg text-sm font-medium transition-colors w-full sm:w-auto"
                >
                    <Download className="w-4 h-4" />
                    Ekspor CSV
                </button>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-card p-4 rounded-xl border-2 border-border shadow-sm mb-6 flex flex-col sm:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                    <input
                        type="text"
                        placeholder="Cari kode tiket atau pelanggan..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 bg-card border-2 border-border rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                    />
                </div>
                <div className="flex items-center gap-2 sm:w-48">
                    <Filter className="w-4 h-4 text-muted-foreground" />
                    <select
                        value={statusFilter}
                        onChange={(e) => setStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 bg-card border-2 border-border rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none"
                    >
                        <option value="all">Semua Status</option>
                        <option value="CLOSED">CLOSED</option>
                        <option value="VOID">VOID</option>
                        <option value="DUPLICATE">DUPLICATE</option>
                    </select>
                </div>
            </div>

            {/* Tabel Arsip */}
            <div className="bg-card rounded-xl border-2 border-border shadow-sm overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <table className="w-full text-left">
                            <thead className="bg-muted text-muted-foreground text-xs uppercase border-b-2 border-border">
                                <tr>
                                    <th className="p-4 font-semibold">Kode Tiket</th>
                                    <th className="p-4 font-semibold">Pelanggan</th>
                                    <th className="p-4 font-semibold">Site</th>
                                    <th className="p-4 font-semibold">Unit</th>
                                    <th className="p-4 font-semibold">Status</th>
                                    <th className="p-4 font-semibold">Tanggal Tutup</th>
                                    <th className="p-4 font-semibold text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredTickets.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="p-8 text-center text-muted-foreground">
                                            Tidak ada tiket yang diarsipkan.
                                        </td>
                                    </tr>
                                ) : (
                                    filteredTickets.map(ticket => (
                                        <tr key={ticket.id} className="hover:bg-muted transition-colors">
                                            <td className="p-4 font-mono text-sm text-foreground font-medium whitespace-nowrap">{ticket.code}</td>
                                            <td className="p-4 text-foreground text-sm">{ticket.customer}</td>
                                            <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">{ticket.site || '-'}</td>
                                            <td className="p-4 text-muted-foreground text-sm truncate max-w-[100px]" title={ticket.unit}>{ticket.unit || '-'}</td>
                                            <td className="p-4">
                                                <Badge type="status" value={ticket.status} />
                                            </td>
                                            <td className="p-4 text-muted-foreground text-sm whitespace-nowrap">
                                                {ticket.closedAt ? new Date(ticket.closedAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : '-'}
                                            </td>
                                            <td className="p-4 text-right">
                                                {ticket.status === 'CLOSED' && canReopen(ticket) ? (
                                                    <button
                                                        onClick={() => handleReopen(ticket)}
                                                        className="inline-flex items-center gap-1 px-3 py-1.5 bg-blue-50 text-blue-600 hover:bg-blue-100 border-2 border-blue-200 rounded-lg text-xs font-semibold transition-colors"
                                                    >
                                                        <RotateCcw className="w-3.5 h-3.5" />
                                                        Reopen
                                                    </button>
                                                ) : ticket.status === 'CLOSED' ? (
                                                    <span className="text-xs text-muted-foreground italic">{'>'} 7 hari (Read Only)</span>
                                                ) : (
                                                    <span className="text-xs text-muted-foreground italic">Permanen</span>
                                                )}
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
        </div>
    )
}