import { useState, useMemo, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { Search, Table, LayoutGrid, Filter, User, Ban, AlertTriangle, ChevronDown, Check, X } from 'lucide-react'
import { Badge, STATUS_COLORS } from '../../components/Badge'
import TicketDrawer, { TicketTimeline, TicketDescription, TicketActivityLog, AssignmentCard, getAssignmentInfo, isScheduleOvertime } from '../../components/TicketDrawer'
import { selectTriggerFilter } from '../../components/ui/select'
import MultiSelectFilter, { toggleFilter } from '../../components/MultiSelectFilter'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger, DropdownMenuItem } from '../../components/ui/dropdown-menu'
import FieldError from '../../components/FieldError'
import { Popover, PopoverContent, PopoverTrigger } from '../../components/ui/popover'
import SchedulePicker from '../../components/SchedulePicker'
import { getTechnicians } from '../../services/users'

// SEGMEN STATUS FLOW TIKET (persis helpdesk)
const SEGMENTS = [
    { key: 'semua', label: 'Semua', role: '', statuses: null },
    { key: 'baru', label: 'Baru', role: 'HP', statuses: ['NEW'] },
    { key: 'diproses', label: 'Diproses', role: 'HP', statuses: ['OPEN'] },
    { key: 'ditugaskan', label: 'Ditugaskan', role: 'PM', statuses: ['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE'] },
    { key: 'dikerjakan', label: 'Dikerjakan', role: 'TEK', statuses: ['WORKING'] },
    { key: 'dijeda', label: 'Dijeda', role: 'PM', statuses: ['PENDING'] },
    { key: 'selesai', label: 'Selesai', role: 'HP', statuses: ['RESOLVED'] },
    { key: 'tutup', label: 'Tutup', role: '', statuses: ['CLOSED'] },
]
const KANBAN_COLUMNS = SEGMENTS.filter(s => s.key !== 'semua')
const ALL_STATUSES = [...new Set(KANBAN_COLUMNS.flatMap(c => c.statuses || []))]

