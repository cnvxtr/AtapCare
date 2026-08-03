import { useState, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { toast } from 'sonner'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { useTickets, type Ticket, type TicketStatus } from '../../context/TicketContext'
import {
    X, MapPin, Camera, ChevronRight,
    Clock, CheckCircle2, Pause, PauseCircle,
    ClipboardList, Wrench, Archive, AlertTriangle
} from 'lucide-react'
import { Badge } from '../../components/Badge'
import TicketDrawer, { TicketTimeline, TicketDescription, TicketActivityLog, AssignmentCard, getAssignmentInfo, isScheduleOvertime } from '../../components/TicketDrawer'
import { compressImage } from '../../lib/image'

type TabType = 'detail' | 'timeline' | 'activity'

const TABS = [
    { key: 'masuk', icon: ClipboardList, label: 'Masuk', color: 'text-black', statuses: ['SCHEDULED', 'EN_ROUTE'] },
    { key: 'dikerjakan', icon: Wrench, label: 'Dikerjakan', color: 'text-black', statuses: ['WORKING'] },
    { key: 'pending', icon: Pause, label: 'Dijeda', color: 'text-black', statuses: ['PENDING'] },
    { key: 'selesai', icon: Archive, label: 'Selesai', color: 'text-emerald-600', statuses: ['RESOLVED'] },
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
    const [submitting, setSubmitting] = useState(false)
    const [gpsError, setGpsError] = useState('')
    const [isLoading, setIsLoading] = useState<string | null>(null)
    const [showLemburModal, setShowLemburModal] = useState(false)
    const [lemburTarget, setLemburTarget] = useState<Ticket | null>(null)

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
        SCHEDULED: { label: 'Terima Tugas', action: (t) => handleTerimaTugas(t), color: 'bg-blue-600 hover:bg-blue-700' },
        EN_ROUTE: { label: 'Mulai Kerja', action: (t) => handleMulaiKerja(t), color: 'bg-emerald-600 hover:bg-emerald-700' },
        WORKING: null,
        PENDING: null,
        RESOLVED: null,
    }

    const handleTerimaTugas = (ticket: Ticket) => {
        const { jadwal } = getAssignmentInfo(ticket.activities)
        if (isScheduleOvertime(jadwal)) {
            setLemburTarget(ticket)
            setShowLemburModal(true)
        } else {
            handleStatusUpdate(ticket.id, 'EN_ROUTE', 'Tugas diterima')
        }
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
            (position) => {
                const { latitude, longitude } = position.coords
                setGpsError('')
                setIsLoading(null)
                // ponytail: koordinat disimpan di string aktivitas (pola sama dengan jadwal);
                // kolom geo terstruktur + validasi radius lokasi adalah upgrade berikutnya.
                handleStatusUpdate(ticket.id, 'WORKING', `Pekerjaan dimulai — lokasi terverifikasi (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`)
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

    const handleComplete = async () => {
        if (!selectedTicket) return
        if (photos.length === 0) {
            toast.error('Minimal 1 foto dokumentasi wajib diunggah.')
            return
        }
        setSubmitting(true)
        try {
            const imgs = await Promise.all(photos.map(compressImage))
            const parts = [`Selesai${completeNote ? ': ' + completeNote : ''}`]
            if (sparepart.trim()) parts.push(`Sparepart: ${sparepart.trim()}`)
            if (imgs.length) parts.push(`Foto (${imgs.length}):\n${imgs.join('\n')}`)
            await handleStatusUpdate(selectedTicket.id, 'RESOLVED', parts.join(' | '))
        } catch {
            toast.error('Gagal memproses foto. Coba lagi.')
        } finally {
            setSubmitting(false)
            setCompleteNote('')
            setSparepart('')
            setPhotos([])
            setShowCompleteModal(false)
        }
    }

    const renderCard = (ticket: Ticket) => {
        const act = statusActions[ticket.status]
        const isP1 = ticket.priority === 'P1'
        const { jadwal } = getAssignmentInfo(ticket.activities)
        const isOvertime = ticket.status === 'SCHEDULED' && isScheduleOvertime(jadwal)

        return (
            <div key={ticket.id}
                className={`bg-card border-2 rounded-lg p-4 shadow-sm hover:shadow-md transition-all cursor-pointer ${isP1 ? 'border-red-200 hover:border-red-300 pulse-ring' : 'border-border hover:border-border'}`}
                onClick={() => { setSelectedTicket(ticket); setActiveDrawerTab('detail') }}
            >
                <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono text-xs font-bold text-foreground">{ticket.code}</span>
                            {ticket.priority && (
                                            <Badge type="priority" value={ticket.priority} />
                            )}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{ticket.site}{ticket.unit ? ` — ${ticket.unit}` : ''}</p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{ticket.customer}</p>
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
                                className={`px-3 py-1.5 rounded text-xs font-bold text-white transition-all ${act.color} disabled:opacity-50 disabled:cursor-wait`}>
                                {isLoading === ticket.id ? 'Memproses...' : isLoading === 'gps' && act.label === 'Mulai Kerja' ? 'Mengambil GPS...' : act.label}
                            </button>
                        )}
                    </div>
                </div>
            </div>
        )
    }

    const totalTickets = myTickets.length
    const incomingCount = (grouped['SCHEDULED']?.length || 0) + (grouped['EN_ROUTE']?.length || 0)

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-4 pb-4 border-b border-border">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground">Tugas</h2>
                    {user?.full_name && (
                        <p className="text-sm text-muted-foreground">
                            Selamat datang, <span className="font-semibold text-foreground">{user.full_name}</span>
                        </p>
                    )}
                </div>
                <span className="px-3 py-2 rounded bg-red-600 text-white text-sm font-medium flex items-center gap-2 shadow-sm">
                    <span className="w-2 h-2 bg-white rounded-full animate-pulse"></span>
                    {incomingCount} Tugas Masuk
                </span>
            </div>

            {gpsError && (
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded">
                    <MapPin className="w-4 h-4 text-red-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-700">{gpsError}</p>
                    <button onClick={() => setGpsError('')} className="ml-auto"><X className="w-4 h-4 text-red-400" /></button>
                </div>
            )}

            {totalTickets === 0 ? (
                <div className="text-center py-16 text-muted-foreground">
                    <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-50" />
                    <p className="font-medium">Tidak ada tugas saat ini</p>
                    <p className="text-sm">Tiket yang ditugaskan ke Anda akan muncul di sini.</p>
                </div>
            ) : (
                <>
                    <div className="bg-card p-4 rounded-xl border border-border">
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {TABS.map(tab => {
                                const count = tab.statuses.flatMap(s => grouped[s] || []).length
                                const isActive = activeSection === tab.key
                                return (
                                    <button key={tab.key}
                                        onClick={() => setActiveSection(tab.key)}
                                        className={`flex items-center justify-center gap-2 px-3 py-2 rounded-sm text-sm font-medium transition whitespace-nowrap ${isActive ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                                    >
                                        <tab.icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : tab.color}`} />
                                        {tab.label}
                                        <span className={`text-[11px] font-bold ${isActive ? 'text-primary-foreground' : 'text-muted-foreground'}`}>{count}</span>
                                    </button>
                                )
                            })}
                        </div>
                    </div>

                    <AnimatePresence mode="popLayout">
                        <motion.div
                            key={activeSection}
                            initial={{ opacity: 0, y: 50, filter: 'blur(10px)' }}
                            animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                            exit={{ opacity: 0, y: -50, filter: 'blur(10px)' }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3"
                        >
                            {(() => {
                                const activeTab = TABS.find(t => t.key === activeSection)!
                                const cards = activeTab.statuses.flatMap(s => grouped[s] || [])
                                if (cards.length === 0) {
                                    const Icon = activeTab.icon
                                    return (
                                        <div className="col-span-full text-center py-16 text-muted-foreground">
                                            <Icon className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="font-medium">Tidak ada tiket {activeTab.label.toLowerCase()}</p>
                                            <p className="text-sm">Tiket yang sesuai filter akan muncul di sini.</p>
                                        </div>
                                    )
                                }
                                return cards.map(renderCard)
                            })()}
                        </motion.div>
                    </AnimatePresence>
                </>
            )}

            {/* Offcanvas Drawer */}
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
                            {selectedTicket.status === 'SCHEDULED' && (
                                <button onClick={() => handleTerimaTugas(selectedTicket)}
                                    disabled={isLoading === selectedTicket.id}
                                    className="w-full py-2.5 bg-foreground text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isLoading === selectedTicket.id ? 'Memproses...' : <><ChevronRight className="w-4 h-4" /> Terima Tugas</>}
                                </button>
                            )}
                            {selectedTicket.status === 'EN_ROUTE' && (
                                <button onClick={() => handleMulaiKerja(selectedTicket)}
                                    disabled={isLoading === selectedTicket.id || isLoading === 'gps'}
                                    className="w-full py-2.5 bg-foreground text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2 disabled:opacity-50">
                                    {isLoading === 'gps' ? 'Mengambil lokasi...' : <><MapPin className="w-4 h-4" /> Mulai Kerja (GPS)</>}
                                </button>
                            )}
                            {selectedTicket.status === 'WORKING' && (
                                <div className="grid grid-cols-2 gap-3">
                                    <button onClick={() => setShowPendingModal(true)}
                                        className="py-2.5 bg-transparent text-amber-600 border border-border rounded-md font-bold flex items-center justify-center gap-2 hover:bg-amber-50/60 transition">
                                        <PauseCircle className="w-4 h-4" /> Ajukan Pending
                                    </button>
                                    <button onClick={() => setShowCompleteModal(true)}
                                        className="py-2.5 bg-foreground text-primary-foreground rounded-md font-bold flex items-center justify-center gap-2">
                                        <CheckCircle2 className="w-4 h-4" /> Selesaikan
                                    </button>
                                </div>
                            )}
                            {selectedTicket.status === 'PENDING' && (
                                <p className="text-center text-sm text-muted-foreground italic">Menunggu keputusan PM untuk melanjutkan.</p>
                            )}
                            {selectedTicket.status === 'RESOLVED' && (
                                <p className="text-center text-sm text-muted-foreground italic">Menunggu validasi Helpdesk</p>
                            )}
                        </>
                    }
                >
                    {activeDrawerTab === 'detail' && (
                        <>
                            <AssignmentCard items={selectedTicket.activities} />
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Pelanggan</p>
                                    <p className="font-medium text-sm">{selectedTicket.customer}</p>
                                </div>
                                <div className="bg-muted/60 p-4 rounded-lg border border-border">
                                    <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Site / Unit</p>
                                    <p className="font-medium text-sm">{selectedTicket.site || '-'} — {selectedTicket.unit || '-'}</p>
                                </div>
                            </div>
                            <TicketDescription description={selectedTicket.description} />
                            <div className="bg-muted/60 p-4 rounded-lg border border-border mt-4">
                                <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">SLA Tersisa</p>
                                <p className={`text-sm font-mono font-bold ${selectedTicket.slaTimeLeft <= 4 ? 'text-red-600' : selectedTicket.slaTimeLeft <= 8 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                    {selectedTicket.slaTimeLeft}h
                                </p>
                            </div>
                        </>
                    )}

                    {activeDrawerTab === 'timeline' && <TicketTimeline items={selectedTicket.activities} />}

                    {activeDrawerTab === 'activity' && <TicketActivityLog items={selectedTicket.activities} />}
                </TicketDrawer>
            )}

            {/* Pending Modal */}
            {showPendingModal && createPortal((
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 fade-in" onClick={() => setShowPendingModal(false)}>
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                                <PauseCircle className="w-5 h-5" /> Ajukan Pending
                            </h3>
                            <button onClick={() => setShowPendingModal(false)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <textarea value={pendingReason} onChange={e => setPendingReason(e.target.value)}
                            placeholder="Alasan pending (wajib)..."
                            rows={3} className="w-full px-3 py-2 border-2 border-border rounded text-sm outline-none focus:border-foreground resize-none mb-4" />
                        <div className="flex gap-3">
                            <button onClick={() => { setShowPendingModal(false); setPendingReason('') }}
                                className="flex-1 py-2 bg-muted rounded text-sm font-medium">Batal</button>
                            <button onClick={handlePending} disabled={!pendingReason.trim()}
                                className="flex-1 py-2 bg-amber-500 text-white rounded text-sm font-bold disabled:opacity-50">Simpan</button>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {/* Complete Modal */}
            {showCompleteModal && createPortal((
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 fade-in" onClick={() => setShowCompleteModal(false)}>
                    <div className="bg-card w-full max-w-lg rounded-lg border-2 border-border p-6 shadow-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600" /> Selesaikan Tugas
                            </h3>
                            <button onClick={() => { setShowCompleteModal(false); setCompleteNote(''); setSparepart(''); setPhotos([]) }} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan Hasil</label>
                                <textarea value={completeNote} onChange={e => setCompleteNote(e.target.value)}
                                    rows={2} className="w-full px-3 py-2 border-2 border-border rounded text-sm outline-none focus:border-foreground resize-none" />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Sparepart (jika ada)</label>
                                <input value={sparepart} onChange={e => setSparepart(e.target.value)}
                                    className="w-full px-3 py-2 border-2 border-border rounded text-sm outline-none focus:border-foreground" placeholder="Nama sparepart..." />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Foto Dokumentasi <span className="text-red-600">(min. 1)</span></label>
                                <div className="border-2 border-dashed border-border rounded p-4 text-center hover:border-foreground transition-colors cursor-pointer"
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
                                disabled={submitting}
                                className="flex-1 py-2 bg-muted rounded text-sm font-medium disabled:opacity-50">Batal</button>
                            <button onClick={handleComplete} disabled={submitting || photos.length === 0}
                                className="flex-1 py-2 bg-emerald-600 text-white rounded text-sm font-bold disabled:opacity-50">{submitting ? 'Memproses...' : 'Ya, Selesaikan'}</button>
                        </div>
                    </div>
                </div>
            ), document.body)}

            {/* Lembur Modal */}
            {showLemburModal && lemburTarget && createPortal((
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[120] flex items-center justify-center p-4 fade-in" onClick={() => setShowLemburModal(false)}>
                    <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-start justify-between gap-4 mb-4">
                            <h3 className="text-lg font-bold text-amber-600 flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5" /> Berpotensi Lembur
                            </h3>
                            <button onClick={() => setShowLemburModal(false)} className="p-2 bg-foreground text-background rounded-lg hover:opacity-80 transition-opacity"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="bg-amber-50/60 p-4 rounded-lg border border-amber-200 mb-4">
                            <p className="text-sm text-amber-800">
                                Tiket <span className="font-mono font-bold">{lemburTarget.code}</span> dijadwalkan di luar jam operasional (08.15–17.00 WIB) atau akhir pekan.
                                Menerima tugas ini berpotensi lembur.
                            </p>
                        </div>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLemburModal(false)}
                                className="flex-1 py-2 bg-muted rounded text-sm font-medium">Batal</button>
                            <button onClick={() => {
                                handleStatusUpdate(lemburTarget.id, 'EN_ROUTE', 'Tugas diterima (disetujui lembur)')
                                setShowLemburModal(false); setLemburTarget(null)
                            }}
                                className="flex-1 py-2 bg-amber-500 text-white rounded text-sm font-bold">Ya, Terima Tugas</button>
                        </div>
                    </div>
                </div>
            ), document.body)}
        </div>
    )
}
