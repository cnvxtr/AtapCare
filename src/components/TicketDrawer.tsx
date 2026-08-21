import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { ChevronLeft, ChevronRight, Download, FileText, Image, MapPin, X } from 'lucide-react'
import { Badge } from './Badge'
import { resolvePhotos } from '../services/photoService'
import { getTicketGps, type GpsPoint } from '../services/ticketService'
import { reverseGeocode } from '../lib/geocode'
import { OrderTracking } from './ui/order-tracking'

const GpsContext = createContext<{ locationNames?: Record<string, string>; gps?: GpsPoint[] }>({})

export type DrawerTab = 'detail' | 'timeline'

const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'detail', label: 'Detail' },
    { id: 'timeline', label: 'Timeline' },
]

interface TicketDrawerProps {
    onClose: () => void
    code: string
    ticketId?: string
    status: string
    priority?: string
    frtMinutes?: number | null
    createdAt: string
    activeTab: DrawerTab
    onTabChange: (t: DrawerTab) => void
    activities?: { timestamp: string; user: string; action: string; details?: string }[]
    footer?: ReactNode
    children: ReactNode
    duplicateCode?: string
}

export default function TicketDrawer({ onClose, code, ticketId, status, priority, frtMinutes, createdAt, activeTab, onTabChange, activities, footer, children, duplicateCode }: TicketDrawerProps) {
    const [gps, setGps] = useState<GpsPoint[]>([])
    const [locationNames, setLocationNames] = useState<Record<string, string>>({})
    const resolvedAt = ['RESOLVED', 'CLOSED'].includes(status)
        ? [...(activities ?? [])].reverse().find(a => a.action === 'Tugas diselesaikan')?.timestamp
        : undefined

    useEffect(() => {
        if (activeTab !== 'timeline') return
        let mounted = true
        getTicketGps(code)
            .then((points) => { if (mounted) setGps(points) })
            .catch(() => {})
        return () => { mounted = false }
    }, [activeTab, code])

    useEffect(() => {
        if (!gps.length) return
        let mounted = true
        ;(async () => {
            for (const p of gps) {
                const name = await reverseGeocode(p.lat, p.lon)
                if (mounted) setLocationNames(prev => ({ ...prev, [p.phase]: name }))
            }
        })()
        return () => { mounted = false }
    }, [gps])
    return createPortal(
        <div className="fixed inset-0 bg-black/80 z-[100] flex justify-end animate-[fade-in_0.2s_ease]" onClick={onClose}>
            <div className="w-full max-w-2xl h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col drawer-enter" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl px-4 py-2.5">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[9px] font-mono uppercase tracking-widest text-muted-foreground mb-0.5">ID Tiket</p>
                            <div className="flex flex-wrap items-center gap-1.5">
                                <h3 className="text-sm font-bold text-foreground font-mono tracking-tight">{code}</h3>
                                {priority && <Badge type="priority" value={priority} />}
                                <Badge type="status" value={status} />
                                {duplicateCode && (
                                    <span className="px-1.5 py-0.5 rounded-[5px] bg-amber-100 text-amber-700 text-[10px] font-bold whitespace-nowrap">Duplikat dari {duplicateCode}</span>
                                )}
                                {frtMinutes != null && (
                                    <span className="px-1.5 py-0.5 rounded-[5px] bg-blue-50 text-blue-700 text-[10px] font-bold whitespace-nowrap border border-blue-200">FRT: {frtMinutes}m</span>
                                )}
                            </div>
                            <p className="mt-1 font-mono text-[11px] text-muted-foreground">
                                {resolvedAt ? `${formatWIB(createdAt)} - ${formatWIB(resolvedAt)}` : formatWIB(createdAt)}
                            </p>
                        </div>
                        <button onClick={onClose} className="p-1.5 bg-foreground text-background rounded-[5px] hover:opacity-80 transition-opacity" aria-label="Tutup">
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                </div>

                <div className="px-3 pt-1 pb-3 border-b border-border">
                    <div className="bg-card p-1 rounded-[5px] border border-border flex gap-1">
                        {TABS.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => onTabChange(tab.id)}
                                className={`flex-1 px-3 py-2 text-[11px] font-semibold uppercase tracking-wider font-mono rounded-[5px] transition ${activeTab === tab.id ? 'bg-foreground text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-accent hover:text-foreground'}`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    {activeTab === 'timeline' && gps.length > 0 && (
                        <div className="mb-4 space-y-1.5 rounded-[5px] border border-border bg-muted/40 p-3">
                            {(['start', 'end'] as const).map((phase) => {
                                const p = gps.find((g) => g.phase === phase)
                                if (!p) return null
                                return (
                                    <div key={phase} className="flex items-start gap-2 text-xs text-muted-foreground">
                                        <MapPin className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                                        <div>
                                            <span className="uppercase font-mono">{phase === 'start' ? 'Mulai' : 'Selesai'}:</span>
                                            <span className="text-foreground ml-1">{locationNames[phase] ?? `${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`}</span>
                                            <span className="ml-1">· {formatWIB(p.captured_at)}</span>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    <GpsContext.Provider value={{ locationNames, gps }}>
                        {children}
                    </GpsContext.Provider>
                    {activeTab === 'detail' && activities && <PhotoGallery items={activities} status={status} />}
                </div>

                {footer && <div className="sticky bottom-0 z-10 bg-card/80 backdrop-blur-xl border-t border-border p-4 space-y-2.5">{footer}</div>}
            </div>
        </div>,
        document.body
    )
}

function PhotoLightbox({ images, index, onClose, titles }: { images: string[]; index: number; onClose: () => void; titles?: string[] }) {
    const [current, setCurrent] = useState(index)
    const hasPrev = current > 0
    const hasNext = current < images.length - 1
    const multiple = images.length > 1
    const currentTitle = titles?.[current]

    useEffect(() => {
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') onClose()
            if (multiple && e.key === 'ArrowLeft' && hasPrev) setCurrent(i => i - 1)
            if (multiple && e.key === 'ArrowRight' && hasNext) setCurrent(i => i + 1)
        }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose, multiple, hasPrev, hasNext])

    return createPortal(
        <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease]" onClick={onClose}>
            <button onClick={(e) => { e.stopPropagation(); downloadFromUrl(images[current], currentTitle || `foto-${current + 1}.jpg`) }} className="absolute top-4 right-4 p-2 rounded-[5px] bg-foreground text-background hover:opacity-80 transition z-10" aria-label="Download">
                <Download className="w-5 h-5" />
            </button>
            {multiple && hasPrev && (
                <button onClick={(e) => { e.stopPropagation(); setCurrent(i => i - 1) }} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-[5px] bg-foreground/80 text-primary-foreground hover:bg-foreground transition z-10" aria-label="Foto sebelumnya">
                    <ChevronLeft className="w-5 h-5" />
                </button>
            )}
            {multiple && hasNext && (
                <button onClick={(e) => { e.stopPropagation(); setCurrent(i => i + 1) }} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-[5px] bg-foreground/80 text-primary-foreground hover:bg-foreground transition z-10" aria-label="Foto berikutnya">
                    <ChevronRight className="w-5 h-5" />
                </button>
            )}
            <div className="relative inline-block" onClick={(e) => e.stopPropagation()}>
                <img src={images[current]} alt={currentTitle || `Preview foto ${current + 1}`} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-border select-none" />
                <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-[5px] bg-foreground text-background hover:opacity-80 transition z-10" aria-label="Tutup">
                    <X className="w-4 h-4" />
                </button>
            </div>
            {(multiple || currentTitle) && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-foreground/80 text-primary-foreground font-mono text-xs flex items-center gap-2">
                    {currentTitle && <span className="truncate max-w-[200px]">{currentTitle}</span>}
                    {currentTitle && multiple && <span>·</span>}
                    {multiple && <span>{current + 1} / {images.length}</span>}
                </div>
            )}
        </div>,
        document.body
    )
}

// Data URL (portal) atau path storage (ticket-photos/guest/... / {kode tiket}/{uid}.{ext}).
const FILE_TOKEN_RE = /(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+|(?:ticket-photos\/)?[A-Za-z0-9-]+\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)?\.\w+)/g
const IMAGE_EXTS = new Set(['jpg', 'jpeg', 'png', 'webp'])

async function downloadFromUrl(url: string, filename: string) {
    try {
        const res = await fetch(url)
        const blob = await res.blob()
        const a = document.createElement('a')
        a.href = URL.createObjectURL(blob)
        a.download = filename
        a.click()
        URL.revokeObjectURL(a.href)
    } catch { window.open(url, '_blank') }
}

export function isFileToken(s: string): boolean {
    return /^(?:data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+|(?:ticket-photos\/)?[A-Za-z0-9-]+\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)?\.\w+)$/.test(s)
}

export function isImageFileByPath(path: string): boolean {
    if (path.startsWith('data:image')) return true
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    return IMAGE_EXTS.has(ext)
}

export function getFileExtLabel(path: string): string {
    if (path.startsWith('data:image')) return 'Gambar'
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    const labels: Record<string, string> = { pdf: 'PDF', doc: 'DOC', docx: 'DOCX', xls: 'XLS', xlsx: 'XLSX', ppt: 'PPT', pptx: 'PPTX', txt: 'TXT', csv: 'CSV', zip: 'ZIP', rar: 'RAR', mp4: 'MP4', mov: 'MOV', webm: 'WebM' }
    return labels[ext] ?? (ext.toUpperCase() || 'File')
}

function getFileIcon(path: string): React.ReactNode {
    const ext = path.split('.').pop()?.toLowerCase() ?? ''
    if (['jpg', 'jpeg', 'png', 'webp'].includes(ext)) return <Image className="h-6 w-6 text-blue-500" />
    if (ext === 'pdf') return <FileText className="h-6 w-6 text-red-500" />
    if (['doc', 'docx'].includes(ext)) return <FileText className="h-6 w-6 text-blue-600" />
    if (['xls', 'xlsx', 'csv'].includes(ext)) return <FileText className="h-6 w-6 text-green-600" />
    if (['ppt', 'pptx'].includes(ext)) return <FileText className="h-6 w-6 text-orange-500" />
    if (['zip', 'rar'].includes(ext)) return <FileText className="h-6 w-6 text-purple-500" />
    if (['mp4', 'mov', 'webm'].includes(ext)) return <FileText className="h-6 w-6 text-pink-500" />
    return <FileText className="h-6 w-6 text-muted-foreground" />
}

// Resolusi satu batch nilai foto → URL tampil (data URL tetap; path jadi signed URL).
function usePhotoResolver(tokens: string[]): Record<string, string> {
    const [map, setMap] = useState<Record<string, string>>({})
    const key = tokens.join('\u0000')
    useEffect(() => {
        let active = true
        resolvePhotos(tokens).then((m) => { if (active) setMap(m) })
        return () => { active = false }
    }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
    return map
}

// Di Timeline & Activity, foto ditampilkan sebagai label yang bisa diklik (bukan <img> inline)
// agar baris tetap ringan; foto penuh muncul lewat lightbox saat diklik.
export function DetailsText({ text }: { text?: string }) {
    const [preview, setPreview] = useState<{ images: string[]; index: number; titles?: string[] } | null>(null)
    const parts = useMemo(() => text?.split(FILE_TOKEN_RE) ?? [], [text])
    const tokens = parts.filter(isFileToken)
    const resolved = usePhotoResolver(tokens)
    if (!text) return null
    const imageTokens = tokens.filter(t => isImageFileByPath(t))
    const allUrls = tokens.map(t => resolved[t]).filter(Boolean) as string[]
    let count = 0
    return (
        <>
            <span className="break-words">
                {parts.map((p, i) =>
                    isFileToken(p)
                        ? isImageFileByPath(p)
                            ? <button key={i} type="button" onClick={() => { const u = resolved[p]; if (u) setPreview({ images: imageTokens.map(t => resolved[t]).filter(Boolean) as string[], index: imageTokens.map(t => resolved[t]).filter(Boolean).indexOf(u) as number }) }} className="mt-1 mr-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"><Image className="w-3 h-3" />Foto {++count}</button>
                            : (() => { const u = resolved[p]; const name = p.split('/').pop() ?? 'file'; return u ? <a key={i} href={u} target="_blank" rel="noopener" className="mt-1 mr-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition">{getFileIcon(p)}{name}</a> : null })()
                        : <span key={i}>{p}</span>
                )}
            </span>
            {preview && <PhotoLightbox images={preview.images} index={preview.index} onClose={() => setPreview(null)} titles={preview.titles} />}
        </>
    )
}

export function TicketTimeline({ items, isFinal }: { items: { timestamp: string; action: string; details?: string }[]; isFinal?: boolean }) {
    const { locationNames, gps } = useContext(GpsContext)
    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground italic">Belum ada aktivitas.</p>
    }
    const sorted = items.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    const steps = sorted.map((act, idx) => {
        let { action, details } = sanitizeTimeline(act.action, act.details)
        if (locationNames && gps) {
            if (action === 'Pekerjaan dimulai') {
                const p = gps.find(g => g.phase === 'start')
                const loc = locationNames['start']
                if (p && loc) details = `lokasi: ${loc}\n(${p.lat.toFixed(5)}, ${p.lon.toFixed(5)})`
            }
            if (action === 'Tugas diselesaikan') {
                const p = gps.find(g => g.phase === 'end')
                const loc = locationNames['end']
                if (p && loc) details = `lokasi: ${loc}\n(${p.lat.toFixed(5)}, ${p.lon.toFixed(5)})`
            }
        }
        return {
            name: action,
            timestamp: formatWIB(act.timestamp),
            isCompleted: idx > 0 || !!isFinal,
            details: details && <DetailsText text={details} />,
        }
    })
    return <OrderTracking steps={steps} />
}

// Sanitasi tampilan timeline agar tidak memuat nama/role orang (mis. "Tiket ditugaskan
// ke Rahma" → "…teknisi", baris "Pendukung: Hilman" dihapus). Data mentah di DB tetap
// utuh untuk audit — hanya render yang dibersihkan.
export function sanitizeTimeline(action: string, details?: string): { action: string; details?: string } {
    let a = action
    if (a.startsWith('Tiket ditugaskan ke')) a = 'Tiket ditugaskan ke teknisi'
    if (a.startsWith('Tiket dieskalasi ke PM Lead')) a = 'Tiket dieskalasi'
    let d = details
    if (d) {
        d = d.replace(/^Pendukung:\s*.+\n?/gm, '').replace(/\n+$/, '') || undefined
    }
    return { action: a, details: d }
}

export function parseDescription(desc?: string): { jabatan?: string; waPelapor?: string; deskripsi: string } {
    if (!desc) return { deskripsi: '-' }
    const jabatan = desc.match(/^Jabatan:\s*(.+)$/m)?.[1]?.trim()
    const waPelapor = desc.match(/^WA Pelapor:\s*(.+)$/m)?.[1]?.trim()
    const deskripsi = desc
        .replace(/^Jabatan:\s*.+\n?/m, '')
        .replace(/^WA Pelapor:\s*.+\n?/m, '')
        .replace(/^\n+/, '')
        .trim() || '-'
    return { jabatan, waPelapor, deskripsi }
}

export function formatWIB(iso: string): string {
    return new Intl.DateTimeFormat('id-ID', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
        timeZone: 'Asia/Jakarta',
    }).format(new Date(iso)) + ' WIB'
}

// ponytail: jam operasional 08.00–17.00 WIB hardcode; sumber konfigurasi SLA Admin belum ada,
// jadi Teknisi & PM berbagi helper ini dengan angka yang sama persis (BR 3.2.2 / 3.3.2).
export function isScheduleOvertime(jadwal?: string): boolean {
    if (!jadwal) return false
    const d = new Date(jadwal.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return false
    if ([0, 6].includes(d.getDay())) return true
    const mins = d.getHours() * 60 + d.getMinutes()
    return mins < 8 * 60 || mins >= 17 * 60
}

export function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="bg-muted/60 p-4 rounded-lg border border-border">
            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{label}</p>
            <p className="text-sm whitespace-pre-wrap">{value}</p>
        </div>
    )
}

