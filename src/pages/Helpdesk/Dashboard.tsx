import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTickets } from '../../context/TicketContext'
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { AlertTriangle, Clock, Inbox, ArrowUpRight, Users, Eye, Filter } from 'lucide-react'
import { Badge } from '../../components/Badge'

export default function Dashboard() {
    const navigate = useNavigate()
    const { tickets, getTicketCount } = useTickets()
    const [activeTimeFilter, setActiveTimeFilter] = useState('today')

    // STATE UNTUK QUICK FILTER
    const [qfStatus, setQfStatus] = useState('all')
    const [qfPriority, setQfPriority] = useState('all')
    const [qfSLA, setQfSLA] = useState('all')

    // Logika Filter Waktu
    const filteredByTime = tickets.filter(ticket => {
        const ticketDate = new Date(ticket.createdAt)
        const now = new Date()
        const diffHours = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60)

        if (activeTimeFilter === 'today') return diffHours <= 24
        if (activeTimeFilter === '7days') return diffHours <= 168
        if (activeTimeFilter === 'month') return diffHours <= 720
        return true
    })

    // Data untuk Pie Chart
    const statusData = [
        { name: 'Baru', value: filteredByTime.filter(t => t.status === 'NEW').length, color: '#6b7280' },
        { name: 'Diproses', value: filteredByTime.filter(t => ['OPEN', 'WORKING', 'PENDING'].includes(t.status)).length, color: '#fbbf24' },
        { name: 'Menunggu PM', value: filteredByTime.filter(t => ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE'].includes(t.status)).length, color: '#3b82f6' },
        { name: 'Selesai', value: filteredByTime.filter(t => ['RESOLVED', 'CLOSED'].includes(t.status)).length, color: '#10b981' },
    ].filter(item => item.value > 0)

    // Data untuk Bar Chart
    const priorityData = [
        { name: 'P1', value: filteredByTime.filter(t => t.priority === 'P1' && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).length, fill: '#f87171' },
        { name: 'P2', value: filteredByTime.filter(t => t.priority === 'P2' && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).length, fill: '#fbbf24' },
        { name: 'P3', value: filteredByTime.filter(t => t.priority === 'P3' && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).length, fill: '#34d399' },
    ]

    // TABEL UTAMA DENGAN QUICK FILTER
    const displayTickets = filteredByTime
        .filter(t => {
            if (qfStatus !== 'all' && t.status !== qfStatus) return false
            if (qfPriority !== 'all' && t.priority !== qfPriority) return false
            // Logika SLA Sederhana (Warning < 8 jam, Overdue < 4 jam)
            if (qfSLA === 'warning' && t.slaTimeLeft >= 8) return false
            if (qfSLA === 'overdue' && t.slaTimeLeft >= 4) return false
            return true
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10) // Tampilkan 10 teratas

    return (
        <div className="space-y-4 md:space-y-6 p-4 sm:p-6">
            {/* 1. Header & Time Filter */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b-2 border-border">
                <div>
                    <h1 className="text-xl sm:text-2xl font-display font-bold text-foreground">Dashboard Helpdesk</h1>
                    <p className="text-xs sm:text-sm text-muted-foreground mt-1">Pusat pantau harian operasional tiket.</p>
                </div>
                <div className="flex bg-card border-2 border-border rounded-lg p-1 w-full sm:w-fit shadow-sm overflow-x-auto">
                    {[
                        { id: 'today', label: 'Hari Ini' },
                        { id: '7days', label: '7 Hari' },
                        { id: 'month', label: 'Bulan Ini' }
                    ].map((period) => (
                        <button
                            key={period.id}
                            onClick={() => setActiveTimeFilter(period.id)}
                            className={`flex-1 sm:flex-none px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-all whitespace-nowrap ${activeTimeFilter === period.id
                                    ? 'bg-foreground text-primary-foreground shadow-sm'
                                    : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                }`}
                        >
                            {period.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 2. KPI Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="bg-card border-2 border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Tiket Baru</p>
                            <h3 className="text-2xl font-mono font-bold text-foreground mt-1">{getTicketCount('NEW')}</h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Inbox className="w-5 h-5 text-muted-foreground" /></div>
                    </div>
                </div>
                <div className="bg-card border-2 border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Diproses</p>
                            <h3 className="text-2xl font-mono font-bold text-foreground mt-1">{getTicketCount('OPEN') + getTicketCount('WORKING') + getTicketCount('PENDING')}</h3>
                        </div>
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg"><Clock className="w-5 h-5 text-amber-600" /></div>
                    </div>
                </div>
                <div className="bg-card border-2 border-border rounded-xl p-4 shadow-sm hover:shadow-md transition-all hover:border-border">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-xs font-medium text-muted-foreground">Menunggu PM</p>
                            <h3 className="text-2xl font-mono font-bold text-foreground mt-1">{getTicketCount('UNASSIGNED') + getTicketCount('SCHEDULED') + getTicketCount('EN_ROUTE')}</h3>
                        </div>
                        <div className="p-2 bg-blue-50 border border-blue-200 rounded-lg"><Users className="w-5 h-5 text-blue-600" /></div>
                    </div>
                </div>
                <div className="bg-red-50 border-2 border-red-200 rounded-xl p-4 shadow-sm hover:shadow-md transition-all relative overflow-hidden group hover:border-red-300">
                    <div className="absolute right-2 top-2 opacity-20 group-hover:opacity-30 transition-opacity">
                        <AlertTriangle className="w-12 h-12 text-red-600" />
                    </div>
                    <div className="relative z-10">
                        <p className="text-[10px] font-black text-red-600 uppercase tracking-wider flex items-center gap-1">
                            <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span> SLA Overdue
                        </p>
                        <h3 className="text-3xl font-mono font-black text-red-600 mt-1">
                            {tickets.filter(t => t.slaTimeLeft <= 4 && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).length}
                        </h3>
                    </div>
                </div>
            </div>

            {/* 3. QUICK FILTER BAR (FITUR BARU) */}
            <div className="bg-card p-3 rounded-xl border-2 border-border shadow-sm flex flex-col lg:flex-row lg:items-center gap-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground whitespace-nowrap">
                    <Filter className="w-4 h-4" /> Quick Filter:
                </div>

                {/* Filter Status */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
                    <span className="text-xs text-muted-foreground mr-1 hidden sm:block">Status:</span>
                    {['all', 'NEW', 'OPEN', 'UNASSIGNED'].map(s => (
                        <button key={s} onClick={() => setQfStatus(s)} className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${qfStatus === s ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {s === 'all' ? 'Semua' : s}
                        </button>
                    ))}
                </div>

                {/* Filter Prioritas */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
                    <span className="text-xs text-muted-foreground mr-1 hidden sm:block">Prioritas:</span>
                    {['all', 'P1', 'P2', 'P3'].map(p => (
                        <button key={p} onClick={() => setQfPriority(p)} className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${qfPriority === p ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {p === 'all' ? 'Semua' : p}
                        </button>
                    ))}
                </div>

                {/* Filter SLA */}
                <div className="flex items-center gap-1 overflow-x-auto pb-1 lg:pb-0">
                    <span className="text-xs text-muted-foreground mr-1 hidden sm:block">SLA:</span>
                    {['all', 'warning', 'overdue'].map(s => (
                        <button key={s} onClick={() => setQfSLA(s)} className={`px-3 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${qfSLA === s ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                            {s === 'all' ? 'Semua' : s === 'warning' ? 'Warning' : 'Overdue'}
                        </button>
                    ))}
                </div>
            </div>

            {/* 4. Grafik (2 Kolom) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-card border-2 border-border rounded-xl p-4 sm:p-6 shadow-sm hover:border-border transition-all w-full">
                    <h3 className="text-base font-display font-semibold text-foreground mb-3 border-b border-border pb-2">Distribusi Status Tiket</h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <PieChart>
                                <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={70} paddingAngle={5} dataKey="value">
                                    {statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} stroke="none" />))}
                                </Pie>
                                <Tooltip contentStyle={{ backgroundColor: 'white', borderColor: '#d1d5db', borderRadius: '8px', fontSize: '12px' }} />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                            </PieChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                <div className="bg-card border-2 border-border rounded-xl p-4 sm:p-6 shadow-sm hover:border-border transition-all w-full">
                    <h3 className="text-base font-display font-semibold text-foreground mb-3 border-b border-border pb-2">Beban Prioritas Aktif</h3>
                    <div className="h-64 w-full relative">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData} margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                                <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} dy={10} />
                                <YAxis axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: 'white', borderColor: '#d1d5db', borderRadius: '8px', fontSize: '12px' }} />
                                <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* 5. Tabel Operasional (Tier 2) */}
            <div className="bg-card border-2 border-border rounded-xl shadow-sm overflow-hidden hover:border-border transition-all">
                <div className="p-4 border-b-2 border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 bg-muted">
                    <h3 className="text-base font-display font-semibold text-foreground">Tiket Operasional (Top 10)</h3>
                    <button onClick={() => navigate('/inbox')} className="text-xs text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1 font-medium self-start sm:self-auto">
                        Lihat Semua di Inbox <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left min-w-[900px]">
                        <thead className="bg-muted text-muted-foreground text-xs uppercase border-b-2 border-border">
                            <tr>
                                <th className="px-4 py-3 font-semibold">Kode</th>
                                <th className="px-4 py-3 font-semibold">Pelanggan</th>
                                <th className="px-4 py-3 font-semibold">Site</th>
                                <th className="px-4 py-3 font-semibold">Unit</th>
                                <th className="px-4 py-3 font-semibold">Prioritas</th>
                                <th className="px-4 py-3 font-semibold">Status</th>
                                <th className="px-4 py-3 font-semibold">SLA (Jam)</th>
                                <th className="px-4 py-3 font-semibold text-right">Aksi</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {displayTickets.length === 0 ? (
                                <tr><td colSpan={8} className="p-8 text-center text-muted-foreground text-sm">Tidak ada tiket yang cocok dengan filter.</td></tr>
                            ) : (
                                displayTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-muted transition-colors">
                                        <td className="px-4 py-3 font-mono text-xs text-foreground font-medium whitespace-nowrap">{ticket.code}</td>
                                        <td className="px-4 py-3 text-xs text-foreground truncate max-w-[120px]" title={ticket.customer}>{ticket.customer}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ticket.site || '-'}</td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground truncate max-w-[100px]" title={ticket.unit}>{ticket.unit || '-'}</td>
                                        <td className="px-4 py-3">
                                            <Badge type="priority" value={ticket.priority || '-'} />
                                        </td>
                                        <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{ticket.status}</td>
                                        <td className="px-4 py-3">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${ticket.slaTimeLeft <= 4 ? 'bg-red-100 text-red-700' :
                                                    ticket.slaTimeLeft <= 8 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {ticket.slaTimeLeft}h
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button onClick={() => navigate('/inbox')} className="inline-flex items-center gap-1 px-2 py-1 bg-muted text-muted-foreground hover:bg-accent rounded text-xs font-medium">
                                                <Eye className="w-3 h-3" /> Detail
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}