export default function PMCommandCenter() {
    const { tickets, updateTicketStatus, assignTicket } = useTickets()
    const [viewMode, setViewMode] = useState<'list' | 'kanban'>('kanban')
    const [activeSegment, setActiveSegment] = useState('semua')
    const [prioritySel, setPrioritySel] = useState<Record<string, boolean>>({ all: true })
    const [searchTerm, setSearchTerm] = useState('')

    // State untuk Drawer & Modals
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline' | 'activity'>('detail')
    const [showAssignModal, setShowAssignModal] = useState(false)
    const [showReassignModal, setShowReassignModal] = useState(false)
    const [showVetoModal, setShowVetoModal] = useState(false)
    const [confirmAssign, setConfirmAssign] = useState<null | { teknisi: string; teknisiId: string; scheduleDate: string; scheduleTime: string; isOvertime: boolean; supportIds: string[] }>(null)
    const [assignErrors, setAssignErrors] = useState<{ tech?: string; date?: string; time?: string }>({})
    const [reassignErrors, setReassignErrors] = useState<{ tech?: string; reason?: string }>({})
    const [vetoErrors, setVetoErrors] = useState<{ reason?: string }>({})

    // State Form
    const [selectedTech, setSelectedTech] = useState('')
    const [supportSel, setSupportSel] = useState<string[]>([])
    const [scheduleDate, setScheduleDate] = useState('')
    const [scheduleTime, setScheduleTime] = useState('')
    const [calendarOpen, setCalendarOpen] = useState(false)
    const [actionReason, setActionReason] = useState('')
    const [technicians, setTechnicians] = useState<{ id: string; name: string }[]>([])

    useEffect(() => {
        getTechnicians().then(setTechnicians).catch(() => {})
    }, [])

    const needAssign = tickets.filter(t => t.status === 'UNASSIGNED').length
    const needPending = tickets.filter(t => t.status === 'PENDING').length
    const cAssign = STATUS_COLORS['UNASSIGNED']
    const cPending = STATUS_COLORS['PENDING']

    const baseTickets = useMemo(() => {
        const matchesFilter = (t: Ticket) =>
            (prioritySel['all'] || (t.priority !== undefined && !!prioritySel[t.priority])) &&
            (searchTerm === '' ||
                t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.site && t.site.toLowerCase().includes(searchTerm.toLowerCase())))
        return tickets
            .filter(t => ALL_STATUSES.includes(t.status) && matchesFilter(t))
            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    }, [tickets, prioritySel, searchTerm])

    const activeSegmentStatuses = SEGMENTS.find(s => s.key === activeSegment)?.statuses || null
    const listTickets = activeSegmentStatuses ? baseTickets.filter(t => activeSegmentStatuses.includes(t.status)) : baseTickets

    // --- ACTION HANDLERS ---
    const doAssign = () => {
        if (!confirmAssign || !selectedTicket) return
        assignTicket(selectedTicket.id, confirmAssign.teknisiId, confirmAssign.teknisi, `Jadwal: ${confirmAssign.scheduleDate} ${confirmAssign.scheduleTime}`, confirmAssign.supportIds)
        closeModals()
    }

    const handleAssign = () => {
        const errs: { tech?: string; date?: string; time?: string } = {}
        if (!selectedTech) errs.tech = 'Mohon pilih teknisi'
        if (!scheduleDate) errs.date = 'Mohon pilih tanggal'
        if (!scheduleTime) errs.time = 'Mohon pilih jam'
        if (Object.keys(errs).length) { setAssignErrors(errs); return }
        setAssignErrors({})
        // Cek Lembur (BR 3.2.2): akhir pekan ATAU jam di luar jam operasional 08.15-17.00 WIB.
        const isOvertime = isScheduleOvertime(`${scheduleDate}T${scheduleTime}`)
        setConfirmAssign({
            teknisi: technicians.find(t => t.id === selectedTech)?.name || 'Teknisi',
            teknisiId: selectedTech,
            scheduleDate,
            scheduleTime,
            isOvertime,
            supportIds: supportSel,
        })
    }

    const handleReassign = () => {
        const errs: { tech?: string; reason?: string } = {}
        if (!selectedTech) errs.tech = 'Mohon pilih teknisi baru'
        if (!actionReason.trim()) errs.reason = 'Mohon isi alasan pergantian teknisi'
        if (Object.keys(errs).length) { setReassignErrors(errs); return }
        setReassignErrors({})
        const namaBaru = technicians.find(t => t.id === selectedTech)?.name
        const { jadwal } = selectedTicket ? getAssignmentInfo(selectedTicket.activities) : {}
        assignTicket(selectedTicket!.id, selectedTech, namaBaru, `${jadwal ? 'Jadwal: ' + jadwal + '. ' : ''}Alasan: ${actionReason}`)
        closeModals()
    }

    const handleVetoPending = () => {
        if (!actionReason.trim()) { setVetoErrors({ reason: 'Mohon isi alasan veto' }); return }
        setVetoErrors({})
        updateTicketStatus(selectedTicket!.id, 'WORKING', `Veto Pending oleh PM. Alasan: ${actionReason}. SLA dilanjutkan.`)
        closeModals()
    }

    const closeModals = () => {
        setShowAssignModal(false); setShowReassignModal(false); setShowVetoModal(false)
        setConfirmAssign(null); setAssignErrors({}); setReassignErrors({}); setVetoErrors({})
        setSelectedTicket(null); setSelectedTech(''); setSupportSel([]); setScheduleDate(''); setScheduleTime(''); setCalendarOpen(false); setActionReason('')
    }

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-7rem)]">
            {/* HEADER */}
            <div className="flex justify-end gap-4">
                <div className="flex gap-2">
                    <span className="px-3 py-1.5 rounded-sm text-sm font-medium border flex items-center gap-2" style={{ backgroundColor: cAssign.bg, color: cAssign.text, borderColor: cAssign.bg }}>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        {needAssign} Ditugaskan
                    </span>
                    <span className="px-3 py-1.5 rounded-sm text-sm font-medium border flex items-center gap-2" style={{ backgroundColor: cPending.bg, color: cPending.text, borderColor: cPending.bg }}>
                        <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                        {needPending} Dijeda
                    </span>
                </div>
            </div>

            {/* BOX FILTER: Pencarian, View, Prioritas */}
            <div className="bg-card p-4 rounded-xl border border-border">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Cari kode, pelanggan, atau site..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded text-sm focus:ring-2 focus:ring-gray-400 outline-none" />
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded border border-border bg-card shrink-0">
                        <button onClick={() => setViewMode('kanban')} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${viewMode === 'kanban' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            <LayoutGrid className="h-3.5 w-3.5" /> Kanban
                        </button>
                        <button onClick={() => setViewMode('list')} className={`px-2.5 py-1.5 rounded text-xs inline-flex items-center gap-1.5 transition ${viewMode === 'list' ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}>
                            <Table className="h-3.5 w-3.5" /> Tabel
                        </button>
                    </div>
                    <div className="flex items-center gap-2">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <MultiSelectFilter
                            label="Semua Prioritas"
                            selected={prioritySel}
                            onToggle={v => setPrioritySel(prev => toggleFilter(prev, v, ['P1', 'P2', 'P3']))}
                            options={[
                                { value: 'P1', label: 'P1 (Kritis)' },
                                { value: 'P2', label: 'P2 (Medium)' },
                                { value: 'P3', label: 'P3 (Low)' },
                            ]}
                            className={selectTriggerFilter}
                        />
                    </div>
                </div>
            </div>

            {/* BOX 2: Status Flow (hanya di mode Tabel) */}
            {viewMode === 'list' && (
                <div className="bg-card p-4 rounded-xl border border-border">
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                        {SEGMENTS.map(seg => {
                            const c = seg.statuses ? STATUS_COLORS[seg.statuses[0]] : null
                            return (
                                <button
                                    key={seg.key}
                                    onClick={() => setActiveSegment(seg.key)}
                                    className={`px-3 py-1.5 rounded-sm text-sm font-medium inline-flex items-center justify-center gap-1.5 transition whitespace-nowrap ${activeSegment === seg.key ? (c ? '' : 'bg-foreground text-primary-foreground') : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                    style={activeSegment === seg.key && c ? { backgroundColor: c.bg, color: c.text } : undefined}
                                >
                                    {seg.label}
                                    {seg.role && <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">{seg.role}</span>}
                                </button>
                            )
                        })}
                    </div>
                </div>
            )}

            {/* KANBAN / LIST */}
            {viewMode === 'kanban' ? (
                <div className="rounded-xl border border-border bg-card p-4 flex-1 min-h-0 flex flex-col">
                    <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-4 xl:grid-cols-7 flex-1 min-h-0">
                        {KANBAN_COLUMNS.map(col => {
                            const items = baseTickets.filter(t => col.statuses?.includes(t.status))
                            const c = col.statuses ? STATUS_COLORS[col.statuses[0]] : null
                            return (
                                <div key={col.key} className="shrink-0 min-w-[240px] md:min-w-0 md:shrink rounded-lg border border-border bg-card/50 flex flex-col">
                                    <div className="relative p-2 border-b border-border">
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-medium rounded" style={c ? { backgroundColor: c.bg, color: c.text } : undefined}>
                                            {col.label}
                                            {col.role && <span className="text-[9px] font-mono uppercase tracking-wider opacity-70">({col.role})</span>}
                                        </span>
                                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-mono text-muted-foreground">{items.length}</span>
                                    </div>
                                    <div className="p-1.5 space-y-1.5 min-h-[100px] flex-1 overflow-y-auto no-scrollbar">
                                        {items.map(t => {
                                            const isUrgent = t.priority === 'P1'
                                            return (
                                                <div key={t.id} className={`rounded border border-border bg-card p-2 hover:shadow-md hover:-translate-y-0.5 transition-all cursor-pointer ${isUrgent ? 'pulse-ring border-red-200' : ''}`} onClick={() => { setSelectedTicket(t); setActiveDrawerTab('detail') }}>
                                                    <div className="flex items-center justify-between gap-1 mb-1">
                                                        <span className="font-mono text-[8px] text-muted-foreground truncate">{t.code}</span>
                                                        <Badge type="priority" value={t.priority || '-'} small />
                                                    </div>
                                                    <p className="text-[9px] font-medium truncate">{t.site} - {t.unit}</p>
                                                    <div className="flex items-center gap-1 mt-1 pt-1 border-t border-border min-w-0">
                                                        <User className="h-2 w-2 shrink-0 text-muted-foreground" />
                                                        <span className="text-[8px] text-muted-foreground truncate">{t.customer}</span>
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
                                        <th className="px-4 py-3 font-medium text-left w-[18%]">Unit</th><th className="px-4 py-3 font-medium text-left w-[85px]">Prioritas</th><th className="px-4 py-3 font-medium text-left w-[120px]">Status</th><th className="px-4 py-3 font-medium text-left w-[120px]">SLA</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-border">
                                    {listTickets.length === 0 ? (
                                        <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
                                    ) : (
                                        listTickets.map(ticket => (
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
            )}

            {/* ========================================== */}
            {/* TIER 3: OFFCANVAS DETAIL DRAWER */}
            {/* ========================================== */}
            {selectedTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={selectedTicket.code}
                    status={selectedTicket.status}
                    priority={selectedTicket.priority}
                    slaTimeLeft={selectedTicket.slaTimeLeft}
                    createdAt={selectedTicket.createdAt}
                    activeTab={activeDrawerTab}
                    onTabChange={setActiveDrawerTab}
                    activities={selectedTicket.activities}
                    footer={
                        <>
                            {selectedTicket.status === 'UNASSIGNED' && (
                                <button onClick={() => setShowAssignModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-foreground text-primary-foreground rounded-md font-bold">
                                    <User className="w-4 h-4" /> Tugaskan Teknisi
                                </button>
                            )}
                            {(selectedTicket.status === 'SCHEDULED' || selectedTicket.status === 'EN_ROUTE') && (
                                <button onClick={() => setShowReassignModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-neutral-700 text-white rounded-md font-bold hover:bg-neutral-800 transition">
                                    <User className="w-4 h-4" /> Ganti Teknisi
                                </button>
                            )}
                            {selectedTicket.status === 'PENDING' && (
                                <button onClick={() => setShowVetoModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-red-600 text-white rounded-md font-bold hover:bg-red-700 transition">
                                    <Ban className="w-4 h-4" /> Veto Pending (Lanjutkan Kerja)
                                </button>
                            )}
                            {['WORKING', 'RESOLVED'].includes(selectedTicket.status) && (
                                <p className="text-center text-xs text-muted-foreground italic">Monitoring Mode: Menunggu update dari lapangan atau validasi Helpdesk.</p>
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

            {/* ========================================== */}
            {/* MODALS */}
            {/* ========================================== */}

            {/* 1. MODAL TUGASKAN */}
            {showAssignModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6 max-h-[90vh] overflow-y-auto">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><User className="w-5 h-5" /> Tugaskan Teknisi</h3>
                            <button onClick={() => setShowAssignModal(false)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-foreground">Pilih Teknisi</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button type="button" className={`w-full mt-1 px-3 py-2 border-2 ${assignErrors.tech ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm flex items-center justify-between gap-1 outline-none`}>
                                            <span className={`truncate ${selectedTech ? 'text-foreground' : 'text-muted-foreground'}`}>{selectedTech ? technicians.find(t => t.id === selectedTech)?.name : '-- Pilih Teknisi --'}</span>
                                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="z-[130] border-border bg-card text-foreground p-1.5 min-w-[220px] max-h-72 overflow-y-auto">
                                        {technicians.length === 0 ? (
                                            <p className="px-2 py-1.5 text-xs text-muted-foreground">Belum ada teknisi terdaftar</p>
                                        ) : technicians.map(t => (
                                            <DropdownMenuItem key={t.id} onSelect={() => { setSelectedTech(prev => prev === t.id ? '' : t.id); setAssignErrors(prev => ({ ...prev, tech: undefined })) }} className={`relative flex w-full items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer transition-colors ${selectedTech === t.id ? 'bg-foreground text-primary-foreground' : 'hover:bg-foreground hover:text-primary-foreground focus:bg-foreground focus:text-primary-foreground'}`}>
                                                <span className="truncate">{t.name}</span>
                                                {selectedTech === t.id && <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><Check className="h-4 w-4" /></span>}
                                            </DropdownMenuItem>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <FieldError msg={assignErrors.tech} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-foreground">Teknisi Pendukung</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button type="button" className="w-full mt-1 px-3 py-2 border-2 border-border focus:border-foreground rounded text-sm flex items-center justify-between gap-1 outline-none">
                                            <span className={`truncate ${supportSel.length ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {supportSel.length
                                                    ? supportSel.map(id => technicians.find(t => t.id === id)?.name || id).join(', ')
                                                    : '-- Pilih Teknisi Pendukung --'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="z-[130] border-border bg-card text-foreground p-1.5 min-w-[240px] max-h-72 overflow-y-auto">
                                        {technicians.filter(t => t.id !== selectedTech).length === 0 ? (
                                            <p className="px-2 py-1.5 text-xs text-muted-foreground">Tidak ada teknisi lain</p>
                                        ) : technicians.filter(t => t.id !== selectedTech).map(t => (
                                            <label key={t.id} className={`relative flex w-full items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer transition-colors ${supportSel.includes(t.id) ? 'bg-foreground text-primary-foreground' : 'hover:bg-foreground hover:text-primary-foreground'}`}>
                                                <input type="checkbox" checked={supportSel.includes(t.id)}
                                                    onChange={() => setSupportSel(prev => prev.includes(t.id) ? prev.filter(x => x !== t.id) : [...prev, t.id])}
                                                    className="sr-only" />
                                                <span className="truncate">{t.name}</span>
                                                {supportSel.includes(t.id) && <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><Check className="h-4 w-4" /></span>}
                                            </label>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-foreground">Jadwal Pelaksanaan</label>
                                <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
                                    <PopoverTrigger asChild>
                                        <button type="button" className={`w-full mt-1 px-3 py-2 border-2 ${assignErrors.date || assignErrors.time ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm flex items-center justify-between gap-1 outline-none`}>
                                            <span className={`truncate ${scheduleDate && scheduleTime ? 'text-foreground' : 'text-muted-foreground'}`}>
                                                {scheduleDate && scheduleTime
                                                    ? `${new Date(`${scheduleDate}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })} · ${scheduleTime} WIB`
                                                    : 'Pilih Tanggal & Jam'}
                                            </span>
                                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                        </button>
                                    </PopoverTrigger>
                                    <PopoverContent align="start" className="z-[130] w-auto p-3 border-border bg-card">
                                        <SchedulePicker
                                            date={scheduleDate}
                                            time={scheduleTime}
                                            onDate={d => { setScheduleDate(d); setAssignErrors(prev => ({ ...prev, date: undefined })) }}
                                            onTime={t => { setScheduleTime(t); setAssignErrors(prev => ({ ...prev, time: undefined })); setCalendarOpen(false) }}
                                        />
                                    </PopoverContent>
                                </Popover>
                                <FieldError msg={assignErrors.date || assignErrors.time} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowAssignModal(false)} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={handleAssign} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Tugaskan</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {/* 1b. MODAL KONFIRMASI PENUGASAN */}
            {confirmAssign && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2"><Check className="w-5 h-5" /> Konfirmasi Penugasan</h3>
                            <button onClick={() => setConfirmAssign(null)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div className="grid grid-cols-1 gap-4">
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Teknisi</p>
                                    <p className="font-medium text-sm">{confirmAssign.teknisi}</p>
                                </div>
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Tanggal</p>
                                    <p className="font-medium text-sm">{new Date(`${confirmAssign.scheduleDate}T00:00:00`).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
                                </div>
                                <div className="bg-muted p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Jam</p>
                                    <p className="font-medium text-sm">{confirmAssign.scheduleTime}</p>
                                </div>
                                {confirmAssign.supportIds.length > 0 && (
                                    <div className="bg-muted p-4 rounded-lg border border-border">
                                        <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Teknisi Pendukung</p>
                                        <p className="font-medium text-sm">{confirmAssign.supportIds.map(id => technicians.find(t => t.id === id)?.name || id).join(', ')}</p>
                                    </div>
                                )}
                            </div>
                            {confirmAssign.isOvertime && (
                                <div className="bg-amber-50/60 p-4 rounded-lg border border-amber-200">
                                    <p className="text-sm text-amber-800 flex items-center gap-2"> <AlertTriangle className="w-4 h-4 shrink-0" /> Berpotensi Lembur: jadwal di luar jam operasional (08.15–17.00) atau akhir pekan.</p>
                                </div>
                            )}
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setConfirmAssign(null)} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={doAssign} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Ya, Tugaskan</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {/* 2. MODAL GANTI TEKNISI */}
            {showReassignModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold flex items-center gap-2 text-neutral-700"><AlertTriangle className="w-5 h-5" /> Ganti Teknisi</h3>
                            <button onClick={() => setShowReassignModal(false)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">Pilih Teknisi Baru</label>
                                <DropdownMenu>
                                    <DropdownMenuTrigger asChild>
                                        <button type="button" className={`w-full mt-1 px-3 py-2 border-2 ${reassignErrors.tech ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm flex items-center justify-between gap-1 outline-none`}>
                                            <span className={`truncate ${selectedTech ? 'text-foreground' : 'text-muted-foreground'}`}>{selectedTech ? technicians.find(t => t.id === selectedTech)?.name : '-- Pilih Teknisi --'}</span>
                                            <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                                        </button>
                                    </DropdownMenuTrigger>
                                    <DropdownMenuContent align="start" className="z-[130] border-border bg-card text-foreground p-1.5 min-w-[220px] max-h-72 overflow-y-auto">
                                        {technicians.length === 0 ? (
                                            <p className="px-2 py-1.5 text-xs text-muted-foreground">Belum ada teknisi terdaftar</p>
                                        ) : technicians.map(t => (
                                            <label key={t.id} className={`relative flex w-full items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer transition-colors ${selectedTech === t.id ? 'bg-foreground text-primary-foreground' : 'hover:bg-foreground hover:text-primary-foreground'}`}>
                                                <input type="radio" name="reassign-tech" checked={selectedTech === t.id} onChange={() => { setSelectedTech(t.id); setReassignErrors(prev => ({ ...prev, tech: undefined })) }} className="sr-only" />
                                                <span className="truncate">{t.name}</span>
                                                {selectedTech === t.id && <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center"><Check className="h-4 w-4" /></span>}
                                            </label>
                                        ))}
                                    </DropdownMenuContent>
                                </DropdownMenu>
                                <FieldError msg={reassignErrors.tech} />
                            </div>
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">Alasan Ganti Teknisi (Wajib)</label>
                                <textarea value={actionReason} onChange={e => { setActionReason(e.target.value); setReassignErrors(prev => ({ ...prev, reason: undefined })) }} rows={3} className={`w-full mt-1 px-3 py-2 border-2 ${reassignErrors.reason ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm outline-none resize-none`} placeholder="Contoh: Teknisi sakit, alat tidak lengkap, dll"></textarea>
                                <FieldError msg={reassignErrors.reason} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowReassignModal(false)} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={handleReassign} className="flex-1 py-2 bg-neutral-700 text-white rounded font-bold">Ganti Teknisi</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}
            
            {/* 3. MODAL VETO PENDING */}
            {showVetoModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-700"><Ban className="w-5 h-5" /> Veto Status Pending</h3>
                        <p className="text-sm text-muted-foreground mb-4">Tindakan ini akan membatalkan status Pending dan mengembalikan tiket ke WORKING. SLA akan dilanjutkan.</p>
                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-semibold text-muted-foreground">Alasan Veto (Wajib)</label>
                                <textarea value={actionReason} onChange={e => { setActionReason(e.target.value); setVetoErrors(prev => ({ ...prev, reason: undefined })) }} rows={3} className={`w-full mt-1 px-3 py-2 border-2 ${vetoErrors.reason ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded text-sm outline-none resize-none`} placeholder="Contoh: Alasan pending tidak valid, segera lanjutkan pekerjaan"></textarea>
                                <FieldError msg={vetoErrors.reason} />
                            </div>
                            <div className="flex gap-3 pt-2">
                                <button onClick={() => setShowVetoModal(false)} className="flex-1 py-2 bg-muted rounded font-medium">Batal</button>
                                <button onClick={handleVetoPending} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Veto & Lanjutkan</button>
                            </div>
                        </div>
                    </div>
                </div>
            ), document.body)}
        </div>
    )
}
