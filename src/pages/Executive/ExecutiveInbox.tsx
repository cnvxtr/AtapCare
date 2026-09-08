import { useState, useEffect } from 'react'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Search, AlertTriangle, Table, LayoutGrid, User, Filter } from 'lucide-react'
import { Badge, STATUS_COLORS } from '../../components/Badge'
import TicketDrawer, { TicketTimeline, TicketDescription, AssignmentCard } from '../../components/TicketDrawer'
import MultiSelectFilter, { toggleFilter } from '../../components/MultiSelectFilter'
import { selectTriggerFilter } from '../../components/ui/select'
import { getPendingAlarm } from '../../lib/pendingAlarm'
import { SEGMENTS } from '../../lib/constants'
import { useIsMobile } from '../../lib/platform'

const KANBAN_COLUMNS = SEGMENTS.filter(s => s.key !== 'semua')

export default function ExecutiveInbox() {
    const { tickets, getTicketCount } = useTickets()
    const isMobile = useIsMobile()
    const [activeSegment, setActiveSegment] = useState('semua')
    const [view, setView] = useState<'list' | 'kanban'>('kanban')
    const [prioritySel, setPrioritySel] = useState<Record<string, boolean>>({ all: true })
    const [searchTerm, setSearchTerm] = useState('')
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline'>('detail')

    useEffect(() => {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3')
        audio.volume = 0.5
        if (getTicketCount('NEW') > 0) audio.play().catch(() => { })
    }, [tickets, getTicketCount])

    const activeSegmentStatuses = SEGMENTS.find(s => s.key === activeSegment)?.statuses || null
    const isActive = (t: Ticket) => !['VOID', 'DUPLICATE'].includes(t.status)
    const matchesPrioritySearch = (t: Ticket) =>
        (prioritySel['all'] || (t.priority !== undefined && !!prioritySel[t.priority])) &&
        (searchTerm === '' ||
            t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.site && t.site.toLowerCase().includes(searchTerm.toLowerCase())) ||
            (t.description && t.description.toLowerCase().includes(searchTerm.toLowerCase())))
    const filteredTickets = tickets
        .filter(t => isActive(t) && (!activeSegmentStatuses || activeSegmentStatuses.includes(t.status)) && matchesPrioritySearch(t))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const kanbanTickets = tickets.filter(t => isActive(t) && matchesPrioritySearch(t))
    const liveTicket = selectedTicket ? (tickets.find(t => t.id === selectedTicket.id) ?? selectedTicket) : null
    const pendingAlarmCount = tickets.filter(t => t.status === 'PENDING' && getPendingAlarm(t.updatedAt)).length

    return (
        <div className={`space-y-6 flex flex-col ${view === 'list' ? '' : 'h-[calc(100vh-7rem)]'}`}>
            {/* HEADER */}
            <div className="flex justify-end">
                <span className="bg-red-600 text-white px-3 py-1.5 rounded-sm text-sm font-medium border border-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {getTicketCount('NEW') + getTicketCount('RESOLVED')} Perlu Tindakan
                </span>
            </div>

            {/* BOX 1: Pencarian, Prioritas, Toggle View */}
            <div className="bg-card p-4 rounded-xl border border-border">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Cari kode, pelanggan, site, atau deskripsi..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded text-sm focus:ring-2 focus:ring-gray-400 outline-none" />
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded border border-border bg-card shrink-0">
                        <button onClick={() => setView('kanban')} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${view === 'kanban' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button onClick={() => setView('list')} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${view === 'list' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            <Table className="h-3.5 w-3.5" /> Tabel
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <MultiSelectFilter
                            label="Semua Prioritas"
                            selected={prioritySel}
                            onToggle={v => setPrioritySel(prev => toggleFilter(prev, v, ['Critical', 'Medium', 'Low']))}
                            options={[
                                { value: 'Critical', label: 'Critical' },
                                { value: 'Medium', label: 'Medium' },
                                { value: 'Low', label: 'Low' },
                            ]}
                            className={selectTriggerFilter}
                        />
                    </div>
                </div>
            </div>

            {/* BOX 2: Status Flow (hanya di mode Tabel) */}
            {view === 'list' && (
                <div className="bg-card p-4 rounded-xl border border-border">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        {SEGMENTS.map(seg => {
                            const c = seg.statuses ? STATUS_COLORS[seg.statuses[0]] : null
                            return (
                                <button
                                    key={seg.key}
                                    onClick={() => setActiveSegment(seg.key)}
                                    className={`px-3 py-1.5 rounded-[5px] text-sm font-medium inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap ${activeSegment === seg.key ? (c ? '' : 'bg-foreground text-primary-foreground') : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                    style={activeSegment === seg.key && c ? { backgroundColor: c.bg, color: c.text } : undefined}
                                >
                                    {seg.label}
                                    {seg.role && <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">{seg.role}</span>}
                                    {seg.key === 'dijeda' && pendingAlarmCount > 0 && <span className="text-[9px] font-mono bg-amber-100 text-amber-700 px-1 rounded-full">{pendingAlarmCount}</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* KANBAN / LIST */}
            {view === 'kanban' ? (
                <div className="rounded-xl border border-border bg-card p-4 flex-1 min-h-0 flex flex-col">
                    <div className={`flex gap-2 flex-1 min-h-0 ${isMobile ? 'overflow-x-auto snap-x snap-mandatory pb-2' : 'overflow-x-auto'}`}>
                        {KANBAN_COLUMNS.map(col => {
                            const items = kanbanTickets.filter(t => col.statuses?.includes(t.status))
                            const c = col.statuses ? STATUS_COLORS[col.statuses[0]] : null
                            return (
                                <div key={col.key} className={`rounded-lg border border-border bg-card/50 flex flex-col ${isMobile ? 'min-w-[35vw] snap-start shrink-0' : 'flex-1 min-w-[110px]'}`}>
                                    <div className="relative p-2 border-b border-border">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded" style={c ? { backgroundColor: c.bg, color: c.text } : undefined}>
                                            {col.label}
                                            {!isMobile && col.role && <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">({col.role})</span>}
                                        </span>
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">{items.length}</span>
                                    </div>
                                    <div className="p-1.5 space-y-1.5 min-h-[100px] flex-1 overflow-y-auto  max-h-[390px]">
                                        {items.map(t => {
                                            const isUrgent = t.priority === 'Critical' && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)
                                            return (
                                                <div key={t.id} className={`rounded border hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${isMobile ? 'p-1.5' : 'p-2'} ${isUrgent ? 'pulse-ring border-red-200' : 'border-border'} bg-card`} onClick={() => { setSelectedTicket(t); setActiveDrawerTab('detail') }}>
                                                <div className="flex items-center justify-between gap-1 mb-1">
                                                    <span className={`font-mono text-muted-foreground truncate ${isMobile ? 'text-[7px]' : 'text-[8px]'}`}>{t.code}</span>
                                                    <Badge type="priority" value={t.priority || '-'} small />
                                                </div>
                                                <p className={`font-medium truncate ${isMobile ? 'text-[8px]' : 'text-[9px]'}`}>{t.site} - {t.unit}</p>
                                                {t.status === 'PENDING' && getPendingAlarm(t.updatedAt) && (
                                                    <div className={`mt-1 flex items-center gap-1 bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-[3px] font-bold ${isMobile ? 'text-[7px]' : 'text-[8px]'}`}>
                                                        <AlertTriangle className="h-2 w-2" /> Dijeda {getPendingAlarm(t.updatedAt)}
                                                    </div>
                                                )}
                                                <div className="flex items-center justify-between gap-1 mt-1 pt-1 border-t border-border min-w-0">
                                                    <div className="flex items-center gap-1 min-w-0">
                                                        <User className="h-2 w-2 shrink-0 text-muted-foreground" />
                                                        <span className={`text-muted-foreground truncate ${isMobile ? 'text-[7px]' : 'text-[8px]'}`}>{t.customer}</span>
                                                     </div>
                                                </div>
                                            </div>
                                            )
                                        })}
                                        {items.length === 0 && <div className="text-center text-[10px] text-muted-foreground py-8">Kosong</div>}
                                    </div>
                                </div>
                            )
                        })}
                    </div>
                </div>
            ) : (
                <div className="rounded-xl border border-border bg-card overflow-hidden">
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
                                {filteredTickets.length === 0 ? (
                                    <tr><td colSpan={6} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
                                ) : (
                                    filteredTickets.map(ticket => (
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
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
            )}

            {/* DRAWER DETAIL */}
            {liveTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={liveTicket.code}
                    ticketId={liveTicket.id}
                    status={liveTicket.status}
                    priority={liveTicket.priority}
                    createdAt={liveTicket.createdAt}
                    activeTab={activeDrawerTab}
                    onTabChange={setActiveDrawerTab}
                    activities={liveTicket.activities}
                    duplicateCode={liveTicket.duplicateOf ? (tickets.find(t => t.id === liveTicket.duplicateOf)?.code ?? undefined) : undefined}
                    footer={<p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>}
                >
                    {activeDrawerTab === 'detail' && (
                        <div className="space-y-4">
                            {liveTicket.status === 'PENDING' && getPendingAlarm(liveTicket.updatedAt) && (
                                <div className="bg-amber-50/60 p-3 rounded-[3px] border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
                                    <AlertTriangle className="w-4 h-4 shrink-0" /> Dijeda {getPendingAlarm(liveTicket.updatedAt)} tanpa aktivitas
                                </div>
                            )}
                            <AssignmentCard items={liveTicket.activities} />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Pelapor</p>
                                    <p className="font-medium text-sm">{liveTicket.customer}</p>
                                </div>
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Site / Unit</p>
                                    <p className="font-medium text-sm">{liveTicket.site} - {liveTicket.unit}</p>
                                </div>
                            </div>
                            <TicketDescription description={liveTicket.description} />
                            {liveTicket.rejectionReason && (
                                <div className="bg-red-50/60 p-4 rounded-lg border border-red-200">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-red-600 mb-1">Alasan Penolakan / VOID</p>
                                    <p className="text-sm text-red-800">{liveTicket.rejectionReason}</p>
                                </div>
                            )}
                            {liveTicket.activities.filter(a => a.details?.startsWith('Catatan Internal')).length > 0 && (
                                <div className="bg-amber-50/60 p-4 rounded-lg border border-amber-200">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-amber-700 mb-2">Catatan Internal</p>
                                    {liveTicket.activities.filter(a => a.details?.startsWith('Catatan Internal')).map((a, i) => (
                                        <p key={i} className="text-sm text-amber-900 mb-1">{a.details}</p>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                    {activeDrawerTab === 'timeline' && <TicketTimeline items={liveTicket.activities} isFinal={['CLOSED', 'RESOLVED', 'VOID', 'DUPLICATE', 'REJECTED'].includes(liveTicket.status)} />}
                </TicketDrawer>
            )}
        </div>
    )
}
