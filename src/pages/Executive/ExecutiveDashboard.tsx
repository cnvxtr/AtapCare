import { useState } from 'react'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Cell, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Inbox, Wrench, ClipboardCheck } from 'lucide-react'
import { Badge } from '../../components/Badge'
import TicketDrawer, { TicketTimeline, TicketDescription, AssignmentCard } from '../../components/TicketDrawer'
import { getPendingAlarm } from '../../lib/pendingAlarm'
import TrendChart from '../../components/TrendChart'
import AnimatedNumber from '../../components/AnimatedNumber'

export default function ExecutiveDashboard() {
    const { tickets, getTicketCount } = useTickets()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline'>('detail')

    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const periodLabel = monthStart.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

    const statusData = [
        { name: 'Baru', value: tickets.filter(t => t.status === 'NEW').length, color: '#d4d4d4' },
        { name: 'Diproses', value: tickets.filter(t => t.status === 'OPEN').length, color: '#a3a3a3' },
        { name: 'Ditugaskan', value: tickets.filter(t => ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE'].includes(t.status)).length, color: '#737373' },
        { name: 'Dikerjakan', value: tickets.filter(t => t.status === 'WORKING').length, color: '#525252' },
        { name: 'Dijeda', value: tickets.filter(t => t.status === 'PENDING').length, color: '#404040' },
        { name: 'Selesai', value: tickets.filter(t => t.status === 'RESOLVED').length, color: '#262626' },
        { name: 'Tutup', value: tickets.filter(t => t.status === 'CLOSED').length, color: '#171717' },
    ]

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

    const displayTickets = tickets
        .filter(t => !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .slice(0, 10)

    const avgFrt = tickets.filter(t => t.frtMinutes != null).reduce((s, t) => s + (t.frtMinutes ?? 0), 0) / (tickets.filter(t => t.frtMinutes != null).length || 1)

    return (
        <>
        <div className="space-y-6">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Baru (Perlu Validasi)</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={getTicketCount('NEW')} /></h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Inbox className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Sedang Diproses</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={getTicketCount('OPEN')} /></h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Wrench className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Menunggu Validasi</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight"><AnimatedNumber value={getTicketCount('RESOLVED')} /></h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><ClipboardCheck className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="bg-blue-600 border border-blue-700 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden group hover:border-blue-400">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-wider">Rata-rata FRT</p>
                            <h3 className="text-4xl font-display font-black text-white mt-2 tracking-tight">{Math.round(avgFrt)}m</h3>
                        </div>
                        <div className="p-2 bg-white/20 border border-white/30 rounded-lg"><AlertTriangle className="w-5 h-5 text-white" /></div>
                    </div>
                </div>
            </div>

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

            <div className="rounded-2xl border border-border bg-card">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="font-display font-bold text-foreground">10 Tiket Aktif Terbaru</h3>
                </div>
                <div className="overflow-x-auto">
                    <div className="min-w-[720px]">
                    <table className="w-full table-fixed text-left">
                        <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-medium text-left w-[170px]">Kode</th><th className="px-4 py-3 font-medium text-left">Pelapor</th><th className="px-4 py-3 font-medium text-left w-[14%]">Site</th>
                                <th className="px-4 py-3 font-medium text-left w-[18%]">Unit</th><th className="px-4 py-3 font-medium text-left w-[85px]">Prioritas</th><th className="px-4 py-3 font-medium text-left w-[120px]">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {displayTickets.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
                            ) : (
                                displayTickets.map(ticket => (
                                    <tr key={ticket.id} className="hover:bg-muted cursor-pointer" onClick={() => { setSelectedTicket(ticket); setActiveDrawerTab('detail') }}>
                                        <td className="p-4 font-mono text-xs font-medium whitespace-nowrap">{ticket.code}</td>
                                        <td className="p-4 text-xs">{ticket.customer}</td>
                                        <td className="p-4 text-xs truncate" title={ticket.site}>{ticket.site || '-'}</td>
                                        <td className="p-4 text-xs truncate" title={ticket.unit}>{ticket.unit || '-'}</td>
                                        <td className="p-4"><Badge type="priority" value={ticket.priority || '-'} /></td>
                                        <td className="p-4">
                                            <Badge type="status" value={ticket.status} />
                                            {ticket.status === 'PENDING' && getPendingAlarm(ticket.updatedAt) && (
                                                <span className="ml-1.5 inline-flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-[3px] text-[9px] font-bold whitespace-nowrap">
                                                    <AlertTriangle className="h-2.5 w-2.5" /> {getPendingAlarm(ticket.updatedAt)}
                                                </span>
                                            )}
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

        {selectedTicket && (
            <TicketDrawer
                onClose={() => setSelectedTicket(null)}
                code={selectedTicket.code}
                ticketId={selectedTicket.id}
                status={selectedTicket.status}
                priority={selectedTicket.priority}
                createdAt={selectedTicket.createdAt}
                activeTab={activeDrawerTab}
                onTabChange={setActiveDrawerTab}
                activities={selectedTicket.activities}
                duplicateCode={selectedTicket.duplicateOf ? (tickets.find(t => t.id === selectedTicket.duplicateOf)?.code ?? undefined) : undefined}
                footer={<p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>}
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
        </>
    )
}