export function TicketDescription({ description }: { description?: string }) {
    const { jabatan, waPelapor, deskripsi } = parseDescription(description)
    return (
        <div className="space-y-4">
            {(jabatan || waPelapor) && (
                <div className="grid grid-cols-2 gap-4">
                    {jabatan && <InfoCard label="Jabatan" value={jabatan} />}
                    {waPelapor && <InfoCard label="WA Pelapor" value={waPelapor} />}
                </div>
            )}
            <InfoCard label="Deskripsi Kendala" value={deskripsi} />
        </div>
    )
}

// Informasi penugasan diekstrak dari aktivitas terbaru, bukan kolom terstruktur,
// karena jadwal hanya ditulis sebagai detail aktivitas oleh alur assign.
export function getAssignmentInfo(items: { action: string; details?: string }[]): { teknisi?: string; jadwal?: string } {
    for (const act of [...items].reverse()) {
        const detail = act.details || ''
        if (act.action.startsWith('Tiket ditugaskan ke')) {
            const jadwal = detail.match(/Jadwal:\s*(.+)/)?.[1]
            return { teknisi: act.action.replace('Tiket ditugaskan ke', '').trim(), jadwal }
        }
        if (detail.startsWith('Ditugaskan ke')) {
            const jadwal = detail.match(/Jadwal:\s*(.+)/)?.[1]
            const teknisi = detail.match(/^Ditugaskan ke (.+?)\.(?:\s*Jadwal:)?/)?.[1]?.trim()
            return { teknisi, jadwal }
        }
        if (detail.startsWith('Jadwal:')) {
            return { jadwal: detail.match(/Jadwal:\s*(.+)/)?.[1] }
        }
    }
    return {}
}

