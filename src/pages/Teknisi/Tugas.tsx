import { useState, useMemo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useTickets, type Ticket, type TicketStatus } from '../../context/TicketContext'
import { GooeyFilter } from './GooeyFilter'
import {
    X, MapPin, Camera, ChevronRight,
    Clock, CheckCircle2, PauseCircle, PlayCircle,
    ClipboardList, Wrench, Archive
} from 'lucide-react'
import { Badge } from '../../components/Badge'

type TabType = 'detail' | 'timeline' | 'activity'

const STATUS_LABELS: Record<string, string> = {
    SCHEDULED: 'Dijadwalkan', EN_ROUTE: 'Dalam Perjalanan',
    WORKING: 'Sedang Dikerjakan', PENDING: 'Ditunda',
    RESOLVED: 'Menunggu Validasi',
}

const TABS = [
    { key: 'masuk', icon: ClipboardList, label: 'Masuk', color: 'text-black', bg: 'bg-muted', statuses: ['SCHEDULED', 'EN_ROUTE'] },
    { key: 'dikerjakan', icon: Wrench, label: 'Dikerjakan', color: 'text-black', bg: 'bg-muted', statuses: ['WORKING'] },
    { key: 'pending', icon: Clock, label: 'Pending', color: 'text-black', bg: 'bg-muted', statuses: ['PENDING'] },
    { key: 'selesai', icon: Archive, label: 'Selesai', color: 'text-emerald-600', bg: 'bg-emerald-50', statuses: ['RESOLVED'] },
]

