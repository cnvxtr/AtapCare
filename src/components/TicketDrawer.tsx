import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Image, X } from 'lucide-react'
import { Badge } from './Badge'

export type DrawerTab = 'detail' | 'timeline' | 'activity'

const TABS: { id: DrawerTab; label: string }[] = [
    { id: 'detail', label: 'Detail' },
    { id: 'timeline', label: 'Timeline' },
    { id: 'activity', label: 'Activity' },
]

interface TicketDrawerProps {
    onClose: () => void
    code: string
    status: string
    priority?: string
    createdAt: string
    activeTab: DrawerTab
    onTabChange: (t: DrawerTab) => void
    activities?: { timestamp: string; user: string; action: string; details?: string }[]
    footer?: ReactNode
    children: ReactNode
}

export default function TicketDrawer({ onClose, code, status, priority, createdAt, activeTab, onTabChange, activities, footer, children }: TicketDrawerProps) {
    return createPortal(
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex justify-end animate-[fade-in_0.2s_ease]" onClick={onClose}>
            <div className="w-full max-w-2xl h-full bg-card/95 backdrop-blur-xl border-l border-border shadow-2xl flex flex-col drawer-enter" onClick={(e) => e.stopPropagation()}>
                <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border px-5 py-4">
                    <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">ID Tiket</p>
                            <div className="flex flex-wrap items-center gap-2">
                                <h3 className="text-xl font-bold text-foreground font-mono tracking-tight">{code}</h3>
                                {priority && <Badge type="priority" value={priority} />}
                                <Badge type="status" value={status} />
                            </div>
                            <p className="mt-2 font-mono text-xs text-muted-foreground">{formatWIB(createdAt)}</p>
                        </div>
                        <button onClick={onClose} className="p-2 rounded-md bg-foreground text-primary-foreground hover:opacity-90 transition" aria-label="Tutup">
                            <X className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                <div className="flex gap-1 px-2 pt-2 border-b border-border bg-muted/40">
                    {TABS.map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => onTabChange(tab.id)}
                            className={`flex-1 px-4 py-2.5 text-xs font-semibold uppercase tracking-wider font-mono rounded transition ${activeTab === tab.id ? 'bg-foreground text-primary-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex-1 overflow-y-auto p-5">
                    {children}
                    {activeTab === 'detail' && activities && <PhotoGallery items={activities} />}
                </div>

                {footer && <div className="sticky bottom-0 z-10 bg-card/80 backdrop-blur-xl border-t border-border p-5 space-y-3">{footer}</div>}
            </div>
        </div>,
        document.body
    )
}

function PhotoLightbox({ src, onClose }: { src: string; onClose: () => void }) {
    useEffect(() => {
        const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
        window.addEventListener('keydown', onKey)
        return () => window.removeEventListener('keydown', onKey)
    }, [onClose])

    return createPortal(
        <div className="fixed inset-0 z-[120] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-[fade-in_0.2s_ease]" onClick={onClose}>
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-lg bg-foreground text-primary-foreground hover:opacity-80 transition" aria-label="Tutup">
                <X className="w-5 h-5" />
            </button>
            <img src={src} alt="Preview foto" className="max-w-full max-h-full rounded-lg shadow-2xl border border-border" onClick={(e) => e.stopPropagation()} />
        </div>,
        document.body
    )
}

// Di Timeline & Activity, foto ditampilkan sebagai label yang bisa diklik (bukan <img> inline)
// agar baris tetap ringan; foto penuh muncul lewat lightbox saat diklik.
export function DetailsText({ text }: { text?: string }) {
    const [preview, setPreview] = useState<string | null>(null)
    if (!text) return null
    const parts = text.split(/(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+)/g)
    let count = 0
    return (
        <>
            <span className="break-words">
                {parts.map((p, i) =>
                    p.startsWith('data:image')
                        ? <button key={i} type="button" onClick={() => setPreview(p)} className="mt-1 mr-1.5 inline-flex items-center gap-1 px-2 py-0.5 rounded bg-muted border border-border text-[11px] font-mono text-muted-foreground hover:text-foreground hover:border-foreground/40 transition"><Image className="w-3 h-3" />Foto {++count}</button>
                        : <span key={i}>{p}</span>
                )}
            </span>
            {preview && <PhotoLightbox src={preview} onClose={() => setPreview(null)} />}
        </>
    )
}

export function TicketActivityLog({ items }: { items: { timestamp: string; user?: string; action: string; details?: string }[] }) {
    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground italic">Belum ada aktivitas.</p>
    }
    const sorted = items.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return (
        <div className="overflow-x-auto">
            <table className="w-full text-left min-w-[420px]">
                <thead className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground border-b border-border">
                    <tr>
                        <th className="py-2 pr-3 font-medium">Waktu</th>
                        <th className="py-2 pr-3 font-medium">Pengguna</th>
                        <th className="py-2 pr-3 font-medium">Aksi</th>
                        <th className="py-2 font-medium">Detail</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-border">
                    {sorted.map((act, idx) => (
                        <tr key={idx}>
                            <td className="py-2 pr-3 font-mono text-[11px] text-muted-foreground whitespace-nowrap">{formatWIB(act.timestamp)}</td>
                            <td className="py-2 pr-3 text-xs text-foreground whitespace-nowrap">{act.user || 'Sistem'}</td>
                            <td className="py-2 pr-3 text-xs font-medium">{act.action}</td>
                            <td className="py-2 text-xs text-muted-foreground">{act.details ? <DetailsText text={act.details} /> : '-'}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    )
}

export function TicketTimeline({ items }: { items: { timestamp: string; action: string; details?: string }[] }) {
    if (items.length === 0) {
        return <p className="text-sm text-muted-foreground italic">Belum ada aktivitas.</p>
    }
    const sorted = items.slice().sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    return (
        <div className="space-y-5 border-l border-border ml-1.5 pl-5">
            {sorted.map((act, idx) => (
                <div key={idx} className="relative">
                    <div className="absolute -left-[25px] top-1 w-2.5 h-2.5 rounded-[2px] bg-foreground ring-4 ring-muted"></div>
                    <p className="text-[11px] font-mono text-muted-foreground">{formatWIB(act.timestamp)}</p>
                    <p className="text-sm font-medium mt-0.5">{act.action}</p>
                    {act.details && <div className="text-xs text-muted-foreground mt-1"><DetailsText text={act.details} /></div>}
                </div>
            ))}
        </div>
    )
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
    const d = new Date(iso)
    const wib = new Date(d.getTime() + 7 * 60 * 60 * 1000)
    const dd = String(wib.getUTCDate()).padStart(2, '0')
    const mm = wib.toLocaleString('id-ID', { month: 'short', timeZone: 'UTC' })
    const yyyy = wib.getUTCFullYear()
    const hh = String(wib.getUTCHours()).padStart(2, '0')
    const min = String(wib.getUTCMinutes()).padStart(2, '0')
    return `${dd} ${mm} ${yyyy}, ${hh}:${min} WIB`
}

// ponytail: jam operasional 08.15–17.00 WIB hardcode; sumber konfigurasi SLA Admin belum ada,
// jadi Teknisi & PM berbagi helper ini dengan angka yang sama persis (BR 3.2.2 / 3.3.2).
export function isScheduleOvertime(jadwal?: string): boolean {
    if (!jadwal) return false
    const d = new Date(jadwal.replace(' ', 'T'))
    if (Number.isNaN(d.getTime())) return false
    if ([0, 6].includes(d.getDay())) return true
    const mins = d.getHours() * 60 + d.getMinutes()
    return mins < 8 * 60 + 15 || mins >= 17 * 60
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

const PHOTO_RE = /data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+/g

function extractPhotos(items: { timestamp: string; action: string; details?: string }[]): { src: string; when: string }[] {
    const photos: { src: string; when: string }[] = []
    for (const act of items) {
        if (!act.details) continue
        for (const m of act.details.matchAll(PHOTO_RE)) {
            photos.push({ src: m[0], when: act.timestamp })
        }
    }
    return photos
}

// Semua foto (portal client, internal, teknisi) tersimpan sebagai data URL di detail aktivitas,
// jadi galeri cukup memindai aktivitas tiket sekali dan tampil untuk semua role.
export function PhotoGallery({ items }: { items: { timestamp: string; action: string; details?: string }[] }) {
    const photos = extractPhotos(items)
    const [preview, setPreview] = useState<string | null>(null)

    if (photos.length === 0) return null

    return (
        <>
            <div className="mt-5 bg-muted/60 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                    <Image className="w-4 h-4 text-muted-foreground" />
                    <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Dokumentasi ({photos.length})</h4>
                </div>
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                    {photos.map((p, i) => (
                        <button
                            key={i}
                            type="button"
                            onClick={() => setPreview(p.src)}
                            className="aspect-square rounded-lg overflow-hidden border border-border bg-background hover:opacity-90 transition"
                            aria-label={`Lihat foto ${i + 1}`}
                        >
                            <img src={p.src} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                        </button>
                    ))}
                </div>
            </div>
            {preview && <PhotoLightbox src={preview} onClose={() => setPreview(null)} />}
        </>
    )
}
