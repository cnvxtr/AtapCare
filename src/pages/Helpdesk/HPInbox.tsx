import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { useTickets, type Ticket, type Priority, type TicketStatus } from '../../context/TicketContext'
import { Plus, Filter, X, Search, Send, AlertTriangle, CheckCircle2, Table, LayoutGrid, User, Headset, ImagePlus, MapPin, FileText, Info } from 'lucide-react'
import { Badge, STATUS_COLORS } from '../../components/Badge'
import TicketDrawer, { TicketTimeline, TicketDescription, TicketActivityLog, AssignmentCard, parseDescription } from '../../components/TicketDrawer'
import { waMeLink } from '../../services/wa'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, selectTriggerFilter } from '../../components/ui/select'
import { Combobox } from '../../components/ui/combobox'
import MultiSelectFilter, { toggleFilter } from '../../components/MultiSelectFilter'
import FieldError from '../../components/FieldError'
import { getCustomers, getSites, getUnits, type Customer, type SiteRow, type UnitRow } from '../../services/master-data'

const MAX_PHOTOS = 5;
const MAX_TOTAL_SIZE_MB = 10;

// SEGMEN STATUS FLOW TIKET
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

// KOLOM KANBAN = grup segmen alur status (tanpa 'Semua')
const KANBAN_COLUMNS = SEGMENTS.filter(s => s.key !== 'semua')

// GAYA INPUT BERSAMA (design system .input di index.css)
const inputCls = 'input disabled:bg-muted disabled:text-muted-foreground disabled:cursor-not-allowed'
const readOnlyInputCls = 'input read-only:bg-muted read-only:text-muted-foreground read-only:cursor-not-allowed'

