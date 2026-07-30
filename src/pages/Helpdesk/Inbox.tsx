import { useState, useEffect } from 'react'
import { useTickets, type Ticket, type Priority } from '../../context/TicketContext'
import { Plus, Calendar, Filter, X, Eye, Search, Download, ArrowUpDown, Send, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { Badge } from '../../components/Badge'

// MOCK MASTER DATA (Simulasi Database Master Data)
const MASTER_DATA = [
    { name: 'Merak', pic: 'Budi Santoso', wa_pic: '081234567890', units: ['VMS Gate 1', 'VMS Gate 2', 'CCTV Lobby'] },
    { name: 'Bakauheni', pic: 'Siti Aminah', wa_pic: '081234567891', units: ['NVR Utama', 'Server Ruang IT', 'Access Control'] },
    { name: 'Balongan', pic: 'Joko Anwar', wa_pic: '081234567892', units: ['CCTV Ruang Server', 'CCTV Lobby', 'Fire Alarm'] },
]

export default function Inbox() {
    const { tickets, updateTicketStatus, getTicketCount, addTicket } = useTickets()
    const [activeDateFilter, setActiveDateFilter] = useState('today')
    const [priorityFilter, setPriorityFilter] = useState('all')
    const [searchTerm, setSearchTerm] = useState('')
    const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'priority'>('newest')
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

    // State Form Internal
    const [formData, setFormData] = useState({
        sumberLaporan: 'Internal', reporterName: '', jabatan: '', noWaPelapor: '',
        site: '', unit: '', picName: '', picWa: '',
        category: '', priority: 'P2' as Priority, location: '', description: '',
        catatanInternal: '', photoName: ''
    })

    useEffect(() => {
        const audio = new Audio('https://assets.mixkit.co/sfx/preview/mixkit-software-interface-start-2574.mp3')
        audio.volume = 0.5
        if (getTicketCount('NEW') > 0) audio.play().catch(() => { })
    }, [tickets, getTicketCount])

    // FILTER & SORT LOGIC
    const filteredTickets = tickets
        .filter(t => {
            const isStatusMatch = t.status === 'NEW' || t.status === 'OPEN'
            const isPriorityMatch = priorityFilter === 'all' || t.priority === priorityFilter
            const isDateMatch = (() => {
                const ticketDate = new Date(t.createdAt)
                const now = new Date()
                const diffHours = (now.getTime() - ticketDate.getTime()) / (1000 * 60 * 60)
                if (activeDateFilter === 'today') return diffHours <= 24
                if (activeDateFilter === 'yesterday') return diffHours > 24 && diffHours <= 48
                if (activeDateFilter === '7days') return diffHours <= 168
                return true
            })()
            const isSearchMatch = searchTerm === '' ||
                t.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                t.customer.toLowerCase().includes(searchTerm.toLowerCase()) ||
                (t.site && t.site.toLowerCase().includes(searchTerm.toLowerCase()))
            return isStatusMatch && isPriorityMatch && isDateMatch && isSearchMatch
        })
        .sort((a, b) => {
            if (sortBy === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
            if (sortBy === 'oldest') return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
            if (sortBy === 'priority') {
                const order = { 'P1': 1, 'P2': 2, 'P3': 3 }
                return (order[a.priority || 'P3'] || 4) - (order[b.priority || 'P3'] || 4)
            }
            return 0
        })

    const handleExportCSV = () => {
        const headers = ['Kode Tiket', 'Pelapor', 'Perusahaan', 'Site', 'Unit', 'Prioritas', 'Status', 'Tanggal Dibuat']
        const rows = filteredTickets.map(t => [
            t.code, t.customer, t.company, t.site || '-', t.unit || '-', t.priority || '-', t.status,
            new Date(t.createdAt).toLocaleDateString('id-ID')
        ])
        const csvContent = [headers.join(','), ...rows.map(row => row.map(cell => `"${cell}"`).join(','))].join('\n')
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
        const link = document.createElement('a')
        link.href = URL.createObjectURL(blob)
        link.download = `Inbox_Tiket_${new Date().toISOString().split('T')[0]}.csv`
        link.click()
    }

    // HANDLERS
    const handleInternalSubmit = (initialStatus: 'NEW' | 'UNASSIGNED' | 'RESOLVED' | 'VOID') => {
        if (!formData.reporterName || !formData.site || !formData.unit) {
            alert("Mohon lengkapi Nama Pelapor, Site, dan Unit!")
            return
        }

        if (initialStatus === 'VOID') {
            const reason = prompt("Masukkan alasan VOID:")
            if (!reason) return
            addTicket({
                reporterName: formData.reporterName, company: 'Internal', site: formData.site, unit: formData.unit,
                category: formData.category, priority: formData.priority, location: formData.location,
                description: formData.description, photoUrl: undefined, initialStatus: 'NEW',
                catatanInternal: `Dibatalkan (VOID): ${reason}`
            })
            alert("Tiket disimpan sebagai NEW. Silakan VOID manual dari drawer.")
            setIsModalOpen(false)
            resetForm()
            return
        }

        // PERBAIKAN: Menambahkan catatanInternal ke payload
        addTicket({
            reporterName: formData.reporterName,
            company: 'Internal',
            site: formData.site,
            unit: formData.unit,
            category: formData.category,
            priority: formData.priority,
            location: formData.location,
            description: formData.description,
            photoUrl: undefined,
            initialStatus: initialStatus,
            catatanInternal: formData.catatanInternal // <-- PERBAIKAN: Kirim catatan internal
        })
        setIsModalOpen(false)
        resetForm()
    }

    const resetForm = () => {
        setFormData({
            sumberLaporan: 'Internal', reporterName: '', jabatan: '', noWaPelapor: '',
            site: '', unit: '', picName: '', picWa: '',
            category: '', priority: 'P2', location: '', description: '',
            catatanInternal: '', photoName: ''
        })
    }

    const handleSiteChange = (siteName: string) => {
        const siteData = MASTER_DATA.find(s => s.name === siteName)
        setFormData({
            ...formData,
            site: siteName,
            unit: '',
            picName: siteData ? siteData.pic : '',
            picWa: siteData ? siteData.wa_pic : ''
        })
    }

    const handleVoid = () => {
        if (!voidReason.trim()) { alert("Alasan VOID wajib diisi!"); return }
        if (voidTicketId) {
            updateTicketStatus(voidTicketId, 'VOID', voidReason)
            setVoidReason(''); setShowVoidModal(false); setVoidTicketId(null); setSelectedTicket(null)
        }
    }

    const handleDuplicate = () => {
        if (!duplicateTargetId) { alert("Pilih tiket utama terlebih dahulu!"); return }
        if (selectedTicket) {
            const targetTicket = tickets.find(t => t.id === duplicateTargetId)
            updateTicketStatus(selectedTicket.id, 'DUPLICATE', `Duplikat dari tiket ${targetTicket?.code || duplicateTargetId}`)
            setDuplicateTargetId(''); setShowDuplicateModal(false); setSelectedTicket(null)
        }
    }

    const handleRemoteSubmit = () => {
        if (!remoteResult) { alert("Pilih hasil remote terlebih dahulu!"); return }
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
        alert("Template WA terkirim ke pelanggan! (Simulasi: Tiket akan auto-close dalam 24 jam jika tidak ada balasan)")
        updateTicketStatus(selectedTicket!.id, 'CLOSED', 'Konfirmasi via WA terkirim. Auto-close flag aktif.')
        setShowConfirmPath(false); setShowRemoteModal(false); setSelectedTicket(null)
    }

    const handleValidationSubmit = () => {
        if (validationAction === 'rework' && !reworkReason.trim()) {
            alert("Alasan Rework wajib diisi!"); return
        }
        if (validationAction === 'close') {
            updateTicketStatus(selectedTicket!.id, 'CLOSED', 'Tiket divalidasi dan ditutup oleh Helpdesk.')
        } else {
            updateTicketStatus(selectedTicket!.id, 'WORKING', `Rework: ${reworkReason}`)
        }
        setShowValidationModal(false); setSelectedTicket(null)
    }

    return (
        <div className="space-y-6">
            {/* HEADER */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h2 className="text-2xl font-display font-bold text-foreground">Antrean Masuk</h2>
                    <p className="text-sm text-muted-foreground mt-1">Pusat pendaratan laporan keluhan baru</p>
                </div>
                <span className="bg-red-50 text-red-600 px-3 py-1.5 rounded-full text-sm font-medium border border-red-200 flex items-center gap-2">
                    <span className="w-2 h-2 bg-red-600 rounded-full animate-pulse"></span>
                    {getTicketCount('NEW') + getTicketCount('OPEN')} Perlu Tindakan
                </span>
            </div>

            {/* TOOLBAR */}
            <div className="bg-card p-4 rounded-2xl border border-border space-y-4">
                <div className="flex flex-col sm:flex-row gap-4">
                    <div className="flex items-center gap-2 flex-wrap">
                        <Calendar className="w-4 h-4 text-muted-foreground" />
                        {['today', 'yesterday', '7days'].map((f) => (
                            <button key={f} onClick={() => setActiveDateFilter(f)} className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap ${activeDateFilter === f ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent'}`}>
                                {f === 'today' ? 'Hari Ini' : f === 'yesterday' ? 'Kemarin' : '7 Hari'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-2 flex-1">
                        <Filter className="w-4 h-4 text-muted-foreground" />
                        <select value={priorityFilter} onChange={(e) => setPriorityFilter(e.target.value)} className="px-3 py-1.5 bg-card border-2 border-border rounded-lg text-sm text-foreground outline-none flex-1">
                            <option value="all">Semua Prioritas</option>
                            <option value="P1">P1 (Kritis)</option>
                            <option value="P2">P2 (Medium)</option>
                            <option value="P3">P3 (Low)</option>
                        </select>
                    </div>
                    <div className="flex items-center gap-2">
                        <ArrowUpDown className="w-4 h-4 text-muted-foreground" />
                        <select value={sortBy} onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'priority')} className="px-3 py-1.5 bg-card border-2 border-border rounded-lg text-sm text-foreground outline-none">
                            <option value="newest">Terbaru</option>
                            <option value="oldest">Terlama</option>
                            <option value="priority">Prioritas</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-muted-foreground" />
                        <input type="text" placeholder="Cari kode, pelanggan, atau site..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-card border-2 border-border rounded-lg text-sm focus:ring-2 focus:ring-gray-400 outline-none" />
                    </div>
                    <button onClick={handleExportCSV} className="flex items-center justify-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 border-2 border-emerald-200 hover:bg-emerald-100 rounded-lg text-sm font-medium">
                        <Download className="w-4 h-4" /> Export CSV
                    </button>
                    <button onClick={() => setIsModalOpen(true)} className="flex items-center justify-center gap-2 px-4 py-2 bg-foreground text-primary-foreground hover:bg-foreground/90 rounded-lg text-sm font-medium">
                        <Plus className="w-4 h-4" /> Buat Tiket Internal
                    </button>
                </div>
            </div>

            {/* TABEL */}
                <div className="rounded-2xl border border-border bg-card overflow-hidden">
                <div className="overflow-x-auto">
                    <div className="min-w-[900px]">
                        <table className="w-full text-left">
                            <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Kode</th><th className="px-4 py-3 font-medium">Pelapor</th><th className="px-4 py-3 font-medium">Site</th>
                                    <th className="px-4 py-3 font-medium">Unit</th><th className="px-4 py-3 font-medium">Prioritas</th><th className="px-4 py-3 font-medium">Status</th>
                                    <th className="px-4 py-3 font-medium text-right">Aksi</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {filteredTickets.length === 0 ? (
                                    <tr><td colSpan={7} className="p-8 text-center text-muted-foreground">Tidak ada tiket yang cocok dengan filter.</td></tr>
                                ) : (
                                    filteredTickets.map(ticket => (
                                        <tr key={ticket.id} className="hover:bg-muted">
                                            <td className="p-4 font-mono text-sm font-medium whitespace-nowrap">{ticket.code}</td>
                                            <td className="p-4 text-sm">{ticket.customer}</td>
                                            <td className="p-4 text-sm whitespace-nowrap">{ticket.site || '-'}</td>
                                            <td className="p-4 text-sm truncate max-w-[100px]" title={ticket.unit}>{ticket.unit || '-'}</td>
                                            <td className="p-4">
                                                <Badge type="priority" value={ticket.priority || '-'} />
                                            </td>
                                            <td className="p-4 text-sm whitespace-nowrap">{ticket.status}</td>
                                            <td className="p-4 text-right">
                                                <button onClick={() => { setSelectedTicket(ticket); setActiveDrawerTab('detail'); }} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-foreground text-primary-foreground hover:bg-foreground/90 rounded-lg text-xs font-semibold">
                                                    <Eye className="w-3.5 h-3.5" /> Detail
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

            {/* DRAWER & MODALS LAIN (Sama seperti sebelumnya, disingkat untuk fokus) */}
            {selectedTicket && (
                <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={() => setSelectedTicket(null)}>
                    <div className="bg-card w-full max-w-2xl h-full shadow-2xl overflow-y-auto flex flex-col" onClick={(e) => e.stopPropagation()}>
                        <div className="sticky top-0 bg-card border-b-2 border-border p-5 flex justify-between items-center z-10">
                            <div><h3 className="text-lg font-bold text-foreground">{selectedTicket.code}</h3><p className="text-sm text-muted-foreground">Status: <span className="font-bold">{selectedTicket.status}</span></p></div>
                            <button onClick={() => setSelectedTicket(null)} className="p-2 hover:bg-muted rounded-lg"><X className="w-5 h-5" /></button>
                        </div>
                        <div className="flex border-b-2 border-border bg-muted">
                            {[{ id: 'detail', label: 'Detail' }, { id: 'timeline', label: 'Timeline' }, { id: 'activity', label: 'Activity' }].map(tab => (
                                <button key={tab.id} onClick={() => setActiveDrawerTab(tab.id as 'detail' | 'timeline' | 'activity')} className={`flex-1 px-4 py-3 text-sm font-medium ${activeDrawerTab === tab.id ? 'bg-card border-b-2 border-foreground text-foreground' : 'text-muted-foreground'}`}>{tab.label}</button>
                            ))}
                        </div>
                        <div className="p-5 flex-1">
                            {activeDrawerTab === 'detail' && (
                                <div className="space-y-4">
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-muted p-3 rounded border border-border"><p className="text-xs text-muted-foreground">Pelapor</p><p className="font-medium">{selectedTicket.customer}</p></div>
                                        <div className="bg-muted p-3 rounded border border-border"><p className="text-xs text-muted-foreground">Site / Unit</p><p className="font-medium">{selectedTicket.site} - {selectedTicket.unit}</p></div>
                                    </div>
                                    <div><p className="text-xs text-muted-foreground mb-1">Deskripsi</p><p className="text-sm bg-muted p-3 rounded border border-border">{selectedTicket.description || '-'}</p></div>
                                    {selectedTicket.rejectionReason && (
                                        <div className="bg-red-50 p-3 rounded border border-red-200"><p className="text-xs text-red-600 font-semibold mb-1">Alasan Penolakan/VOID</p><p className="text-sm text-red-800">{selectedTicket.rejectionReason}</p></div>
                                    )}
                                </div>
                            )}
                            {activeDrawerTab === 'timeline' && (
                                <div className="space-y-4 border-l-2 border-border ml-3 pl-4">
                                    {selectedTicket.activities.map((act, idx) => (
                                        <div key={idx} className="relative">
                                            <div className="absolute -left-[21px] top-1 w-3 h-3 rounded-full bg-foreground"></div>
                                            <p className="text-xs text-muted-foreground">{act.timestamp}</p>
                                            <p className="text-sm font-medium">{act.action}</p>
                                            {act.details && <p className="text-xs text-muted-foreground mt-1">{act.details}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {activeDrawerTab === 'activity' && <p className="text-sm text-muted-foreground">Log aktivitas lengkap...</p>}
                        </div>
                        <div className="sticky bottom-0 bg-card border-t-2 border-border p-5 space-y-3">
                            {selectedTicket.status === 'NEW' && (
                                <>
                                    <button onClick={() => { updateTicketStatus(selectedTicket.id, 'OPEN'); setSelectedTicket(null); }} className="w-full py-2.5 bg-foreground text-primary-foreground rounded-lg font-bold">Validasi (Buka Tiket)</button>
                                    <div className="grid grid-cols-2 gap-3">
                                        <button onClick={() => { setVoidTicketId(selectedTicket.id); setShowVoidModal(true); }} className="py-2.5 bg-red-50 text-red-600 border border-red-200 rounded-lg font-medium">VOID</button>
                                        <button onClick={() => setShowDuplicateModal(true)} className="py-2.5 bg-amber-50 text-amber-600 border border-amber-200 rounded-lg font-medium">DUPLICATE</button>
                                    </div>
                                </>
                            )}
                            {selectedTicket.status === 'OPEN' && (
                                <>
                                    <button onClick={() => setShowRemoteModal(true)} className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 text-white rounded-lg font-bold">Remote Support</button>
                                    <button onClick={() => { updateTicketStatus(selectedTicket.id, 'UNASSIGNED'); setSelectedTicket(null); }} className="w-full py-2.5 bg-muted text-muted-foreground border border-border rounded-lg font-medium">Eskalasi ke PM</button>
                                </>
                            )}
                            {selectedTicket.status === 'RESOLVED' && (
                                <button onClick={() => setShowValidationModal(true)} className="w-full py-2.5 bg-emerald-600 text-white rounded-lg font-bold">Validasi Penyelesaian</button>
                            )}
                            {['UNASSIGNED', 'SCHEDULED', 'EN_ROUTE', 'WORKING', 'PENDING', 'CLOSED', 'VOID', 'DUPLICATE'].includes(selectedTicket.status) && (
                                <p className="text-center text-xs text-muted-foreground italic">Read Only / Monitoring Mode</p>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL VOID, DUPLICATE, REMOTE, VALIDASI (Sama seperti sebelumnya) */}
            {showVoidModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4 text-red-600">VOID Tiket (Permanen)</h3>
                        <textarea value={voidReason} onChange={e => setVoidReason(e.target.value)} placeholder="Alasan wajib..." rows={3} className="w-full px-3 py-2 border-2 border-border rounded mb-4"></textarea>
                        <div className="flex gap-3">
                            <button onClick={() => setShowVoidModal(false)} className="flex-1 py-2 bg-muted rounded">Batal</button>
                            <button onClick={handleVoid} className="flex-1 py-2 bg-red-600 text-white rounded font-bold">Ya, VOID</button>
                        </div>
                    </div>
                </div>
            )}
            {showDuplicateModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4 text-amber-600">Tandai Duplikat</h3>
                        <select value={duplicateTargetId} onChange={e => setDuplicateTargetId(e.target.value)} className="w-full px-3 py-2 border-2 border-border rounded mb-4">
                            <option value="">Pilih Tiket Utama...</option>
                            {tickets.filter(t => t.id !== selectedTicket?.id && !['CLOSED', 'VOID', 'DUPLICATE'].includes(t.status)).map(t => (
                                <option key={t.id} value={t.id}>{t.code} - {t.customer}</option>
                            ))}
                        </select>
                        <div className="flex gap-3">
                            <button onClick={() => setShowDuplicateModal(false)} className="flex-1 py-2 bg-muted rounded">Batal</button>
                            <button onClick={handleDuplicate} className="flex-1 py-2 bg-amber-600 text-white rounded font-bold">Tandai</button>
                        </div>
                    </div>
                </div>
            )}
            {showRemoteModal && !showConfirmPath && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4">Remote Support</h3>
                        <div className="space-y-4">
                            <div><label className="text-xs font-semibold text-muted-foreground">Media</label><div className="flex gap-2 mt-1">{['WA', 'Telepon', 'VC'].map(m => (<button key={m} onClick={() => setRemoteMedia(m)} className={`flex-1 py-2 rounded border text-sm ${remoteMedia === m ? 'bg-foreground text-primary-foreground border-foreground' : 'bg-card border-border'}`}>{m}</button>))}</div></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Durasi (Menit)</label><input type="number" value={remoteDuration} onChange={e => setRemoteDuration(e.target.value)} className="w-full mt-1 px-3 py-2 border-2 border-border rounded" /></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Catatan</label><textarea value={remoteNotes} onChange={e => setRemoteNotes(e.target.value)} rows={3} className="w-full mt-1 px-3 py-2 border-2 border-border rounded"></textarea></div>
                            <div><label className="text-xs font-semibold text-muted-foreground">Hasil</label><div className="grid grid-cols-2 gap-2 mt-1"><button onClick={() => setRemoteResult('success')} className={`py-2 rounded border text-sm ${remoteResult === 'success' ? 'bg-emerald-100 text-emerald-700 border-emerald-300' : 'bg-card border-border'}`}>Berhasil</button><button onClick={() => setRemoteResult('fail')} className={`py-2 rounded border text-sm ${remoteResult === 'fail' ? 'bg-red-100 text-red-700 border-red-300' : 'bg-card border-border'}`}>Gagal</button></div></div>
                            <div className="flex gap-3 pt-2"><button onClick={() => setShowRemoteModal(false)} className="flex-1 py-2 bg-muted rounded">Batal</button><button onClick={handleRemoteSubmit} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Simpan</button></div>
                        </div>
                    </div>
                </div>
            )}
            {showConfirmPath && (
                <div className="fixed inset-0 bg-black/60 z-[70] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-2">Remote Berhasil! Pilih Jalur:</h3>
                        <div className="space-y-3 mt-4">
                            <button onClick={handleConfirmPathA} className="w-full p-4 text-left border-2 border-border rounded-lg hover:border-foreground"><p className="font-bold text-foreground">Jalur A: Konfirmasi Langsung</p><p className="text-xs text-muted-foreground">Pelanggan sudah konfirmasi. Langsung tutup.</p></button>
                            <button onClick={handleConfirmPathB} className="w-full p-4 text-left border-2 border-border rounded-lg hover:border-blue-500"><p className="font-bold text-foreground">Jalur B: Kirim WA</p><p className="text-xs text-muted-foreground">Kirim template WA. Auto-close 24 jam.</p></button>
                        </div>
                        <button onClick={() => setShowConfirmPath(false)} className="w-full mt-4 py-2 text-sm text-muted-foreground">Batal</button>
                    </div>
                </div>
            )}
            {showValidationModal && (
                <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-md rounded-xl border-2 border-border p-6">
                        <h3 className="text-lg font-bold mb-4">Validasi Penyelesaian</h3>
                        <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-2"><button onClick={() => setValidationAction('close')} className={`py-3 rounded border font-medium ${validationAction === 'close' ? 'bg-emerald-100 border-emerald-500 text-emerald-700' : 'bg-card border-border'}`}>Close Ticket</button><button onClick={() => setValidationAction('rework')} className={`py-3 rounded border font-medium ${validationAction === 'rework' ? 'bg-amber-100 border-amber-500 text-amber-700' : 'bg-card border-border'}`}>Return Rework</button></div>
                            {validationAction === 'rework' && <div><label className="text-xs font-semibold text-muted-foreground">Alasan Rework *</label><textarea value={reworkReason} onChange={e => setReworkReason(e.target.value)} rows={2} className="w-full mt-1 px-3 py-2 border-2 border-border rounded"></textarea></div>}
                            <div className="flex gap-3 pt-2"><button onClick={() => setShowValidationModal(false)} className="flex-1 py-2 bg-muted rounded">Batal</button><button onClick={handleValidationSubmit} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold">Proses</button></div>
                        </div>
                    </div>
                </div>
            )}

            {/* ========================================== */}
            {/* MODAL BUAT TIKET INTERNAL (DIPERBAIKI TOTAL) */}
            {/* ========================================== */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
                    <div className="bg-card w-full max-w-2xl rounded-xl border-2 border-border shadow-2xl flex flex-col max-h-[90vh]" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b-2 border-border flex justify-between items-center bg-muted rounded-t-xl">
                            <div>
                                <h3 className="text-lg font-bold text-foreground">Buat Tiket Internal</h3>
                                <p className="text-xs text-muted-foreground">Lengkapi data di bawah. Pilih aksi di bagian bawah.</p>
                            </div>
                            <button onClick={() => { setIsModalOpen(false); resetForm(); }} className="p-2 hover:bg-accent rounded-lg"><X className="w-5 h-5" /></button>
                        </div>

                        <div className="p-5 space-y-4 overflow-y-auto flex-1">
                            {/* Baris 1: Sumber & Pelapor */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Sumber Laporan *</label>
                                    <select value={formData.sumberLaporan} onChange={e => setFormData({ ...formData, sumberLaporan: e.target.value })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground">
                                        <option>WhatsApp</option><option>Telepon</option><option>Email</option><option>Monitoring</option><option>Internal</option><option>Lainnya</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Nama Pelapor *</label>
                                    <input type="text" value={formData.reporterName} onChange={e => setFormData({ ...formData, reporterName: e.target.value })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Jabatan</label>
                                    <input type="text" value={formData.jabatan} onChange={e => setFormData({ ...formData, jabatan: e.target.value })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground" />
                                </div>
                            </div>

                            {/* Baris 2: No WA & Site */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">No WhatsApp Pelapor</label>
                                    <input type="text" value={formData.noWaPelapor} onChange={e => setFormData({ ...formData, noWaPelapor: e.target.value })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground" placeholder="+62" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Site *</label>
                                    <select value={formData.site} onChange={e => handleSiteChange(e.target.value)} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground">
                                        <option value="">Pilih Site...</option>
                                        {MASTER_DATA.map(s => <option key={s.name} value={s.name}>{s.name}</option>)}
                                    </select>
                                </div>
                            </div>

                            {/* Baris 3: Unit, Prioritas, Lokasi (DITAMBAHKAN PRIORITAS) */}
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Unit / Perangkat *</label>
                                    <select value={formData.unit} onChange={e => setFormData({ ...formData, unit: e.target.value })} disabled={!formData.site} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground disabled:bg-muted">
                                        <option value="">Pilih Unit...</option>
                                        {MASTER_DATA.find(s => s.name === formData.site)?.units.map(u => <option key={u} value={u}>{u}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Prioritas</label>
                                    <select value={formData.priority} onChange={e => setFormData({ ...formData, priority: e.target.value as Priority })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground">
                                        <option value="P1">P1 (Kritis)</option>
                                        <option value="P2">P2 (Medium)</option>
                                        <option value="P3">P3 (Low)</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Lokasi Spesifik</label>
                                    <input type="text" value={formData.location} onChange={e => setFormData({ ...formData, location: e.target.value })} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground" placeholder="Contoh: Lantai 2" />
                                </div>
                            </div>

                            {/* Baris 4: PIC (Auto-fill) */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">Nama PIC (Auto)</label>
                                    <input type="text" value={formData.picName} readOnly className="w-full px-3 py-2 border-2 border-border bg-muted rounded-lg text-sm text-muted-foreground" />
                                </div>
                                <div>
                                    <label className="block text-xs font-semibold text-muted-foreground mb-1">No WA PIC (Auto)</label>
                                    <input type="text" value={formData.picWa} readOnly className="w-full px-3 py-2 border-2 border-border bg-muted rounded-lg text-sm text-muted-foreground" />
                                </div>
                            </div>

                            {/* Baris 5: Deskripsi & Catatan */}
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Deskripsi Kendala *</label>
                                <textarea value={formData.description} onChange={e => setFormData({ ...formData, description: e.target.value })} maxLength={2000} rows={3} className="w-full px-3 py-2 border-2 border-border rounded-lg text-sm outline-none focus:border-foreground resize-none"></textarea>
                                <p className="text-[10px] text-right text-muted-foreground mt-1">{formData.description.length}/2000</p>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-muted-foreground mb-1">Catatan Internal (Hanya Helpdesk/PM/Admin)</label>
                                <textarea value={formData.catatanInternal} onChange={e => setFormData({ ...formData, catatanInternal: e.target.value })} rows={2} className="w-full px-3 py-2 border-2 border-dashed border-border rounded-lg text-sm outline-none focus:border-foreground resize-none bg-yellow-50/50"></textarea>
                            </div>
                        </div>

                        {/* QUICK ACTION BUTTONS */}
                        <div className="p-5 border-t-2 border-border bg-muted rounded-b-xl">
                            <p className="text-xs font-bold text-muted-foreground uppercase mb-3">Pilih Tindakan Setelah Simpan:</p>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                <button onClick={() => handleInternalSubmit('NEW')} className="flex flex-col items-center justify-center p-3 bg-card border-2 border-border hover:border-foreground rounded-lg transition-colors group">
                                    <CheckCircle2 className="w-5 h-5 text-muted-foreground group-hover:text-foreground mb-1" />
                                    <span className="text-xs font-bold text-muted-foreground">Simpan NEW</span>
                                </button>
                                <button onClick={() => handleInternalSubmit('UNASSIGNED')} className="flex flex-col items-center justify-center p-3 bg-card border-2 border-blue-200 hover:border-blue-600 rounded-lg transition-colors group">
                                    <Send className="w-5 h-5 text-blue-600 mb-1" />
                                    <span className="text-xs font-bold text-blue-700">Eskalasi PM</span>
                                </button>
                                <button onClick={() => handleInternalSubmit('RESOLVED')} className="flex flex-col items-center justify-center p-3 bg-card border-2 border-emerald-200 hover:border-emerald-600 rounded-lg transition-colors group">
                                    <CheckCircle2 className="w-5 h-5 text-emerald-600 mb-1" />
                                    <span className="text-xs font-bold text-emerald-700">Selesai Remote</span>
                                </button>
                                <button onClick={() => handleInternalSubmit('VOID')} className="flex flex-col items-center justify-center p-3 bg-card border-2 border-red-200 hover:border-red-600 rounded-lg transition-colors group">
                                    <AlertTriangle className="w-5 h-5 text-red-600 mb-1" />
                                    <span className="text-xs font-bold text-red-700">Void</span>
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}