export default function TugasTeknisi() {
    const { user } = useAuth()
    const { tickets, updateTicketStatus } = useTickets()
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null)
    const [activeDrawerTab, setActiveDrawerTab] = useState<TabType>('detail')
    const [activeSection, setActiveSection] = useState('masuk')

    const [showPendingModal, setShowPendingModal] = useState(false)
    const [pendingReason, setPendingReason] = useState('')
    const [showCompleteModal, setShowCompleteModal] = useState(false)
    const [completeNote, setCompleteNote] = useState('')
    const [sparepart, setSparepart] = useState('')
    const [photos, setPhotos] = useState<File[]>([])
    const [gpsError, setGpsError] = useState('')
    const [isLoading, setIsLoading] = useState<string | null>(null)

    const myTickets = useMemo(() =>
        tickets.filter(t => t.assignedTo === user?.id && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)),
        [tickets, user?.id]
    )

    const grouped = useMemo(() => {
        const byStatus: Record<string, Ticket[]> = {}
        for (const s of ['SCHEDULED', 'EN_ROUTE', 'WORKING', 'PENDING', 'RESOLVED']) byStatus[s] = []
        for (const t of myTickets) {
            if (byStatus[t.status]) byStatus[t.status].push(t)
        }
        for (const s of Object.keys(byStatus)) {
            byStatus[s].sort((a, b) => {
                const pa = a.priority === 'P1' ? 0 : a.priority === 'P2' ? 1 : 2
                const pb = b.priority === 'P1' ? 0 : b.priority === 'P2' ? 1 : 2
                return pa - pb
            })
        }
        return byStatus
    }, [myTickets])

    const statusActions: Record<string, { label: string; action: (t: Ticket) => void; color: string } | null> = {
        SCHEDULED: { label: 'Terima Tugas', action: (t) => handleStatusUpdate(t.id, 'EN_ROUTE', 'Tugas diterima'), color: 'bg-blue-600 hover:bg-blue-700' },
        EN_ROUTE: { label: 'Mulai Kerja', action: (t) => handleMulaiKerja(t), color: 'bg-emerald-600 hover:bg-emerald-700' },
        WORKING: null,
        PENDING: { label: 'Lanjutkan', action: (t) => handleStatusUpdate(t.id, 'WORKING', 'Pekerjaan dilanjutkan'), color: 'bg-foreground hover:bg-foreground/90' },
        RESOLVED: null,
    }

    const handleStatusUpdate = async (id: string, status: string, note: string) => {
        setIsLoading(id)
        await updateTicketStatus(id, status as TicketStatus, note)
        setIsLoading(null)
        setSelectedTicket(null)
    }

    const handleMulaiKerja = (ticket: Ticket) => {
        if (!navigator.geolocation) {
            setGpsError('GPS tidak didukung browser ini.')
            return
        }
        setGpsError('')
        setIsLoading('gps')
        navigator.geolocation.getCurrentPosition(
            () => {
                setGpsError('')
                setIsLoading(null)
                handleStatusUpdate(ticket.id, 'WORKING', 'Pekerjaan dimulai — lokasi terverifikasi')
            },
            () => {
                setGpsError('Lokasi gagal ditangkap. Aktifkan GPS dan coba lagi.')
                setIsLoading(null)
            },
            { enableHighAccuracy: true, timeout: 10000 }
        )
    }

    const handlePending = () => {
        if (!pendingReason.trim() || !selectedTicket) return
        handleStatusUpdate(selectedTicket.id, 'PENDING', `Ditunda: ${pendingReason}`)
        setPendingReason('')
        setShowPendingModal(false)
    }

    const handleComplete = () => {
        if (!selectedTicket) return
        handleStatusUpdate(selectedTicket.id, 'RESOLVED', `Selesai${completeNote ? ': ' + completeNote : ''}${sparepart ? ' | Sparepart: ' + sparepart : ''}`)
        setCompleteNote('')
        setSparepart('')
        setPhotos([])
        setShowCompleteModal(false)
    }

    const formatDate = (dateStr: string) => {
        const d = new Date(dateStr)
        return `${d.getDate()} ${d.toLocaleString('id-ID', { month: 'short' })} ${d.getFullYear()}, ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
    }

    const renderCard = (ticket: Ticket) => {
        const act = statusActions[ticket.status]
        const isP1 = ticket.priority === 'P1'
        const isOvertime = ticket.status === 'SCHEDULED' && (new Date().getHours() < 8 || new Date().getHours() >= 17)

        return (
            <div key={ticket.id}
                className={`bg-card border-2 rounded-xl p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${isP1 ? 'border-red-200 hover:border-red-300 pulse-ring' : 'border-border hover:border-border'}`}
                onClick={() => { setSelectedTicket(ticket); setActiveDrawerTab('detail') }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-sm font-bold text-foreground">{ticket.code}</span>
                            {ticket.priority && (
                                            <Badge type="priority" value={ticket.priority} />
                            )}
                        </div>
                        <p className="text-xs text-muted-foreground truncate">{ticket.site}{ticket.unit ? ` — ${ticket.unit}` : ''}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">Status: <span className="font-medium">{STATUS_LABELS[ticket.status] || ticket.status}</span></p>
                        {isOvertime && (
                            <span className="inline-flex items-center gap-1 mt-1 text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                <Clock className="w-3 h-3" /> Berpotensi Lembur
                            </span>
                        )}
                    </div>
                    <div className="flex flex-col items-end gap-2 flex-shrink-0">
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        {act && (
                            <button onClick={(e) => { e.stopPropagation(); act.action(ticket) }}
                                disabled={isLoading === ticket.id || isLoading === 'gps'}
                                className={`px-3 py-1.5 rounded-lg text-xs font-bold text-white transition-all ${act.color} disabled:opacity-50 disabled:cursor-wait`}>
                                {isLoading === ticket.id ? 'Memproses...' : isLoading === 'gps' && act.label === 'Mulai Kerja' ? 'Mengambil GPS...' : act.label}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const totalTickets = myTickets.length

    return (
        <div className="p-4 sm:p-6 space-y-6 max-w-3xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground">Tugas Saya</h2>
                    <p className="text-sm text-muted-foreground">{formatDate(new Date().toISOString())}</p>
                </div>
                <span className="bg-foreground text-primary-foreground rounded-full text-sm font-medium border border-foreground">
                    {totalTickets} tugas
                </span>
            </div>

            {gpsError && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                    <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{gpsError}</p>
                    <button onClick={() => setGpsError('')} className="ml-auto"><X className="w-4 h-4 text-red-400" /></button>
                </div>
            )}

            {totalTickets === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Tidak ada tugas saat ini</p>
                    <p className="text-sm">Tiket yang di-assign ke Anda akan muncul di sini.</p>
                </div>
            ) : (
                <>
                    <GooeyFilter id="gooey-filter" strength={15} />

                    <div className="relative bg-transparent rounded-xl overflow-hidden">
                        {/* Layer 1 (kena filter) */}
                        <div style={{ filter: 'url(#gooey-filter)' }}>
                            {/* Tab background */}
                            <div className="flex w-full">
                                {TABS.map(tab => {
                                    const isActive = activeSection === tab.key
                                    return (
                                        <div key={tab.key} className="relative flex-1 h-12">
                                            {isActive && (
                                                <motion.div
                                                    layoutId="active-tab"
                                                    className="absolute inset-0 bg-muted"
                                                    transition={{ type: 'spring', bounce: 0.0, duration: 0.4 }}
                                                />
                                            )}
                                        </div>
                                    )
                                })}
                            </div>
                            {/* Content panel */}
                            <div className="bg-muted overflow-hidden">
                                <AnimatePresence mode="popLayout">
                                    <motion.div
                                        key={activeSection}
                                        initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
                                        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                                        exit={{ opacity: 0, y: -50, filter: 'blur(10px)' }}
                                        transition={{ duration: 0.2, ease: 'easeOut' }}
                                        className="p-4 space-y-3"
                                    >
                                        {TABS.find(t => t.key === activeSection)?.statuses.flatMap(s => grouped[s] || []).map(renderCard)}
                                    </motion.div>
                                </AnimatePresence>
                            </div>
                        </div>

                        {/* Layer 2: Overlay button (tanpa filter) */}
                        <div className="absolute inset-0 flex w-full pointer-events-none">
                            {TABS.map(tab => {
                                const count = tab.statuses.flatMap(s => grouped[s] || []).length
                                const isActive = activeSection === tab.key
                                return (
                                    <button key={tab.key}
                                        onClick={() => setActiveSection(tab.key)}
                                        className="flex-1 flex items-center justify-center gap-2 h-12 text-sm font-medium pointer-events-auto"
                                    >
                                        <tab.icon className={`w-4 h-4 ${isActive || tab.key !== 'selesai' ? tab.color : 'text-muted-foreground'}`} />
                                        <span className={isActive || tab.key !== 'selesai' ? 'text-black' : 'text-muted-foreground'}>{tab.label}</span>
                                        <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-full ${isActive || tab.key !== 'selesai' ? tab.bg + ' ' + tab.color : 'bg-muted text-muted-foreground'}`}>{count}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>
                </>
            )}

            {/* Offcanvas Drawer — unchanged */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-card w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-card border-b-2 border-border p-5 flex justify-between items-center z-10">
                            <div>
                                <h3 className="text-lg font-bold text-foreground font-mono">{selectedTicket.code}</h3>
                                <p className="text-sm text-muted-foreground">
                                    Status: <span className="font-bold">{STATUS_LABELS[selectedTicket.status] || selectedTicket.status}</span>
                                    {selectedTicket.priority && (
                                        <Badge type="priority" value={selectedTicket.priority} className="ml-2" />
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="flex border-b-2 border-border bg-muted">
                            {([{ id: 'detail', label: 'Detail' }, { id: 'timeline', label: 'Timeline' }, { id: 'activity', label: 'Activity' }] as const).map(tab => (
                                <button key={tab.id} onClick={() => setActiveDrawerTab(tab.id)}
                                    className={`flex-1 px-4 py-3 text-sm font-medium ${activeDrawerTab === tab.id ? 'bg-card border-b-2 border-foreground text-foreground' : 'text-muted-foreground hover:text-muted-foreground'}`}>
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-5 flex-1 space-y-4">
                            {activeDrawerTab === 'detail' && (
                                <>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted p-3 rounded-lg border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Pelanggan</p>
                                            <p className="font-medium text-sm">{selectedTicket.customer}</p>
                                        </div>
                                        <div className="bg-muted p-3 rounded-lg border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Site / Unit</p>
                                            <p className="font-medium text-sm">{selectedTicket.site || '-'} — {selectedTicket.unit || '-'}</p>
                                        </div>
                                    </div>
                                    <div>
                                        <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Deskripsi Kendala</p>
                                        <p className="text-sm bg-muted p-3 rounded-lg border border-border whitespace-pre-wrap">{selectedTicket.description || '-'}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted p-3 rounded-lg border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">Dibuat</p>
                                            <p className="text-sm font-mono">{formatDate(selectedTicket.createdAt)}</p>
                                        </div>
                                        <div className="bg-muted p-3 rounded-lg border border-border">
                                            <p className="text-[10px] text-muted-foreground uppercase font-semibold mb-1">SLA Tersisa</p>
                                            <p className={`text-sm font-mono font-bold ${selectedTicket.slaTimeLeft <= 4 ? 'text-red-600' : selectedTicket.slaTimeLeft <= 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                                {selectedTicket.slaTimeLeft}h
                                            </p>
                                        </div>
                                    </div>
                                </>
                            )}

                            {activeDrawerTab === 'timeline' && (
                                <div className="space-y-4 border-l-2 border-border ml-3 pl-4">
                                    {selectedTicket.activities.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">Belum ada aktivitas.</p>
                                    ) : (
                                        selectedTicket.activities.map((act, idx) => (
                                            <div key={idx} className="relative">
                                                <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-foreground" />
                                                <p className="text-xs text-muted-foreground">{act.timestamp}</p>
                                                <p className="text-sm font-medium">{act.action}</p>
                                                {act.details && <p className="text-xs text-muted-foreground mt-0.5">{act.details}</p>}
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}

                            {activeDrawerTab === 'activity' && (
                                <div className="space-y-3">
                                    {selectedTicket.activities.length === 0 ? (
                                        <p className="text-sm text-muted-foreground italic">Belum ada log aktivitas.</p>
                                    ) : (
                                        selectedTicket.activities.map((act, idx) => (
                                            <div key={idx} className="flex items-start gap-3 text-sm bg-muted p-3 rounded-lg border border-border">
                                                <div className="w-2 h-2 rounded-full bg-muted-foreground mt-1.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-xs text-muted-foreground">{act.timestamp}</p>
                                                    <p className="font-medium">{act.user}</p>
                                                    <p className="text-muted-foreground">{act.action}</p>
                                                    {act.details && <p className="text-muted-foreground text-xs mt-0.5">{act.details}</p>}
                                                </div>
                                            </div>
                                        ))
                                    )}
                                </div>
                            )}
                        </div>

                        <div className="sticky bottom-0 bg-card border-t-2 border-border p-5 space-y-3">
                            {selectedTicket.status === 'SCHEDULED' && (
                                <button onClick={() => handleStatusUpdate(selectedTicket.id, 'EN_ROUTE', 'Tugas diterima')}
                                    disabled={isLoading === selectedTicket.id}
                                    className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isLoading === selectedTicket.id ? 'Memproses...' : <><ChevronRight className="w-4 h-4" /> Terima Tugas</>}
                                </button>
                            )}
                            {selectedTicket.status === 'EN_ROUTE' && (
                                <button onClick={() => handleMulaiKerja(selectedTicket)}
                                    disabled={isLoading === selectedTicket.id || isLoading === 'gps'}
                                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isLoading === 'gps' ? 'Mengambil lokasi...' : <><MapPin className="w-4 h-4" /> Mulai Kerja (GPS)</>}
                                </button>
                            )}
                            {selectedTicket.status === 'WORKING' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setShowPendingModal(true)}
                                        className="py-2.5 bg-amber-500 text-white rounded-lg font-bold flex items-center justify-center gap-2">
                                        <PauseCircle className="w-4 h-4" /> Ajukan Pending
                                    </button>
                                    <button onClick={() => setShowCompleteModal(true)}
                                        className="py-2.5 bg-foreground text-primary-foreground rounded-lg font-bold flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Selesaikan
                                    </button>
                                </div>
                            )}
                            {selectedTicket.status === 'PENDING' && (
                                <button onClick={() => handleStatusUpdate(selectedTicket.id, 'WORKING', 'Pekerjaan dilanjutkan')}
                                    disabled={isLoading === selectedTicket.id}
                                    className="w-full py-2.5 bg-foreground text-primary-foreground rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    <PlayCircle className="w-4 h-4" /> Lanjutkan Pekerjaan
                                </button>
                            )}
                            {selectedTicket.status === 'RESOLVED' && (
                                <p className="text-center text-sm text-muted-foreground italic">Menunggu validasi Helpdesk</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Pending Modal */}
            {showPendingModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowPendingModal(false)}>
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2 mb-4">
                            <PauseCircle className="w-5 h-5" /> Ajukan Pending
                        </h3>
                        <textarea value={pendingReason} onChange={e => setPendingReason(e.target.value)}
                            placeholder="Alasan pending (wajib)..."
                            rows={3} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground resize-none mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPendingModal(false); setPendingReason('') }}
                                className="flex-1 py-2 bg-muted rounded-lg text-sm font-medium">Batal</button>
                            <button onClick={handlePending} disabled={!pendingReason.trim()}
                                className="flex-1 py-2 bg-amber-500 text-white rounded-lg text-sm font-bold disabled:opacity-50">Simpan</button>
                        </div>
                    </div>
                </div>
            )}

            {/* Complete Modal */}
            {showCompleteModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4" onClick={() => setShowCompleteModal(false)}>
                    <div className="bg-card w-full max-w-lg rounded-xl border-2 border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <h3 className="text-lg font-bold text-foreground flex items-center gap-2 mb-4">
                            <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Selesaikan Tugas
                        </h3>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan Hasil</label>
                                <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)}
                                    rows={2} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Sparepart (jika ada)</label>
                                <input value={sparepart} onChange={e => setSparepart(e.target.value)}
                                    className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground" placeholder="Nama sparepart..." />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Foto Dokumentasi</label>
                                <div className="border-2 border-dashed border-border rounded-lg p-4 text-center hover:border-foreground transition-colors cursor-pointer"
                                    onClick={() => document.getElementById('foto-upload')?.click()}>
                                    <Camera className="w-6 h-6 text-muted-foreground mx-auto mb-1" />
                                    <p className="text-xs text-muted-foreground">Ketuk untuk upload foto</p>
                                    <p className="text-[10px] text-muted-foreground">Hasil perbaikan, Serial Number, BAST</p>
                                    <input id="foto-upload" type="file" accept="image/*" capture="environment" multiple
                                        className="hidden" onChange={e => {
                                            const files = Array.from(e.target.files || [])
                                            setPhotos(prev => [...prev, ...files].slice(0, 10))
                                        }} />
                                </div>
                                {photos.length > 0 && (
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {photos.map((f, i) => (
                                            <div key={i} className="relative">
                                                <span className="text-[10px] bg-muted px-2 py-1 rounded border border-border">{f.name.slice(0, 15)}...</span>
                                                <button onClick={() => setPhotos(photos.filter((_, j) => j !== i))}
                                                    className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white rounded-full text-[8px] flex items-center justify-center">✕</button>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button onClick={() => { setShowCompleteModal(false); setCompleteNote(''); setSparepart(''); setPhotos([]) }}
                                className="flex-1 py-2 bg-muted rounded-lg text-sm font-medium">Batal</button>
                            <button onClick={handleComplete}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-bold">Ya, Selesaikan</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