export default function HPInbox() {
    const { tickets, updateTicketStatus, getTicketCount, addTicket } = useTickets()
    const [activeSegment, setActiveSegment] = useState('semua')
    const [view, setView] = useState<'list' | 'kanban'>('kanban')
    const [prioritySel, setPrioritySel] = useState<Record<string, boolean>>({ all: true })
    const [searchTerm, setSearchTerm] = useState('')
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<'detail' | 'timeline' | 'activity'>('detail')

    // State Modals
    const [showVoidModal, setShowVoidModal] = useState(false)
    const [showDuplicateModal, setShowDuplicateModal] = useState(false)
    const [showRemoteModal, setShowRemoteModal] = useState(false)
    const [showValidationModal, setShowValidationModal] = useState(false)
    const [showConfirmPath, setShowConfirmPath] = useState(false)

    // State Forms
    const [voidReason, setVoidReason] = useState('')
    const [duplicateTargetId, setDuplicateTargetId] = useState('')
    const [voidTicketId, setVoidTicketId] = useState<string | null>(null)
    const [remoteMedia, setRemoteMedia] = useState('WA')
    const [remoteNotes, setRemoteNotes] = useState('')
    const [remoteDuration, setRemoteDuration] = useState('')
    const [remoteResult, setRemoteResult] = useState<'success' | 'fail' | ''>('')
    const [validationAction, setValidationAction] = useState<'close' | 'rework'>('close')
    const [reworkReason, setReworkReason] = useState('')
    const [reworkError, setReworkError] = useState('')
    const [voidError, setVoidError] = useState('')
    const [dupError, setDupError] = useState('')
    const [remoteError, setRemoteError] = useState('')

    // State Form Internal
    const [formData, setFormData] = useState({
        sumberLaporan: 'Internal', reporterName: '', jabatan: '', noWaPelapor: '',
        company: '', site: '', unit: '', picName: '', picWa: '',
        priority: '' as Priority | '', description: '',
        catatanInternal: ''
    })
    const [photos, setPhotos] = useState<File[]>([])
    const addPhotos = (incoming: File[]) => {
        setPhotos(prev => {
            const merged = [...prev, ...incoming];
            if (merged.length > MAX_PHOTOS) { toast.error(`Maksimal ${MAX_PHOTOS} foto.`); return prev; }
            const totalSize = merged.reduce((s, f) => s + f.size, 0);
            if (totalSize > MAX_TOTAL_SIZE_MB * 1024 * 1024) { toast.error(`Total ukuran foto maks ${MAX_TOTAL_SIZE_MB} MB.`); return prev; }
            return merged;
        });
    }
    // State Master Data (real, dari Supabase)
    const [mdCustomers, setMdCustomers] = useState<Customer[]>([])
    const [mdSites, setMdSites] = useState<SiteRow[]>([])
    const [mdUnits, setMdUnits] = useState<UnitRow[]>([])
    const [mdLoading, setMdLoading] = useState(true)

    // State Alur Buat Tiket Internal
    const [createStep, setCreateStep] = useState<'form' | 'review' | 'remote' | 'path' | 'void'>('form')
    const [submitting, setSubmitting] = useState(false)
    const [newVoidReason, setNewVoidReason] = useState('')
    const [newTicketId, setNewTicketId] = useState<string | null>(null)
    const [formErrors, setFormErrors] = useState<{ reporterName?: string; noWaPelapor?: string; site?: string; unit?: string; description?: string; priority?: string }>({})
    const [remoteCreateErrors, setRemoteCreateErrors] = useState<{ result?: string; duration?: string }>({})
    const [voidCreateError, setVoidCreateError] = useState('')

    useEffect(() => {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3')
        audio.volume = 0.5
        if (getTicketCount('NEW') > 0) audio.play().catch(() => { })
    }, [tickets, getTicketCount])

    useEffect(() => {
        let alive = true
        Promise.all([getCustomers(), getSites(), getUnits()]).then(([c, s, u]) => {
            if (!alive) return
            setMdCustomers(c)
            setMdSites(s)
            setMdUnits(u)
            setMdLoading(false)
        })
        return () => { alive = false }
    }, [])

    // FILTER & SORT LOGIC
    const activeSegmentStatuses = SEGMENTS.find(s => s.key === activeSegment)?.statuses || null
    const isActive = (t: Ticket) => !['VOID', 'DUPLICATE'].includes(t.status)
    const matchesPrioritySearch = (t: Ticket) =>
        (prioritySel['all'] || (t.priority !== undefined && !!prioritySel[t.priority])) &&
        (searchTerm === '' ||
            t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
            t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (t.site && t.site.toLowerCase().includes(searchTerm.toLowerCase())))
    const filteredTickets = tickets
        .filter(t => isActive(t) && (!activeSegmentStatuses || activeSegmentStatuses.includes(t.status)) && matchesPrioritySearch(t))
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    const kanbanTickets = tickets.filter(t => isActive(t) && matchesPrioritySearch(t))
    const liveTicket = selectedTicket ? (tickets.find(t => t.id === selectedTicket.id) ?? selectedTicket) : null

    // ---- HANDLER BUAT TIKET INTERNAL (Alur: Form → Review → Remote/Path/Void) ----
    const doAddTicket = async (initialStatus: TicketStatus, extraDetail?: string) => {
        if (submitting) return null
        setSubmitting(true)
        const catatan = [extraDetail, formData.catatanInternal].filter(Boolean).join('\n') || undefined
        const created = await addTicket({
            reporterName: formData.reporterName, company: 'Internal', site: formData.site, unit: formData.unit,
            priority: (formData.priority || undefined) as Priority | undefined,
            description: `Jabatan: ${formData.jabatan}\nWA Pelapor: ${formData.noWaPelapor}\n\n${formData.description}`,
            photoUrl: undefined, initialStatus,
            catatanInternal: catatan,
            photos
        })
        setSubmitting(false)
        return created
    }

    const validateForm = (): boolean => {
        const errs: { reporterName?: string; noWaPelapor?: string; site?: string; unit?: string; description?: string } = {}
        if (!formData.reporterName.trim()) errs.reporterName = 'Mohon isi Nama Pelapor'
        if (!/^(\+62|62|0)8\d{7,12}$/.test(formData.noWaPelapor.replace(/\s/g, ''))) errs.noWaPelapor = 'No WhatsApp tidak valid.'
        if (!formData.site) errs.site = 'Mohon pilih Site'
        if (!formData.unit) errs.unit = 'Mohon pilih Unit / Perangkat'
        if (!formData.description.trim()) errs.description = 'Mohon isi Deskripsi Kendala'
        setFormErrors(errs)
        return Object.keys(errs).length === 0
    }

    const requirePriority = () => {
        if (formData.priority) return true
        setFormErrors(prev => ({ ...prev, priority: 'Pilih prioritas untuk melanjutkan.' }))
        setCreateStep('form')
        return false
    }

    const handleValidateOpen = () => {
        if (!selectedTicket) return
        const wa = parseDescription(selectedTicket.description).waPelapor
        if (wa) {
            window.open(waMeLink(wa, `Kepada Yth ${selectedTicket.customer}, tiket ${selectedTicket.code} telah kami terima dan sedang diproses.`), '_blank')
        } else {
            toast.info('Nomor WA pelapor tidak tersedia.')
        }
        updateTicketStatus(selectedTicket.id, 'OPEN', 'Tiket divalidasi, konfirmasi via WA ke pelapor')
    }

    const closeCreateModal = () => {
        setIsModalOpen(false); setCreateStep('form'); setSubmitting(false); setNewVoidReason(''); setNewTicketId(null)
        setRemoteMedia('WA'); setRemoteNotes(''); setRemoteDuration(''); setRemoteResult('')
        setFormErrors({}); setRemoteCreateErrors({}); setVoidCreateError('')
        resetForm()
    }

    const handleSaveNew = async () => {
        if (!validateForm()) return
        if (await doAddTicket('NEW')) closeCreateModal()
    }

    const handleEskalasiClick = () => {
        if (!validateForm() || !requirePriority()) return
        setCreateStep('review')
    }

    const handleConfirmEskalasi = async () => {
        if (await doAddTicket('UNASSIGNED')) closeCreateModal()
    }

    const handleRemoteClick = () => {
        if (!validateForm() || !requirePriority()) return
        setRemoteMedia('WA'); setRemoteNotes(''); setRemoteDuration(''); setRemoteResult('')
        setCreateStep('remote')
    }

    const handleNewRemoteSubmit = async () => {
        const errs: { result?: string; duration?: string } = {}
        if (!remoteResult) errs.result = 'Mohon pilih hasil remote'
        if (!remoteDuration || Number(remoteDuration) <= 0) errs.duration = 'Mohon isi durasi (menit)'
        if (Object.keys(errs).length) { setRemoteCreateErrors(errs); return }
        setRemoteCreateErrors({})
        if (remoteResult === 'fail') {
            if (await doAddTicket('UNASSIGNED', `Remote Gagal via ${remoteMedia} (${remoteDuration} menit). Catatan: ${remoteNotes}`)) closeCreateModal()
        } else {
            const created = await doAddTicket('RESOLVED', `Remote Berhasil via ${remoteMedia} (${remoteDuration} menit).`)
            if (created) { setNewTicketId(created.id); setCreateStep('path') }
        }
    }

    const handleNewPathA = async () => {
        if (newTicketId) await updateTicketStatus(newTicketId, 'CLOSED', 'Dikonfirmasi pelanggan langsung. Tiket ditutup.')
        closeCreateModal()
    }

    const handleNewPathB = async () => {
        toast.success("Template WA terkirim ke pelanggan! (Simulasi: tiket akan auto-close dalam 24 jam jika tidak ada balasan)")
        if (newTicketId) await updateTicketStatus(newTicketId, 'CLOSED', 'Konfirmasi via WA terkirim. Auto-close flag aktif.')
        closeCreateModal()
    }

    const handleVoidClick = () => {
        if (!validateForm() || !requirePriority()) return
        setNewVoidReason('')
        setCreateStep('void')
    }

    const handleNewVoidSubmit = async () => {
        if (!newVoidReason.trim()) { setVoidCreateError('Mohon isi alasan pembatalan'); return }
        setVoidCreateError('')
        if (await doAddTicket('VOID', `Dibatalkan (VOID): ${newVoidReason}`)) closeCreateModal()
    }

    const resetForm = () => {
        setFormData({
            sumberLaporan: 'Internal', reporterName: '', jabatan: '', noWaPelapor: '',
            company: '', site: '', unit: '', picName: '', picWa: '',
            priority: '', description: '',
            catatanInternal: ''
        })
        setPhotos([])
    }

    const handleCompanyChange = (customerId: string) => {
        setFormData({ ...formData, company: customerId, site: '', unit: '', picName: '', picWa: '' })
    }

    const handleSiteChange = (siteName: string) => {
        const site = mdSites.find(s => s.name === siteName)
        setFormData({
            ...formData,
            site: siteName,
            unit: '',
            picName: site?.pic_name || '',
            picWa: site?.pic_phone || ''
        })
    }

    const selectedCompany = mdCustomers.find(c => c.id === formData.company)
    const customerSites = selectedCompany ? mdSites.filter(s => s.customer_id === selectedCompany.id) : []
    const selectedSite = mdSites.find(s => s.name === formData.site)
    const siteUnits = selectedSite ? mdUnits.filter(u => u.site_id === selectedSite.id) : []
    const companyOptions = mdCustomers.map(c => ({ value: c.id, label: c.name }))
    const siteOptions = customerSites.map(s => ({ value: s.name, label: s.name }))
    const unitOptions = siteUnits.map(u => ({ value: u.name, label: u.name }))

    const handleVoid = () => {
        if (!voidReason.trim()) { setVoidError('Mohon isi alasan pembatalan'); return }
        setVoidError('')
        if (voidTicketId) {
            updateTicketStatus(voidTicketId, 'VOID', voidReason)
            setVoidReason(''); setShowVoidModal(false); setVoidTicketId(null); setSelectedTicket(null)
        }
    }

    const handleDuplicate = () => {
        if (!duplicateTargetId) { setDupError('Mohon pilih tiket utama'); return }
        setDupError('')
        if (selectedTicket) {
            const targetTicket = tickets.find(t => t.id === duplicateTargetId)
            updateTicketStatus(selectedTicket.id, 'DUPLICATE', `Duplikat dari tiket ${targetTicket?.code || duplicateTargetId}`)
            setDuplicateTargetId(''); setShowDuplicateModal(false); setSelectedTicket(null)
        }
    }

    const handleRemoteSubmit = () => {
        if (!remoteResult) { setRemoteError('Mohon pilih hasil remote'); return }
        setRemoteError('')
        if (remoteResult === 'fail') {
            updateTicketStatus(selectedTicket!.id, 'UNASSIGNED', `Remote Gagal. Catatan: ${remoteNotes}`)
            setShowRemoteModal(false); setSelectedTicket(null)
        } else {
            updateTicketStatus(selectedTicket!.id, 'RESOLVED', `Remote Berhasil via ${remoteMedia}. Durasi: ${remoteDuration} menit.`)
            setShowConfirmPath(true)
        }
    }

    const handleConfirmPathA = () => {
        updateTicketStatus(selectedTicket!.id, 'CLOSED', 'Dikonfirmasi pelanggan langsung. Tiket ditutup.')
        setShowConfirmPath(false); setShowRemoteModal(false); setSelectedTicket(null)
    }

    const handleConfirmPathB = () => {
        toast.success("Template WA terkirim ke pelanggan! (Simulasi: Tiket akan auto-close dalam 24 jam jika tidak ada balasan)")
        updateTicketStatus(selectedTicket!.id, 'CLOSED', 'Konfirmasi via WA terkirim. Auto-close flag aktif.')
        setShowConfirmPath(false); setShowRemoteModal(false); setSelectedTicket(null)
    }

    const handleValidationSubmit = () => {
        if (validationAction === 'rework' && !reworkReason.trim()) {
            setReworkError('Mohon isi alasan rework'); return
        }
        setReworkError('')
        if (validationAction === 'close') {
            updateTicketStatus(selectedTicket!.id, 'CLOSED', 'Tiket divalidasi dan ditutup oleh Helpdesk.')
        } else {
            updateTicketStatus(selectedTicket!.id, 'WORKING', `Rework: ${reworkReason}`)
        }
        setShowValidationModal(false); setSelectedTicket(null)
    }

    return (
        <div className="space-y-6 flex flex-col h-[calc(100vh-7rem)]">
            {/* HEADER */}
            <div className="flex justify-end">
                <span className="bg-red-600 text-white px-3 py-1.5 rounded-sm text-sm font-medium border border-red-700 flex items-center gap-2">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {getTicketCount('NEW') + getTicketCount('RESOLVED')} Perlu Tindakan
                </span>
            </div>

            {/* BOX 1: Pencarian, Prioritas, Buat Tiket */}
            <div className="bg-card p-4 rounded-xl border border-border">
                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Cari kode, pelanggan, atau site..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border border-border rounded text-sm focus:ring-2 focus:ring-gray-400 outline-none" />
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
                            onToggle={v => setPrioritySel(prev => toggleFilter(prev, v, ['P1', 'P2', 'P3']))}
                            options={[
                                { value: 'P1', label: 'P1 (Kritis)' },
                                { value: 'P2', label: 'P2 (Medium)' },
                                { value: 'P3', label: 'P3 (Low)' },
                            ]}
                            className={selectTriggerFilter}
                        />
                    </div>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-primary-foreground hover:bg-foreground/90 rounded text-sm font-medium">
                        <Plus className="w-4 h-4" /> Buat Tiket Internal
                    </button>
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
            {view === 'kanban' ? (
                <div className="rounded-xl border border-border bg-card p-4 flex-1 min-h-0 flex flex-col">
                    <div className="flex gap-2 overflow-x-auto md:grid md:grid-cols-4 xl:grid-cols-7 flex-1 min-h-0">
                        {KANBAN_COLUMNS.map(col => {
                            const items = kanbanTickets.filter(t => col.statuses?.includes(t.status))
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
                                {filteredTickets.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
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

            {/* DRAWER DETAIL */}
            {liveTicket && (
                <TicketDrawer
                    onClose={() => setSelectedTicket(null)}
                    code={liveTicket.code}
                    status={liveTicket.status}
                    priority={liveTicket.priority}
                    slaTimeLeft={liveTicket.slaTimeLeft}
                    createdAt={liveTicket.createdAt}
                    activeTab={activeDrawerTab}
                    onTabChange={setActiveDrawerTab}
                    activities={liveTicket.activities}
                    footer={
                        <>
                            {liveTicket.status === 'NEW' && (
                                <>
                                    <button onClick={handleValidateOpen} className="w-full py-2.5 bg-foreground text-primary-foreground rounded-md font-bold">Validasi & Kirim WA</button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => { setVoidTicketId(liveTicket.id); setVoidError(''); setShowVoidModal(true); }} className="py-2.5 bg-transparent text-red-600 border border-border rounded-md font-medium hover:bg-red-50/60 transition">Batal</button>
                                        <button onClick={() => { setDupError(''); setShowDuplicateModal(true); }} className="py-2.5 bg-transparent text-amber-600 border border-border rounded-md font-medium hover:bg-amber-50/60 transition">Gabung</button>
                                    </div>
                                </>
                            )}
                            {liveTicket.status === 'OPEN' && !liveTicket.priority && (
                                <div className="space-y-2">
                                    <p className="text-xs font-semibold text-muted-foreground">Pilih prioritas untuk melanjutkan:</p>
                                    <div className="grid grid-cols-3 gap-3">
                                        {(['P1', 'P2', 'P3'] as const).map(p => (
                                            <button key={p} onClick={() => updateTicketStatus(liveTicket.id, 'OPEN', `Prioritas ditetapkan: ${p}`, p)} className={`py-2.5 rounded-md border font-bold transition ${p === 'P1' ? 'bg-red-600 text-white border-red-600' : p === 'P2' ? 'bg-amber-500 text-white border-amber-500' : 'bg-blue-600 text-white border-blue-600'}`}>{p}</button>
                                        ))}
                                    </div>
                                </div>
                            )}
                            {liveTicket.status === 'OPEN' && liveTicket.priority && (
                                <>
                                    <button onClick={() => { setRemoteError(''); setShowRemoteModal(true); }} className="w-full flex items-center justify-center gap-2 py-2.5 bg-foreground text-primary-foreground rounded-md font-bold">Remote Support</button>
                                    <button onClick={() => { updateTicketStatus(liveTicket.id, 'UNASSIGNED'); setSelectedTicket(null); }} className="w-full py-2.5 bg-transparent text-foreground border border-border rounded-md font-medium hover:bg-muted transition">Eskalasi ke PM</button>
                                </>
                            )}
                            {liveTicket.status === 'RESOLVED' && (
                                <>
                                    <button onClick={() => { updateTicketStatus(liveTicket.id, 'CLOSED', 'Tiket divalidasi dan ditutup oleh Helpdesk.'); setSelectedTicket(null); }} className="w-full py-2.5 bg-emerald-600 text-white rounded-md font-bold hover:bg-emerald-700 transition">Validasi & Tutup</button>
                                    <button onClick={() => { setValidationAction('rework'); setReworkReason(''); setReworkError(''); setShowValidationModal(true); }} className="w-full py-2.5 bg-red-600 text-white rounded-md font-medium hover:bg-red-700 transition">Kembalikan / Rework</button>
                                </>
                            )}
                            {(['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE', 'WORKING', 'PENDING', 'CLOSED', 'VOID', 'DUPLICATE'] as string[]).includes(liveTicket.status) && (
                                <p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>
                            )}
                        </>
                    }
                >
                    {activeDrawerTab === 'detail' && (
                        <div className="space-y-4">
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
                    {activeDrawerTab === 'timeline' && <TicketTimeline items={liveTicket.activities} />}
                    {activeDrawerTab === 'activity' && <TicketActivityLog items={liveTicket.activities} />}
                </TicketDrawer>
            )}

            {/* MODAL VOID, DUPLICATE, REMOTE, VALIDASI (Sama seperti sebelumnya) */}
            {showVoidModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4 text-red-600">VOID Tiket (Permanen)</h3>
                        <textarea value={voidReason} onChange={e => { setVoidReason(e.target.value); setVoidError('') }} placeholder="Alasan wajib..." rows={3} className={`w-full px-3 py-2 border-2 ${voidError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded`}></textarea>
                        <FieldError msg={voidError} />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => { setShowVoidModal(false); setVoidError('') }} className="flex-1 py-2 bg-muted rounded">Batal</button>
                            <button onClick={handleVoid} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Ya, VOID</button>
                        </div>
                    </div>
                </div>
            ), document.body)}
            {showDuplicateModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4 text-amber-600">Tandai Duplikat</h3>
                        <Select value={duplicateTargetId} onValueChange={(v) => { setDuplicateTargetId(v); setDupError('') }}>
                            <SelectTrigger className={`w-full px-3 py-2 border-2 ${dupError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded`}><SelectValue placeholder="Pilih Tiket Utama..." /></SelectTrigger>
                            <SelectContent className="z-[130] border-border bg-card text-foreground">
                                {tickets.filter(t => t.id !== selectedTicket?.id && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).map(t => (
                                    <SelectItem key={t.id} value={t.id} className="focus:bg-foreground focus:text-background">{t.code} - {t.customer}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                        <FieldError msg={dupError} />
                        <div className="flex gap-3 mt-4">
                            <button onClick={() => { setShowDuplicateModal(false); setDupError('') }} className="flex-1 py-2 bg-muted rounded">Batal</button>
                            <button onClick={handleDuplicate} className="flex-1 py-2 bg-amber-600 text-white rounded font-bold">Tandai</button>
                        </div>
                    </div>
                </div>
            ), document.body)}
            {showRemoteModal && !showConfirmPath && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4">Remote Support</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-muted-foreground">Media</label><div className="flex gap-2 mt-1">{['WA', 'Telepon', 'VC'].map(m => (<button key={m} onClick={() => setRemoteMedia(m)} className={`flex-1 py-2 rounded border text-sm ${remoteMedia === m ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-card border-border'}`}>{m}</button>))}</div></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Durasi (Menit)</label><input type="number" value={remoteDuration} onChange={e => setRemoteDuration(e.target.value)} className="w-full mt-1 px-3 py-2 border-2 border-border rounded" /></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Catatan</label><textarea value={remoteNotes} onChange={e => setRemoteNotes(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border-2 border-border rounded"></textarea></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Hasil</label><div className="grid grid-cols-2 gap-2 mt-1"><button onClick={() => { setRemoteResult('success'); setRemoteError('') }} className={`py-2 rounded border text-sm ${remoteResult === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-card border-border'}`}>Berhasil</button><button onClick={() => { setRemoteResult('fail'); setRemoteError('') }} className={`py-2 rounded border text-sm ${remoteResult === 'fail' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-card border-border'}`}>Gagal</button></div><FieldError msg={remoteError} /></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowRemoteModal(false); setRemoteError('') }} className="flex-1 py-2 bg-muted rounded">Batal</button><button onClick={handleRemoteSubmit} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Simpan</button></div>
                        </div>
                    </div>
                </div>
            ), document.body)}
            {showConfirmPath && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-2">Remote Berhasil! Pilih Jalur:</h3>
                        <div className="space-y-3 mt-4">
                            <button onClick={handleConfirmPathA} className="w-full p-4 text-left border-2 border-border rounded hover:border-foreground"><p className="font-bold text-foreground">Jalur A: Konfirmasi Langsung</p><p className="text-xs text-muted-foreground">Pelanggan sudah konfirmasi. Langsung tutup.</p></button>
                            <button onClick={handleConfirmPathB} className="w-full p-4 text-left border-2 border-border rounded hover:border-blue-500"><p className="font-bold text-foreground">Jalur B: Kirim WA</p><p className="text-xs text-muted-foreground">Kirim template WA. Auto-close 24 jam.</p></button>
                        </div>
                        <button onClick={() => setShowConfirmPath(false)} className="w-full mt-4 py-2 text-sm text-muted-foreground">Batal</button>
                    </div>
                </div>
            ), document.body)}
            {showValidationModal && createPortal((
                <div className="fixed inset-0 bg-black/80 z-[120] flex items-center justify-center p-4 fade-in">
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4">Validasi Penyelesaian</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2"><button onClick={() => setValidationAction('close')} className={`py-3 rounded border font-medium ${validationAction === 'close' ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-card border-border'}`}>Close Ticket</button><button onClick={() => setValidationAction('rework')} className={`py-3 rounded border font-medium ${validationAction === 'rework' ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-card border-border'}`}>Return Rework</button></div>
                            {validationAction === 'rework' && <div><label className="text-xs font-semibold text-muted-foreground">Alasan Rework</label><textarea value={reworkReason} onChange={e => { setReworkReason(e.target.value); setReworkError('') }} rows={2} className={`w-full mt-1 px-3 py-2 border-2 ${reworkError ? 'border-red-500 focus:border-red-500' : 'border-border focus:border-foreground'} rounded`}></textarea><FieldError msg={reworkError} /></div>}
                            <div className="flex gap-3 pt-2"><button onClick={() => { setShowValidationModal(false); setReworkError('') }} className="flex-1 py-2 bg-muted rounded">Batal</button><button onClick={handleValidationSubmit} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Proses</button></div>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {/* ========================================== */}
            {/* MODAL BUAT TIKET INTERNAL (ALUR 5 LANGKAH) */}
            {/* ========================================== */}
            {isModalOpen && createPortal((
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 fade-in" onClick={closeCreateModal}>
                    <div className="relative bg-card w-full max-w-2xl rounded-2xl border border-border shadow-2xl flex flex-col max-h-[90vh] overflow-hidden fade-in" onClick={(e) => e.stopPropagation()}>
                        <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-foreground/40 to-transparent" />
                        <div className="pointer-events-none absolute -top-20 -right-20 w-56 h-56 rounded-full bg-blue-500/10 blur-3xl" />
                        <div className="relative z-10 px-5 py-4 border-b border-border bg-card/90 backdrop-blur-xl flex justify-between items-center">
                            <div>
                                <h3 className="text-xl font-bold text-foreground font-display tracking-tight">Buat Tiket Internal</h3>
                                <p className="text-xs text-muted-foreground mt-0.5">
                                    {createStep === 'form' && 'Lengkapi data keluhan di bawah, lalu pilih tindakan.'}
                                    {createStep === 'review' && 'Koreksi terakhir sebelum data dieskalasi (BR-12J).'}
                                    {createStep === 'remote' && 'Catat detail sesi remote support.'}
                                    {createStep === 'path' && 'Remote berhasil. Pilih jalur konfirmasi.'}
                                    {createStep === 'void' && 'Berikan alasan pembatalan.'}
                                </p>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center px-2 py-1 rounded-md bg-muted text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
                                    {createStep === 'form' ? 'Mode · Data' : createStep === 'review' ? 'Mode · Eskalasi' : createStep === 'remote' ? 'Mode · Remote' : createStep === 'path' ? 'Mode · Jalur' : 'Mode · Void'}
                                </span>
                                <button onClick={closeCreateModal} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                            </div>
                        </div>

                        {createStep === 'form' && (
                            <>
                                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                    <section className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground"><User className="w-3.5 h-3.5" /> Pelapor</h4>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Sumber Laporan</label>
                                                <Select value={formData.sumberLaporan} onValueChange={v => setFormData({ ...formData, sumberLaporan: v })}>
                                                    <SelectTrigger className={inputCls}><SelectValue /></SelectTrigger>
                                                    <SelectContent className="z-[130] border-border bg-card text-foreground">
                                                        {['WhatsApp', 'Telepon', 'Email', 'Monitoring', 'Internal', 'Lainnya'].map(o => <SelectItem key={o} value={o} className="focus:bg-foreground focus:text-background">{o}</SelectItem>)}
                                                    </SelectContent>
                                                </Select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nama Pelapor</label>
                                                <input type="text" value={formData.reporterName} onChange={e => { setFormData({ ...formData, reporterName: e.target.value }); setFormErrors(prev => ({ ...prev, reporterName: undefined })) }} className={`${inputCls} ${formErrors.reporterName ? 'border-red-500' : ''}`} />
                                                <FieldError msg={formErrors.reporterName} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Jabatan</label>
                                                <input type="text" value={formData.jabatan} onChange={e => setFormData({ ...formData, jabatan: e.target.value })} className={inputCls} />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">No WhatsApp Pelapor</label>
                                            <input type="text" value={formData.noWaPelapor} onChange={e => { setFormData({ ...formData, noWaPelapor: e.target.value }); setFormErrors(prev => ({ ...prev, noWaPelapor: undefined })) }} className={`${inputCls} ${formErrors.noWaPelapor ? 'border-red-500' : ''}`} placeholder="" />
                                            <FieldError msg={formErrors.noWaPelapor} />
                                        </div>
                                    </section>
                                    <section className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground"><MapPin className="w-3.5 h-3.5" /> Lokasi Kerja</h4>
                                        {!mdLoading && mdSites.length === 0 && (
                                            <div className="flex items-start gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                                                <AlertTriangle className="h-4 w-4 shrink-0" />
                                                <span>Belum ada Site terdaftar. Lengkapi Master Data (Admin) terlebih dahulu.</span>
                                            </div>
                                        )}
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Perusahaan</label>
                                                <Combobox
                                                    options={companyOptions}
                                                    value={formData.company}
                                                    onChange={(v) => { handleCompanyChange(v); setFormErrors(prev => ({ ...prev, site: undefined, unit: undefined })) }}
                                                    placeholder="Pilih Perusahaan..."
                                                    disabled={mdLoading || mdCustomers.length === 0}
                                                    emptyText="Belum ada Perusahaan terdaftar"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Site</label>
                                                <Combobox
                                                    options={siteOptions}
                                                    value={formData.site}
                                                    onChange={(v) => { handleSiteChange(v); setFormErrors(prev => ({ ...prev, site: undefined, unit: undefined })) }}
                                                    placeholder="Pilih Site..."
                                                    disabled={mdLoading || mdSites.length === 0 || !formData.company}
                                                    emptyText="Belum ada Site untuk perusahaan ini"
                                                />
                                                <FieldError msg={formErrors.site} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Unit / Perangkat</label>
                                                <Combobox
                                                    options={unitOptions}
                                                    value={formData.unit}
                                                    onChange={u => { setFormData({ ...formData, unit: u }); setFormErrors(prev => ({ ...prev, unit: undefined })) }}
                                                    placeholder="Pilih Unit..."
                                                    disabled={!formData.site}
                                                    emptyText="Belum ada unit di site ini"
                                                />
                                                <FieldError msg={formErrors.unit} />
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Nama PIC</label>
                                                <input type="text" value={formData.picName} readOnly placeholder="Terisi otomatis saat Site dipilih" className={readOnlyInputCls} />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">No WA PIC</label>
                                                <input type="text" value={formData.picWa} readOnly placeholder="Terisi otomatis saat Site dipilih" className={readOnlyInputCls} />
                                            </div>
                                        </div>
                                        <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Auto-fill dari Master Data Site yang dipilih
                                        </p>
                                    </section>
                                    <section className="rounded-xl border border-border bg-muted/40 p-4 space-y-4">
                                        <h4 className="flex items-center gap-2 text-[10px] font-mono font-semibold uppercase tracking-widest text-muted-foreground"><FileText className="w-3.5 h-3.5" /> Keluhan</h4>
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Prioritas</label>
                                            <div className="grid grid-cols-3 gap-2">
                                                {([['P1', 'Kritis', 'bg-red-600 border-red-600', 'bg-red-600'],
                                                    ['P2', 'Medium', 'bg-amber-500 border-amber-500', 'bg-amber-500'],
                                                    ['P3', 'Low', 'bg-blue-600 border-blue-600', 'bg-blue-600']] as const).map(([v, sub, active, dot]) => {
                                                    const on = formData.priority === v
                                                    return (
                                                        <button key={v} onClick={() => { setFormData({ ...formData, priority: v }); setFormErrors(prev => ({ ...prev, priority: undefined })) }}
                                                            className={`flex items-center justify-center gap-2 py-2.5 rounded-lg border text-sm font-semibold transition ${on ? `text-white shadow-sm ${active}` : 'bg-card border-border text-muted-foreground hover:border-foreground/50 hover:text-foreground'}`}>
                                                            <span className={`w-1.5 h-1.5 rounded-full ${on ? 'bg-white' : dot}`} />
                                                            {v} · {sub}
                                                        </button>
                                                    )
                                                })}
                                            </div>
                                            {formErrors.priority ? (
                                                <FieldError msg={formErrors.priority} />
                                            ) : (
                                                <p className="text-[10px] text-muted-foreground mt-1">Wajib dipilih jika akan Eskalasi / Remote / Void. Simpan sebagai NEW dapat tanpa prioritas.</p>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Upload Foto ({photos.length}/{MAX_PHOTOS})</label>
                                            <label
                                                htmlFor="upload-photo-input"
                                                onDragOver={(e) => e.preventDefault()}
                                                onDrop={(e) => { e.preventDefault(); addPhotos(Array.from(e.dataTransfer.files)) }}
                                                className="group flex flex-col items-center gap-1.5 rounded-xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground hover:border-foreground/50 hover:bg-muted/40 hover:text-foreground transition cursor-pointer"
                                            >
                                                <span className="inline-flex p-2.5 rounded-full bg-muted group-hover:bg-accent transition"><ImagePlus className="w-5 h-5" /></span>
                                                <span>Tarik & lepas foto di sini, atau klik untuk memilih</span>
                                                <input id="upload-photo-input" type="file" accept="image/*" multiple className="sr-only" onChange={(e) => { addPhotos(Array.from(e.target.files || [])); e.target.value = '' }} />
                                            </label>
                                            {photos.length > 0 && (
                                                <div className="mt-2.5 flex flex-wrap gap-2">
                                                    {photos.map((p, i) => (
                                                        <span key={i} className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-muted border border-border rounded-full text-[10px] font-mono text-muted-foreground">
                                                            {p.name}
                                                            <button type="button" onClick={() => setPhotos(photos.filter((_, idx) => idx !== i))} className="p-0.5 rounded-full text-red-500 hover:text-red-700 hover:bg-red-500/10"><X className="w-3 h-3" /></button>
                                                        </span>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Deskripsi Kendala</label>
                                            <textarea value={formData.description} onChange={e => { setFormData({ ...formData, description: e.target.value }); setFormErrors(prev => ({ ...prev, description: undefined })) }} maxLength={2000} rows={3} className={`input resize-none ${formErrors.description ? 'border-red-500' : ''}`}></textarea>
                                            <FieldError msg={formErrors.description} />
                                            <p className="mt-1.5 text-right"><span className="inline-flex px-1.5 py-0.5 rounded-md bg-muted text-[10px] font-mono text-muted-foreground">{formData.description.length}/2000</span></p>
                                        </div>
                                        <div>
                                            <label className="flex items-center gap-1.5 text-xs font-semibold text-amber-800 mb-1.5">
                                                <Info className="w-3.5 h-3.5" /> Catatan Internal (Hanya Helpdesk/PM/Admin)
                                            </label>
                                            <textarea value={formData.catatanInternal} onChange={e => setFormData({ ...formData, catatanInternal: e.target.value })} rows={2} className="w-full px-3 py-2.5 bg-white/70 border border-amber-300 rounded-lg text-sm text-foreground outline-none transition focus:border-amber-500 focus:ring-2 focus:ring-amber-500/10 resize-none" />
                                        </div>
                                    </section>
                                </div>

                                <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur-xl rounded-b-2xl">
                                    <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-3">Tindakan</p>
                                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                        <button onClick={handleSaveNew} disabled={submitting} className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-border bg-card hover:border-foreground/50 hover:shadow-sm transition-colors group disabled:opacity-50">
                                            <span className="inline-flex p-2 rounded-full bg-muted group-hover:bg-accent transition"><CheckCircle2 className="w-4 h-4 text-muted-foreground group-hover:text-foreground" /></span>
                                            <span className="text-xs font-bold text-muted-foreground group-hover:text-foreground">Simpan Baru</span>
                                        </button>
                                        <button onClick={handleEskalasiClick} disabled={submitting} className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-blue-200 bg-card hover:border-blue-400 hover:shadow-sm hover:bg-blue-50/40 transition-colors group disabled:opacity-50">
                                            <span className="inline-flex p-2 rounded-full bg-blue-50 group-hover:bg-blue-100 transition"><Send className="w-4 h-4 text-blue-600" /></span>
                                            <span className="text-xs font-bold text-blue-700">Eskalasi PM</span>
                                        </button>
                                        <button onClick={handleRemoteClick} disabled={submitting} className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-emerald-200 bg-card hover:border-emerald-400 hover:shadow-sm hover:bg-emerald-50/40 transition-colors group disabled:opacity-50">
                                            <span className="inline-flex p-2 rounded-full bg-emerald-50 group-hover:bg-emerald-100 transition"><Headset className="w-4 h-4 text-emerald-600" /></span>
                                            <span className="text-xs font-bold text-emerald-700">Selesai Remote</span>
                                        </button>
                                        <button onClick={handleVoidClick} disabled={submitting} className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-xl border border-red-200 bg-card hover:border-red-400 hover:shadow-sm hover:bg-red-50/40 transition-colors group disabled:opacity-50">
                                            <span className="inline-flex p-2 rounded-full bg-red-50 group-hover:bg-red-100 transition"><AlertTriangle className="w-4 h-4 text-red-600" /></span>
                                            <span className="text-xs font-bold text-red-700">Dibatalkan</span>
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {createStep === 'review' && (
                            <>
                                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                                    {[
                                        ['Pelapor', formData.reporterName],
                                        ['No WhatsApp', formData.noWaPelapor],
                                        ['Perusahaan', selectedCompany?.name || formData.company || '—'],
                                        ['Site / Unit', `${formData.site} - ${formData.unit}`],
                                        ['Prioritas', formData.priority],
                                        ['Deskripsi', formData.description],
                                    ].map(([label, value]) => (
                                        <div key={label} className="rounded-xl border border-border bg-muted/40 p-4">
                                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
                                            <p className={`text-sm font-medium ${label === 'Deskripsi' ? 'whitespace-pre-wrap' : ''}`}>{value}</p>
                                        </div>
                                    ))}
                                </div>
                                <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur-xl rounded-b-2xl">
                                    <p className="text-[10px] font-mono font-semibold text-muted-foreground uppercase tracking-widest mb-3">Koreksi terakhir sebelum data keluar</p>
                                    <div className="flex gap-3">
                                        <button onClick={() => setCreateStep('form')} className="flex-1 py-2.5 bg-card border border-border rounded-lg text-sm font-semibold hover:border-foreground/50 transition-colors">Edit Dulu</button>
                                        <button onClick={handleConfirmEskalasi} disabled={submitting} className="flex-1 py-2.5 bg-blue-600 text-white border border-blue-700 rounded-lg text-sm font-semibold hover:bg-blue-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                                            <Send className="w-4 h-4" /> Ya, Eskalasi
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}

                        {createStep === 'remote' && (
                            <>
                                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Media</label>
                                        <div className="flex gap-2">{['WA', 'Telepon', 'VC'].map(m => (<button key={m} onClick={() => setRemoteMedia(m)} className={`flex-1 py-2 rounded-lg border text-sm font-semibold transition ${remoteMedia === m ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-card border-border hover:border-foreground/50'}`}>{m}</button>))}</div>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Durasi (Menit)</label>
                                        <input type="number" min="1" value={remoteDuration} onChange={e => { setRemoteDuration(e.target.value); setRemoteCreateErrors(prev => ({ ...prev, duration: undefined })) }} className={`${inputCls} ${remoteCreateErrors.duration ? 'border-red-500' : ''}`} />
                                        <FieldError msg={remoteCreateErrors.duration} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Catatan Remote</label>
                                        <textarea value={remoteNotes} onChange={e => setRemoteNotes(e.target.value)} rows={3} className="input resize-none"></textarea>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Hasil</label>
                                        <div className="grid grid-cols-2 gap-2">
                                            <button onClick={() => { setRemoteResult('success'); setRemoteCreateErrors(prev => ({ ...prev, result: undefined })) }} className={`py-2.5 rounded-lg border text-sm font-semibold transition ${remoteResult === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-card border-border hover:border-emerald-400'}`}>Berhasil</button>
                                            <button onClick={() => { setRemoteResult('fail'); setRemoteCreateErrors(prev => ({ ...prev, result: undefined })) }} className={`py-2.5 rounded-lg border text-sm font-semibold transition ${remoteResult === 'fail' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-card border-border hover:border-red-400'}`}>Gagal</button>
                                        </div>
                                        <FieldError msg={remoteCreateErrors.result} />
                                        <p className="text-[10px] text-muted-foreground mt-1.5">Berhasil → tiket RESOLVED lalu pilih jalur. Gagal → tiket ditugaskan ke PM.</p>
                                    </div>
                                </div>
                                <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur-xl rounded-b-2xl flex gap-3">
                                    <button onClick={() => setCreateStep('form')} className="flex-1 py-2.5 bg-card border border-border rounded-lg text-sm font-semibold hover:border-foreground/50 transition-colors">Batal</button>
                                    <button onClick={handleNewRemoteSubmit} disabled={submitting} className="flex-1 py-2.5 bg-emerald-600 text-white border border-emerald-700 rounded-lg text-sm font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50">Simpan Remote</button>
                                </div>
                            </>
                        )}

                        {createStep === 'path' && (
                            <>
                                <div className="p-5 space-y-3 overflow-y-auto flex-1">
                                    <button onClick={handleNewPathA} className="w-full p-4 text-left rounded-xl border border-emerald-200 bg-card hover:border-emerald-400 hover:bg-emerald-50/40 transition-colors">
                                        <p className="font-bold text-foreground flex items-center gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-600" /> Jalur A: Konfirmasi Langsung</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Pelanggan sudah konfirmasi. Langsung tutup tiket.</p>
                                    </button>
                                    <button onClick={handleNewPathB} className="w-full p-4 text-left rounded-xl border border-blue-200 bg-card hover:border-blue-400 hover:bg-blue-50/40 transition-colors">
                                        <p className="font-bold text-foreground flex items-center gap-2"><Send className="w-4 h-4 text-blue-600" /> Jalur B: Kirim WA</p>
                                        <p className="text-xs text-muted-foreground mt-0.5">Kirim template WA. Auto-close 24 jam jika tidak ada balasan.</p>
                                    </button>
                                </div>
                                <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur-xl rounded-b-2xl">
                                    <button onClick={() => setCreateStep('remote')} className="w-full py-2.5 bg-card border border-border rounded-lg text-sm font-semibold hover:border-foreground/50 transition-colors">Kembali</button>
                                </div>
                            </>
                        )}

                        {createStep === 'void' && (
                            <>
                                <div className="p-5 space-y-4 overflow-y-auto flex-1">
                                    <div className="flex items-start gap-2.5 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
                                        <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" />
                                        <span>Tiket akan dibatalkan (VOID) dan menjadi final permanen. Tidak dapat diubah kembali.</span>
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Alasan Pembatalan</label>
                                        <textarea value={newVoidReason} onChange={e => { setNewVoidReason(e.target.value); setVoidCreateError('') }} rows={3} className={`w-full px-3 py-2.5 bg-background border rounded-lg text-sm outline-none transition focus:ring-2 resize-none ${voidCreateError ? 'border-red-500 focus:border-red-500 focus:ring-red-500/10' : 'border-red-300 focus:border-red-500 focus:ring-red-500/10'}`} placeholder="Contoh: Pelapor mengirim laporan ganda..." />
                                        <FieldError msg={voidCreateError} />
                                    </div>
                                </div>
                                <div className="px-5 py-4 border-t border-border bg-card/90 backdrop-blur-xl rounded-b-2xl flex gap-3">
                                    <button onClick={() => setCreateStep('form')} className="flex-1 py-2.5 bg-card border border-border rounded-lg text-sm font-semibold hover:border-foreground/50 transition-colors">Batal</button>
                                    <button onClick={handleNewVoidSubmit} disabled={submitting} className="flex-1 py-2.5 bg-red-600 text-white border border-red-700 rounded-lg text-sm font-semibold hover:bg-red-700 flex items-center justify-center gap-2 transition-colors disabled:opacity-50">
                                        <AlertTriangle className="w-4 h-4" /> Ya, Dibatalkan
                                    </button>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            ), document.body)}
        </div>
    )
}