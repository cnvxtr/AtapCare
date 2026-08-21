import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Inbox, ArrowUpRight, Wrench, Pause, Ban, X } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { FINAL_STATUSES } from '../../lib/status'
import TicketDrawer, { TicketTimeline, TicketDescription, AssignmentCard } from '../../components/TicketDrawer'
import FieldError from '../../components/FieldError'
import { getPendingAlarm } from '../../lib/pendingAlarm'
import TrendChart from '../../components/TrendChart'
import AnimatedNumber from '../../components/AnimatedNumber'

export default function PMDashboard() {
    const navigate = useNavigate()
    const { tickets, getTicketCount, updateTicketStatus } = useTickets()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline'>('detail')
    const [showVetoModal, setShowVetoModal] = useState(false)
    const [vetoReason, setVetoReason] = useState('')
    const [vetoError, setVetoError] = useState('')

    // Rolling bulan kalender: otomatis geser ke bulan baru tiap tanggal 1, tanpa reset manual
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const periodLabel = monthStart.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

    // Distribusi status SAAT INI (real-time, semua tiket — bukan per periode)
    const statusData = [
        { name: 'Baru', value: tickets.filter(t => t.status === 'NEW').length, color: '#d4d4d4' },
        { name: 'Diproses', value: tickets.filter(t => t.status === 'OPEN').length, color: '#a3a3a3' },
        { name: 'Ditugaskan', value: tickets.filter(t => ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE'].includes(t.status)).length, color: '#737373' },
        { name: 'Dikerjakan', value: tickets.filter(t => t.status === 'WORKING').length, color: '#525252' },
        { name: 'Dijeda', value: tickets.filter(t => t.status === 'PENDING').length, color: '#404040' },
        { name: 'Selesai', value: tickets.filter(t => t.status === 'RESOLVED').length, color: '#262626' },
        { name: 'Tutup', value: tickets.filter(t => t.status === 'CLOSED').length, color: '#171717' },
    ]

    // Trend mingguan bulan berjalan: masuk (createdAt) vs selesai (closedAt) — historis, tidak hilang
    const trendData = (() => {
        const y = new Date().getFullYear(), m = new Date().getMonth()
        const days = new Date(y, m + 1, 0).getDate()
        const inWeek = (ts: string, start: number, end: number) => {
            const d = new Date(ts)
            return d.getFullYear() === y && d.getMonth() === m && d.getDate() >= start && d.getDate() <= end
        }
        return Array.from({ length: Math.ceil(days / 7) }, (_, i) => {
            const start = i * 7 + 1
            const end = Math.min((i + 1) * 7, days)
            return {
                name: `Minggu ${i + 1}`,
                masuk: tickets.filter(t => inWeek(t.createdAt, start, end)).length,
                selesai: tickets.filter(t => t.closedAt && inWeek(t.closedAt, start, end)).length,
            }
        })
    })()

    // TABEL OPERASIONAL: tiket aktif (final: Tutup/Void/Digabung) semua periode, 10 terbaru — real-time
    const displayTickets = tickets
        .filter(t => !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10) // Tampilkan 10 teratas

    const fieldCount = tickets.filter(t => t.status === 'WORKING').length
    const pendingAlarmCount = tickets.filter(t => t.status === 'PENDING' && getPendingAlarm(t.updatedAt)).length

    const avgFrt = tickets.filter(t => t.frtMinutes != null).reduce((s, t) => s + (t.frtMinutes ?? 0), 0) / (tickets.filter(t => t.frtMinutes != null).length || 1)

    const doVeto = () => {
        if (!vetoReason.trim()) { setVetoError('Mohon isi alasan veto'); return }
        setVetoError('')
        if (selectedTicket) updateTicketStatus(selectedTicket.id, 'WORKING', `Veto Pending: ${vetoReason.trim()}`)
        setShowVetoModal(false); setVetoReason(''); setSelectedTicket(null)
    }

    return (
        <>
        <div className="space-y-6">
            {/* 1. KPI Cards (state real-time, tidak difilter periode) */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Belum Ditugaskan</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={getTicketCount('UNASSIGNED')} /></h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Inbox className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dikerjakan</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={fieldCount} /></h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Wrench className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className={`group relative rounded-2xl border p-5 overflow-hidden transition ${pendingAlarmCount > 0 ? 'border-amber-300 bg-amber-50/60' : 'border-border bg-card hover:border-foreground/30'}`}>
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dijeda</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={getTicketCount('PENDING')} /></h3>
                            {pendingAlarmCount > 0 && (
                                <p className="text-[10px] font-mono text-amber-800 mt-1 flex items-center gap-1">
                                    <AlertTriangle className="w-3 h-3" /> {pendingAlarmCount} tanpa aktivitas
                                </p>
                            )}
                        </div>
                        <div className={`p-2 border rounded-lg ${pendingAlarmCount > 0 ? 'bg-amber-100 border-amber-300 text-amber-800' : 'bg-muted border-border text-foreground'}`}><Pause className="w-5 h-5" /></div>
                    </div>
                </div>
                <div className="bg-blue-600 border border-blue-700 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden group hover:border-blue-400">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-wider">
                                Rata-rata FRT
                            </p>
                            <h3 className="text-4xl font-display font-black text-white mt-2 tracking-tight">
                                {Math.round(avgFrt)}m
                            </h3>
                        </div>
                        <div className="p-2 bg-white/20 border border-white/30 rounded-lg"><AlertTriangle className="w-5 h-5 text-white" /></div>
                    </div>
                </div>
            </div>

            {/* 3. Grafik (2 Kolom) */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 transition-all w-full">
                    <div className="flex items-start justify-between mb-6">
                        <div>
                            <h3 className="font-display font-bold text-foreground">Volume Tiket — Mingguan</h3>
                            <p className="text-xs text-muted-foreground mt-0.5">Periode: {periodLabel} · Masuk vs Selesai</p>
                        </div>
                        <div className="flex items-center gap-3 text-xs">
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-foreground" /> Masuk</span>
                            <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-muted-foreground" /> Selesai</span>
                        </div>
                    </div>
                    <TrendChart data={trendData} />
                </div>

                <div className="bg-card border border-border rounded-2xl p-4 sm:p-6 transition-all w-full">
                    <div>
                        <h3 className="font-display font-bold text-foreground">Distribusi Status Tiket</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Status terkini · real-time</p>
                    </div>
                    <div className="h-64 w-full relative mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={statusData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} width={85} />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: 'black', borderColor: '#333', borderRadius: '8px', fontSize: '12px', color: 'white' }} labelStyle={{ color: 'white' }} itemStyle={{ color: 'white' }} />
                                <Bar dataKey="value" radius={[0, 4, 4, 0]} barSize={20} animationDuration={700} animationEasing="ease-out">
                                    {statusData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabel Operasional (Tier 2) */}
            <div className="rounded-2xl border border-border bg-card">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="font-display font-bold text-foreground">10 Tiket Aktif Terbaru</h3>
                    <button onClick={() => navigate('/command-center')} className="text-xs font-medium hover:underline inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition">
                        Buka Command Center <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                    <table className="w-full table-fixed text-left">
                        <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-medium text-left w-[170px]">Kode</th><th className="px-4 py-3 font-medium text-left">Pelapor</th><th className="px-4 py-3 font-medium text-left w-[14%]">Site</th>
                                <th className="px-4 py-3 font-medium text-left w-[18%]">Unit</th><th className="px-4 py-3 font-medium text-left w-[85px]">Prioritas</th><th className="px-4 py-3 font-medium text-left w-[120px]">Status</th><th className="px-4 py-3 font-medium text-left w-[120px]">FRT</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {displayTickets.length === 0 ? (
                                <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
                            ) : (
                                displayTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-muted cursor-pointer" onClick={() => { setSelectedTicket(ticket); setActiveDrawerTab('detail') }}>
                                        <td className="p-4 font-mono text-xs font-medium whitespace-nowrap">{ticket.code}</td>
                                        <td className="p-4 text-xs">{ticket.customer}</td>
                                        <td className="p-4 text-xs truncate" title={ticket.site}>{ticket.site || '-'}</td>
                                        <td className="p-4 text-xs truncate" title={ticket.unit}>{ticket.unit || '-'}</td>
                                        <td className="p-4">
                                            <Badge type="priority" value={ticket.priority || '-'} />
                                        </td>
                                        <td className="p-4">
                                            <Badge type="status" value={ticket.status} />
                                            {ticket.status === 'PENDING' && getPendingAlarm(ticket.updatedAt) && (
                                                <span className="ml-1.5 inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold whitespace-nowrap">
                                                    <AlertTriangle className="h-2.5 w-2.5" /> {getPendingAlarm(ticket.updatedAt)}
                                                </span>
                                            )}
                                        </td>
                                        <td className="p-4">
                                            {ticket.frtMinutes != null && <span className="text-[10px] font-mono text-blue-600 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">{ticket.frtMinutes}m</span>}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                    </div>
                </div>
            </div>
        </div>

            {/* DRAWER DETAIL DASHBOARD */}
            {selectedTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={selectedTicket.code}
                    ticketId={selectedTicket.id}
                    status={selectedTicket.status}
                    priority={selectedTicket.priority}
                    frtMinutes={selectedTicket.frtMinutes}
                    createdAt={selectedTicket.createdAt}
                    activeTab={activeDrawerTab}
                    onTabChange={setActiveDrawerTab}
                    activities={selectedTicket.activities}
                    footer={
                        <>
                            {selectedTicket.status === 'UNASSIGNED' && (
                                <button onClick={() => { setSelectedTicket(null); navigate('/command-center') }} className="w-full py-2.5 bg-foreground text-primary-foreground rounded-md font-bold">Tugaskan di Command Center</button>
                            )}
                            {(selectedTicket.status === 'SCHEDULED' || selectedTicket.status === 'EN_ROUTE') && (
                                <button onClick={() => { setSelectedTicket(null); navigate('/command-center') }} className="w-full py-2.5 bg-neutral-700 text-white rounded-md font-bold">Ganti Teknisi di Command Center</button>
                            )}
                            {selectedTicket.status === 'PENDING' && (
                                <button onClick={() => setShowVetoModal(true)} className="w-full py-2.5 bg-red-600 text-white rounded-md font-bold flex items-center justify-center gap-2"><Ban className="w-4 h-4" /> Veto Pending</button>
                            )}
                            {!['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE', 'PENDING'].includes(selectedTicket.status) && (
                                <p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>
                            )}
                        </>
                    }
                >
                    {activeDrawerTab === 'detail' && (
                        <div className="space-y-4">
                            {selectedTicket.status === 'PENDING' && getPendingAlarm(selectedTicket.updatedAt) && (
                                <div className="bg-amber-50/60 p-3 rounded-[3px] border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" /> Dijeda {getPendingAlarm(selectedTicket.updatedAt)} tanpa aktivitas
                                </div>
                            )}
                            <AssignmentCard items={selectedTicket.activities} />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Pelapor</p>
                                    <p className="font-medium text-sm">{selectedTicket.customer}</p>
                                </div>
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Site / Unit</p>
                                    <p className="font-medium text-sm">{selectedTicket.site} - {selectedTicket.unit}</p>
                                </div>
                            </div>
                            <TicketDescription description={selectedTicket.description} />
                        </div>
                    )}
                    {activeDrawerTab === 'timeline' && <TicketTimeline items={selectedTicket.activities} isFinal={['CLOSED', 'RESOLVED', 'VOID', 'DUPLICATE', 'REJECTED'].includes(selectedTicket.status)} />}
                </TicketDrawer>
            )}

            {/* MODAL VETO PENDING */}
            {showVetoModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-red-700"><Ban className="w-5 h-5" /> Veto Status Pending</h3>
                            <button onClick={() => { setShowVetoModal(false); setVetoReason(''); setVetoError('') }} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Membatalkan status Pending dan mengembalikan tiket ke WORKING.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">Alasan Veto (Wajib)</label>
                                <textarea value={vetoReason} onChange={e => { setVetoReason(e.target.value); setVetoError('') }} rows={3} className={`w-full mt-1 px-3 py-2 border ${vetoError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm outline-none resize-none`} placeholder="Contoh: Alasan pending tidak valid, segera lanjutkan pekerjaan"></textarea>
                                <FieldError msg={vetoError} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => { setShowVetoModal(false); setVetoReason(''); setVetoError('') }} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={doVeto} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Veto & Lanjutkan</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}
    </>
    )
}