export function formatJadwal(jadwal: string): string {
    const [tanggal, jam] = jadwal.split(' ')
    const d = new Date(`${tanggal}T${jam}:00`)
    const tgl = d.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
    return `${tgl} - ${jam}`
}

export function AssignmentCard({ items }: { items: { action: string; details?: string }[] }) {
    const { teknisi, jadwal } = getAssignmentInfo(items)
    if (!teknisi && !jadwal) return null
    return (
        <>
            <div className="grid grid-cols-2 gap-4">
                {teknisi && <div className="bg-muted p-4 rounded-lg border border-border"><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Ditugaskan ke</p><p className="font-medium text-sm">{teknisi}</p></div>}
                {jadwal && <div className="bg-muted p-4 rounded-lg border border-border"><p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Dijadwalkan</p><p className="font-medium text-sm">{formatJadwal(jadwal)}</p></div>}
            </div>
            <div className="border-t border-border" />
        </>
    )
}

const PHOTO_SRC_RE = FILE_TOKEN_RE

function extractAttachments(items: { timestamp: string; action: string; details?: string }[]): { src: string; when: string }[] {
    const all: { src: string; when: string }[] = []
    for (const act of items) {
        if (!act.details) continue
        for (const m of act.details.matchAll(PHOTO_SRC_RE)) {
            all.push({ src: m[0], when: act.timestamp })
        }
    }
    return all
}

