import { useState, type MouseEvent as ReactMouseEvent } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router-dom'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import { AlertTriangle, Inbox, ArrowUpRight, Wrench, Pause, Ban, X } from 'lucide-react'
import { Badge } from '../../components/Badge'
import { FINAL_STATUSES } from '../../lib/status'
import TicketDrawer, { TicketTimeline, TicketDescription, TicketActivityLog, AssignmentCard } from '../../components/TicketDrawer'
import FieldError from '../../components/FieldError'

export default function PMDashboard() {
    const navigate = useNavigate()
    const { tickets, getTicketCount, updateTicketStatus } = useTickets()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline' | 'activity'>('detail')
    const [showVetoModal, setShowVetoModal] = useState(false)
    const [vetoReason, setVetoReason] = useState('')
    const [vetoError, setVetoError] = useState('')

    // Rolling bulan kalender: otomatis geser ke bulan baru tiap tanggal 1, tanpa reset manual
    const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0, 0, 0, 0)
    const periodLabel = monthStart.toLocaleString('id-ID', { month: 'long', year: 'numeric' })

    // Beban tiket AKTIF per prioritas (real-time) — batang hitam, ujung warna badge asli ukuran tetap
    const priorityData = ['P1', 'P2', 'P3'].map(p => ({
        name: p,
        value: tickets.filter(t => !FINAL_STATUSES.includes(t.status as (typeof FINAL_STATUSES)[number]) && t.priority === p).length,
    }))

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

    // ponytail: sla_time_left di DB masih NULL (backend SLA belum dibangun) → fallback 24 jam,
    // kartu SLA Kritis tampil 0 sampai kalkulasi SLA dibuat (paket kerja Admin).
    const slaCritical = tickets.filter(t => !FINAL_STATUSES.includes(t.status as (typeof FINAL_STATUSES)[number]) && t.slaTimeLeft <= 4)
    const slaOverdue = slaCritical.filter(t => t.slaTimeLeft <= 0).length
    const slaWarning = slaCritical.length - slaOverdue

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
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight">{getTicketCount('UNASSIGNED')}</h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Inbox className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dikerjakan</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight">{fieldCount}</h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Wrench className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="group relative rounded-2xl border border-border bg-card p-5 overflow-hidden hover:border-foreground/30 transition">
                    <div className="absolute -top-10 -right-10 h-24 w-24 rounded-full bg-foreground/[0.03] blur-2xl group-hover:bg-foreground/[0.08] transition" />
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-mono">Dijeda</p>
                            <h3 className="text-4xl font-display font-bold mt-2 tracking-tight">{getTicketCount('PENDING')}</h3>
                        </div>
                        <div className="p-2 bg-muted border border-border rounded-lg"><Pause className="w-5 h-5 text-foreground" /></div>
                    </div>
                </div>
                <div className="bg-red-600 border border-red-700 rounded-2xl p-5 shadow-sm transition-all relative overflow-hidden group hover:border-red-400">
                    <div className="flex justify-between items-start">
                        <div>
                            <p className="text-[10px] font-black text-white uppercase tracking-wider flex items-center gap-1">
                                <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span> SLA Kritis
                            </p>
                            <h3 className="text-4xl font-display font-black text-white mt-2 tracking-tight">
                                {slaCritical.length}
                            </h3>
                            <p className="text-[10px] font-mono text-white/80 mt-1">{slaOverdue} Overdue · {slaWarning} Warning</p>
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
                        <h3 className="font-display font-bold text-foreground">Tiket per Prioritas</h3>
                        <p className="text-xs text-muted-foreground mt-0.5">Tiket aktif · real-time</p>
                    </div>
                    <div className="h-64 w-full relative mt-4">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart data={priorityData} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                                <XAxis type="number" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} allowDecimals={false} />
                                <YAxis type="category" dataKey="name" axisLine={false} tickLine={false} tick={{ fill: '#6b7280', fontSize: 11 }} width={40} />
                                <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ backgroundColor: 'white', borderColor: '#d1d5db', borderRadius: '8px', fontSize: '12px' }} />
                                <Bar dataKey="value" shape={TipBar} barSize={30} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Tabel Operasional (Tier 2) */}
            <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="p-4 border-b border-border flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
                    <h3 className="font-display font-bold text-foreground">10 Tiket Aktif Terbaru</h3>
                    <button onClick={() => navigate('/command-center')} className="text-xs font-medium hover:underline inline-flex items-center gap-1 text-muted-foreground hover:text-foreground transition">
                        Buka Command Center <ArrowUpRight className="w-3 h-3" />
                    </button>
                </div>
                <div className="min-w-0">
                    <table className="w-full table-fixed text-left">
                        <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                            <tr>
                                <th className="px-4 py-3 font-medium text-left w-[170px]">Kode</th><th className="px-4 py-3 font-medium text-left">Pelapor</th><th className="px-4 py-3 font-medium text-left w-[14%]">Site</th>
                                <th className="px-4 py-3 font-medium text-left w-[18%]">Unit</th><th className="px-4 py-3 font-medium text-left w-[85px]">Prioritas</th><th className="px-4 py-3 font-medium text-left w-[120px]">Status</th><th className="px-4 py-3 font-medium text-left w-[120px]">SLA</th>
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
                                        </td>
                                        <td className="p-4">
                                            <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap ${ticket.slaTimeLeft <= 0 ? 'bg-red-100 text-red-700' :
                                                    ticket.slaTimeLeft <= 4 ? 'bg-amber-100 text-amber-700' :
                                                        'bg-emerald-100 text-emerald-700'
                                                }`}>
                                                {ticket.slaTimeLeft <= 0 ? 'Overdue' : `Sisa ${Math.ceil(ticket.slaTimeLeft)} Jam`}
                                            </span>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>

            {/* DRAWER DETAIL DASHBOARD */}
            {selectedTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={selectedTicket.code}
                    status={selectedTicket.status}
                    priority={selectedTicket.priority}
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
                    {activeDrawerTab === 'timeline' && <TicketTimeline items={selectedTicket.activities} />}
                    {activeDrawerTab === 'activity' && <TicketActivityLog items={selectedTicket.activities} />}
                </TicketDrawer>
            )}

            {/* MODAL VETO PENDING */}
            {showVetoModal && createPortal((
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-red-700"><Ban className="w-5 h-5" /> Veto Status Pending</h3>
                            <button onClick={() => { setShowVetoModal(false); setVetoReason(''); setVetoError('') }} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <p className="text-sm text-muted-foreground mb-4">Membatalkan status Pending dan mengembalikan tiket ke WORKING.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">Alasan Veto (Wajib) *</label>
                                <textarea value={vetoReason} onChange={e => { setVetoReason(e.target.value); setVetoError('') }} rows={3} className={`w-full mt-1 px-3 py-2 border-2 ${vetoError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm outline-none resize-none`} placeholder="Contoh: Alasan pending tidak valid, segera lanjutkan pekerjaan"></textarea>
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

function TipBar(props: { x: number; y: number; width: number; height: number; index: number }) {
    if (props.width <= 0) return null
    const TIP_COLORS = ['#dc2626', '#f59e0b', '#3b82f6']
    const CAP = 14, R = 4
    const tip = TIP_COLORS[props.index] ?? '#171717'
    const cw = Math.min(CAP, props.width)
    const bw = props.width - cw
    const capX = props.x + bw
    return (
        <g>
            {bw > 0 && <rect x={props.x} y={props.y} width={bw} height={props.height} fill="#171717" />}
            {cw >= 2 * R ? (
                <path d={`M${capX},${props.y} h${cw - R} a${R},${R} 0 0 1 ${R},${R} v${props.height - 2 * R} a${R},${R} 0 0 1 -${R},${R} h${-(cw - R)} Z`} fill={tip} />
            ) : (
                <rect x={capX} y={props.y} width={cw} height={props.height} fill={tip} />
            )}
        </g>
    )
}

function TrendChart({ data }: { data: { name: string; masuk: number; selesai: number }[] }) {
    const [hover, setHover] = useState<number | null>(null)
    const w = 600, h = 200, pad = 20
    const max = Math.max(1, ...data.flatMap(d => [d.masuk, d.selesai]))
    const x = (i: number) => pad + (i * (w - pad * 2)) / (data.length - 1)
    const y = (v: number) => h - pad - (v / max) * (h - pad * 2)
    const line = (key: 'masuk' | 'selesai') =>
        data.map((d, i) => `${i === 0 ? 'M' : 'L'}${x(i)},${y(d[key])}`).join(' ')

    const handleMove = (e: ReactMouseEvent<SVGSVGElement>) => {
        const rect = e.currentTarget.getBoundingClientRect()
        const px = ((e.clientX - rect.left) / rect.width) * w
        const idx = Math.round((px - pad) / ((w - pad * 2) / (data.length - 1)))
        setHover(Math.max(0, Math.min(data.length - 1, idx)))
    }

    return (
        <div className="relative">
            <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-56" onMouseMove={handleMove} onMouseLeave={() => setHover(null)}>
                {[0, 0.25, 0.5, 0.75, 1].map((f) => (
                    <line key={f} x1={pad} x2={w - pad} y1={pad + f * (h - pad * 2)} y2={pad + f * (h - pad * 2)}
                        stroke="currentColor" strokeOpacity="0.06" />
                ))}
                {hover !== null && (
                    <line x1={x(hover)} x2={x(hover)} y1={pad} y2={h - pad} stroke="currentColor" strokeOpacity="0.15" />
                )}
                <path d={`${line('masuk')} L${x(data.length - 1)},${h - pad} L${x(0)},${h - pad} Z`}
                    fill="currentColor" opacity="0.08" />
                <path d={line('masuk')} fill="none" stroke="currentColor" strokeWidth="3" />
                <path d={line('selesai')} fill="none" stroke="currentColor" strokeWidth="2.5" strokeDasharray="4 3" opacity="0.5" />
                {data.map((d, i) => (
                    <g key={i}>
                        <circle cx={x(i)} cy={y(d.masuk)} r={hover === i ? 5 : 4} fill="currentColor" />
                        <text x={x(i)} y={h - 4} textAnchor="middle" fontSize="10" fill="currentColor" opacity="0.5">{d.name}</text>
                    </g>
                ))}
            </svg>
            {hover !== null && (
                <div
                    className="absolute pointer-events-none bg-foreground text-background text-xs rounded px-2 py-1.5 shadow-lg z-10"
                    style={{
                        left: `${(x(hover) / w) * 100}%`,
                        top: `${(y(Math.max(data[hover].masuk, data[hover].selesai)) / h) * 100}%`,
                        transform: 'translate(-50%, -130%)',
                    }}
                >
                    <p className="font-semibold">{data[hover].name}</p>
                    <p>Masuk: <span className="font-bold">{data[hover].masuk}</span></p>
                    <p>Selesai: <span className="font-bold">{data[hover].selesai}</span></p>
                </div>
            )}
        </div>
    )
}