// Galeri lampiran: foto (data URL / path gambar) ditampilkan sebagai thumbnail grid
// yang bisa diklik via lightbox; file non-gambar ditampilkan sebagai kartu dengan
// nama file & tombol download. Semua lampiran dipindai dari detail aktivitas tiket.
export function PhotoGallery({ items, status }: { items: { timestamp: string; action: string; details?: string }[]; status?: string }) {
    const all = extractAttachments(items)
    const photos = all.filter(p => isImageFileByPath(p.src))
    const files = all.filter(p => !isImageFileByPath(p.src))
    const resolved = usePhotoResolver(all.map((p) => p.src))
    const [preview, setPreview] = useState<{ images: string[]; index: number; titles?: string[] } | null>(null)

    const isClientPhoto = (src: string) => src.startsWith('data:image') || src.startsWith('ticket-photos/guest/')
    const clientPhotos = photos.filter((p) => isClientPhoto(p.src))
    const internalPhotos = photos.filter((p) => !isClientPhoto(p.src))

    const isClosed = status === 'RESOLVED' || status === 'CLOSED'
    const completionAct = isClosed ? items.find(a => a.details?.startsWith('Selesai')) : null
    const completionParts = completionAct?.details?.split('|').map(s => s.trim()).filter(Boolean) ?? []
    const catatan = completionParts[0]?.replace(/^Selesai:\s*/, '').replace(/^Selesai$/, '')
    const spareItem = completionParts.find(p => p.startsWith('Serial Number:')) ?? completionParts.find(p => p.startsWith('Sparepart:'))
    const isSerial = !!completionParts.find(p => p.startsWith('Serial Number:'))
    const sparepart = spareItem ? spareItem.slice(spareItem.indexOf(':') + 1).trim() : undefined

    const clientReady = clientPhotos.map((p) => ({ ...p, url: resolved[p.src] })).filter((p) => p.url)
    const internalReady = internalPhotos.map((p) => ({ ...p, url: resolved[p.src] })).filter((p) => p.url)
    const filesReady = files.map((p) => ({ ...p, url: resolved[p.src] })).filter((p) => p.url)

    const thumbs = (list: { url: string; src: string }[], open: (images: string[], titles: string[]) => void) => (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
            {list.map((p, i) => {
                const name = p.src.split('/').pop() ?? 'file'
                return (
                    <button
                        key={i}
                        type="button"
                        onClick={() => {
                            const titles = list.map(r => (r.src.split('/').pop() ?? 'file'))
                            open(list.map(r => r.url!), titles)
                        }}
                        className="aspect-square rounded-lg overflow-hidden border border-border bg-background hover:opacity-90 transition relative"
                        aria-label={`Lihat ${name}`}
                    >
                        <img src={p.url} alt={name} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                )
            })}
        </div>
    )

    const hasClient = clientReady.length > 0
    const hasTeknisi = internalReady.length > 0 || filesReady.length > 0 || catatan || sparepart
    if (!hasClient && !hasTeknisi) return null

    return (
        <>
            {hasClient && (
                <div className="mt-4 bg-muted/60 border border-border rounded-lg p-4">
                    <div className="flex items-center gap-2 mb-3">
                        <Image className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Kendala Pelanggan</h4>
                    </div>
                    {thumbs(clientReady, (images, titles) => setPreview({ images, index: 0, titles }))}
                </div>
            )}
            {hasTeknisi && (
                <div className={`${hasClient ? 'mt-3' : 'mt-4'} bg-muted/60 border border-border rounded-lg p-4`}>
                    <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-muted-foreground" />
                        <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Dokumentasi</h4>
                    </div>
                    {internalReady.length > 0 && (
                        <div className="mb-3">{thumbs(internalReady, (images, titles) => setPreview({ images, index: 0, titles }))}</div>
                    )}
                    {filesReady.length > 0 && (
                        <div className="grid grid-cols-1 gap-2 mb-3">
                            {filesReady.map((p, i) => {
                                const name = p.src.split('/').pop() ?? 'file'
                                return (
                                    <div key={i} className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border">
                                        <div className="flex items-center gap-2 min-w-0">
                                            {getFileIcon(p.src)}
                                            <span className="text-xs font-mono truncate">{name}</span>
                                        </div>
                                        <button onClick={() => downloadFromUrl(p.url!, name)} className="p-1.5 rounded hover:bg-muted transition shrink-0" aria-label={`Download ${name}`}>
                                            <Download className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground" />
                                        </button>
                                    </div>
                                )
                            })}
                        </div>
                    )}
                    {catatan && (
                        <div className="bg-background border border-border rounded-lg p-3 mb-2">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">Catatan Hasil</p>
                            <p className="text-sm text-foreground">{catatan}</p>
                        </div>
                    )}
                    {sparepart && (
                        <div className="bg-background border border-border rounded-lg p-3 mb-2">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{isSerial ? 'Serial Number' : 'Sparepart'}</p>
                            <p className="text-sm text-foreground">{sparepart}</p>
                        </div>
                    )}
                </div>
            )}
            {preview && <PhotoLightbox images={preview.images} index={preview.index} onClose={() => setPreview(null)} titles={preview.titles} />}
        </>
    )
}
