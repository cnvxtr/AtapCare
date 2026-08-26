import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTickets } from '../../context/TicketContext'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../components/Badge'
import { ArrowLeft, Star, MessageSquare, Image, FileText, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import {
  InfoCard,
  formatWIB,
  isImageFileByPath,
  parseDescription,
} from '../../components/TicketDrawer'
import { OrderTracking } from '../../components/ui/order-tracking'
import { resolvePhotos } from '../../services/photoService'
import { getTicketGps } from '../../services/ticketService'
import { reverseGeocode } from '../../lib/geocode'
import { createPortal } from 'react-dom'

const FILE_TOKEN_RE = /(data:image\/[a-z+]+;base64,[A-Za-z0-9+/=]+|(?:ticket-photos\/)?[A-Za-z0-9-]+\/[A-Za-z0-9-]+(?:\/[A-Za-z0-9-]+)?\.\w+)/g
const PHOTO_ONLY_RE = /Foto \(\d+\):\n?([\s\S]*?)$/

function usePhotoResolver(tokens: string[]): Record<string, string> {
  const [map, setMap] = useState<Record<string, string>>({})
  const key = tokens.join('\u0000')
  useEffect(() => {
    let active = true
    resolvePhotos(tokens).then(m => { if (active) setMap(m) })
    return () => { active = false }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key])
  return map
}

function PhotoLightbox({ images, index, onClose }: { images: string[]; index: number; onClose: () => void }) {
  const [current, setCurrent] = useState(index)
  const hasPrev = current > 0
  const hasNext = current < images.length - 1
  const multiple = images.length > 1

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
      {multiple && hasPrev && (
        <button onClick={e => { e.stopPropagation(); setCurrent(i => i - 1) }} className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-2.5 rounded-[5px] bg-foreground/80 text-primary-foreground hover:bg-foreground transition z-10" aria-label="Foto sebelumnya">
          <ChevronLeft className="w-5 h-5" />
        </button>
      )}
      {multiple && hasNext && (
        <button onClick={e => { e.stopPropagation(); setCurrent(i => i + 1) }} className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-2.5 rounded-[5px] bg-foreground/80 text-primary-foreground hover:bg-foreground transition z-10" aria-label="Foto berikutnya">
          <ChevronRight className="w-5 h-5" />
        </button>
      )}
      <div className="relative inline-block" onClick={e => e.stopPropagation()}>
        <img src={images[current]} alt={`Preview foto ${current + 1}`} className="max-w-full max-h-[85vh] rounded-lg shadow-2xl border border-border select-none" />
        <button onClick={onClose} className="absolute top-2 right-2 p-2 rounded-[5px] bg-foreground text-background hover:opacity-80 transition z-10" aria-label="Tutup">
          <X className="w-4 h-4" />
        </button>
      </div>
      {multiple && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full bg-foreground/80 text-primary-foreground font-mono text-xs">
          {current + 1} / {images.length}
        </div>
      )}
    </div>,
    document.body
  )
}

const CUSTOMER_LABELS: Record<string, string> = {
  'Tiket dibuat dengan status Baru': 'Keluhan berhasil dibuat',
  'Tiket divalidasi': 'Tiket telah diterima',
  'Tiket dieskalasi ke PM Lead': 'Menunggu penugasan teknisi',
  'Tiket ditugaskan ke teknisi': 'Teknisi ditugaskan',
  'Teknisi dalam perjalanan': 'Teknisi dalam perjalanan',
  'Pekerjaan dimulai': 'Pekerjaan dimulai',
  'Tugas diselesaikan': 'Pekerjaan selesai',
  'Tiket dijeda': 'Dijeda',
  'Tiket ditutup': 'Tiket ditutup',
  'Penugasan dibatalkan': 'Penugasan dibatalkan',
}

function getClientPhotos(activities: { details?: string }[]): string[] {
  const isClient = (src: string) => src.startsWith('data:image') || src.startsWith('ticket-photos/guest/')
  return activities.flatMap(a => a.details?.match(FILE_TOKEN_RE) ?? []).filter(t => isImageFileByPath(t) && isClient(t))
}

function getTechPhotos(activities: { details?: string }[]): string[] {
  const isClient = (src: string) => src.startsWith('data:image') || src.startsWith('ticket-photos/guest/')
  return activities.flatMap(a => a.details?.match(FILE_TOKEN_RE) ?? []).filter(t => isImageFileByPath(t) && !isClient(t))
}

export default function CustomerTicketDetail() {
  const { ticketCode } = useParams<{ ticketCode: string }>()
  const navigate = useNavigate()
  const { tickets } = useTickets()
  const ticket = tickets.find(t => t.code === ticketCode)

  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [existingRating, setExistingRating] = useState<number | null>(() => ticket?.rating ?? null)
  const [existingReview, setExistingReview] = useState<string | null>(() => ticket?.review ?? null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [rootCauseMap, setRootCauseMap] = useState<Map<string, string>>(new Map())
  const [preview, setPreview] = useState<{ images: string[]; index: number } | null>(null)
  const [locationNames, setLocationNames] = useState<Record<string, string>>({})

  useEffect(() => {
    if (!ticket?.rootCauseId) return
    let active = true
    supabase.from('root_causes').select('id, name').then(({ data }) => {
      if (active && data) setRootCauseMap(new Map(data.map(r => [r.id, r.name])))
    })
    return () => { active = false }
  }, [ticket?.rootCauseId])

  // Fetch GPS + reverse geocode for timeline location names
  useEffect(() => {
    if (!ticketCode) return
    let active = true
    getTicketGps(ticketCode).then(async (points) => {
      if (!active || !points.length) return
      const names: Record<string, string> = {}
      for (const p of points) {
        names[p.phase] = await reverseGeocode(p.lat, p.lon)
      }
      if (active) setLocationNames(names)
    }).catch(() => {})
    return () => { active = false }
  }, [ticketCode])

  // Photo resolution
  const clientTokens = useMemo(() => ticket ? getClientPhotos(ticket.activities) : [], [ticket])
  const techTokens = useMemo(() => ticket ? getTechPhotos(ticket.activities) : [], [ticket])
  const clientResolved = usePhotoResolver(clientTokens)
  const techResolved = usePhotoResolver(techTokens)
  const clientUrls = useMemo(() => clientTokens.map(t => clientResolved[t]).filter(Boolean) as string[], [clientTokens, clientResolved])
  const techUrls = useMemo(() => techTokens.map(t => techResolved[t]).filter(Boolean) as string[], [techTokens, techResolved])

  // Extract completion activity photos (for riwayat status "Pekerjaan selesai" step)
  const completionPhotos = useMemo(() => {
    if (!ticket || !['RESOLVED', 'CLOSED'].includes(ticket.status)) return []
    const completionAct = [...ticket.activities].reverse().find(a => a.action === 'Tugas diselesaikan')
    if (!completionAct?.details) return []
    const match = completionAct.details.match(PHOTO_ONLY_RE)
    if (!match) return []
    const pathLines = match[1].split('\n').map(l => l.trim()).filter(l => l && isImageFileByPath(l))
    return pathLines
  }, [ticket])
  const completionPhotoResolved = usePhotoResolver(completionPhotos)
  const completionPhotoUrls = useMemo(() => completionPhotos.map(t => completionPhotoResolved[t]).filter(Boolean) as string[], [completionPhotos, completionPhotoResolved])

  // Build timeline data (reverse chronological, filtered & simplified)
  const timelineSteps = useMemo(() => {
    if (!ticket) return []
    const acts = [...ticket.activities]
      .filter(a => !a.action.startsWith('Foto keluhan')) // filter out photo activities
      .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()) // newest first

    return acts.map((act, idx) => {
      const rawAction = act.action.startsWith('Tiket ditugaskan ke') ? 'Tiket ditugaskan ke teknisi' : act.action
      const label = CUSTOMER_LABELS[rawAction] || act.action

      // Clean details: remove raw photo paths, extract useful info
      let details: string | undefined
      if (rawAction === 'Tiket ditugaskan ke teknisi' && act.details) {
        const schedule = act.details.match(/Jadwal:\s*(.+)/)?.[1]?.trim()
        const supportMatch = act.details.match(/^Pendukung:\s*(.+)$/m)
        const parts: string[] = []
        if (schedule) parts.push(`Jadwal: ${schedule}`)
        if (supportMatch?.[1]) parts.push(`Tim: ${supportMatch[1].trim()}`)
        details = parts.join('\n') || undefined
      } else if (rawAction === 'Tiket dijeda' && act.details) {
        const reason = act.details.match(/Ditunda:\s*(.+)/)?.[1]?.trim()
        details = reason || undefined
      } else if (rawAction === 'Pekerjaan dimulai') {
        details = locationNames['start'] || undefined
      } else if (rawAction === 'Tugas diselesaikan') {
        details = locationNames['end'] || undefined
      }

      return {
        name: label,
        timestamp: formatWIB(act.timestamp),
        isCompleted: idx > 0, // oldest (last) = not completed, newest = completed
        details,
        isCompletion: rawAction === 'Tugas diselesaikan',
      }
    })
  }, [ticket, locationNames])

  const handleSubmitRating = async () => {
    if (!ticket || rating === 0) return
    setIsSubmitting(true)
    const { error } = await supabase.rpc('submit_rating', {
      p_ticket_id: ticket.id,
      p_rating: rating,
      p_review: review.trim() || null,
    })
    setIsSubmitting(false)
    if (error) { toast.error('Gagal mengirim rating.'); return }
    setExistingRating(rating)
    setExistingReview(review.trim() || null)
    toast.success('Rating berhasil dikirim!')
  }

  if (!ticket) {
    return (
      <div className="max-w-2xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Tiket tidak ditemukan.</p>
        <button onClick={() => navigate('/customer')} className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-[5px] text-sm font-medium hover:opacity-90 transition">Kembali</button>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <button onClick={() => navigate('/customer')} className="inline-flex items-center gap-1.5 px-4 py-2 bg-foreground text-background rounded-[5px] text-sm font-medium hover:opacity-90 transition">
        <ArrowLeft className="h-4 w-4" /> Kembali
      </button>

      {/* Header */}
      <div className="bg-card border border-border rounded-lg p-6">
        <div className="flex items-center gap-3 mb-2">
          <h1 className="text-xl font-display font-bold font-mono">{ticket.code}</h1>
          <Badge type="status" value={ticket.status} />
          {ticket.priority && <Badge type="priority" value={ticket.priority} />}
        </div>
        <p className="font-mono text-xs text-muted-foreground mt-1">
          {formatWIB(ticket.createdAt)}
          {ticket.closedAt && ` — ${formatWIB(ticket.closedAt)}`}
        </p>
      </div>

      {/* Satu box besar: Info + Deskripsi + Foto + Hasil */}
      <div className="bg-card border border-border rounded-lg p-6 space-y-6">
        {/* Grid 2×2 — labels di dalam box (InfoCard style) */}
        {(() => {
          const { waPelapor, deskripsi } = parseDescription(ticket.description)
          return (
            <>
              <div className="grid grid-cols-2 gap-4">
                {ticket.company && <InfoCard label="Perusahaan" value={ticket.company} />}
                {ticket.site && <InfoCard label="Site" value={ticket.site} />}
                {ticket.unit && <InfoCard label="Unit" value={ticket.unit} />}
                {waPelapor && <InfoCard label="WA Pelapor" value={waPelapor} />}
              </div>
              <InfoCard label="Deskripsi Kendala" value={deskripsi || '-'} />
            </>
          )
        })()}

        {/* Foto Kendala Pelanggan */}
        {clientUrls.length > 0 && (
          <div className="bg-muted/60 border border-border rounded-lg p-4">
            <div className="flex items-center gap-2 mb-3">
              <Image className="w-4 h-4 text-muted-foreground" />
              <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Kendala Pelanggan</h4>
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {clientUrls.map((url, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPreview({ images: clientUrls, index: i })}
                  className="aspect-square rounded-lg overflow-hidden border border-border bg-background hover:opacity-90 transition"
                  aria-label={`Lihat foto ${i + 1}`}
                >
                  <img src={url} alt={`Foto ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Hasil Pekerjaan (RESOLVED/CLOSED) */}
        {['RESOLVED', 'CLOSED'].includes(ticket.status) && (
          <div className="border-t border-border pt-6">
            <p className="text-sm font-semibold text-foreground mb-3">Hasil Pekerjaan</p>

            {ticket.rootCauseId && rootCauseMap.has(ticket.rootCauseId) && (
              <InfoCard label="Root Cause" value={rootCauseMap.get(ticket.rootCauseId)!} />
            )}

            {(() => {
              const completionAct = [...ticket.activities].reverse().find(a => a.action === 'Tugas diselesaikan')
              const catatan = completionAct?.details?.split('|').map(s => s.trim()).filter(Boolean)[0]
                ?.replace(/^Selesai:\s*/, '').replace(/^Selesai$/, '')
              return catatan ? <div className="mt-3"><InfoCard label="Catatan Hasil" value={catatan} /></div> : null
            })()}

            {techUrls.length > 0 && (
              <div className="mt-4 bg-muted/60 border border-border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  <h4 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">Dokumentasi</h4>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {techUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setPreview({ images: techUrls, index: i })}
                      className="aspect-square rounded-lg overflow-hidden border border-border bg-background hover:opacity-90 transition"
                      aria-label={`Lihat foto teknisi ${i + 1}`}
                    >
                      <img src={url} alt={`Foto teknisi ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Riwayat Status — card terpisah */}
      <div className="bg-card border border-border rounded-lg p-6">
        <p className="text-sm font-semibold text-foreground mb-4">Riwayat Status</p>
        <OrderTracking
          steps={timelineSteps.map(step => ({
            name: step.name,
            timestamp: step.timestamp,
            isCompleted: step.isCompleted,
            details: step.details ? (
              step.isCompletion && completionPhotoUrls.length > 0 ? (
                <div>
                  {step.details && <p className="mb-2">{step.details}</p>}
                  <div className="grid grid-cols-3 gap-1.5">
                    {completionPhotoUrls.map((url, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => setPreview({ images: completionPhotoUrls, index: i })}
                        className="aspect-square rounded overflow-hidden border border-border hover:opacity-90 transition"
                      >
                        <img src={url} alt={`Foto hasil ${i + 1}`} className="w-full h-full object-cover" loading="lazy" />
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <p>{step.details}</p>
              )
            ) : undefined,
          }))}
        />
      </div>

      {/* Penilaian */}
      {ticket.status === 'CLOSED' && existingRating === null && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display font-bold mb-4 flex items-center gap-2">
            <Star className="h-4 w-4" /> Beri Penilaian
          </h2>
          <div className="flex gap-1 mb-4">
            {[1, 2, 3, 4, 5].map(star => (
              <button key={star} onClick={() => setRating(star)}
                className={`p-1 transition ${star <= rating ? 'text-amber-400' : 'text-muted-foreground hover:text-amber-300'}`}>
                <Star className="h-6 w-6 fill-current" />
              </button>
            ))}
          </div>
          <textarea rows={3} value={review} onChange={e => setReview(e.target.value)}
            className="w-full px-3 py-2 rounded-md border border-border bg-background text-sm resize-none mb-3"
            placeholder="Tulis ulasan Anda (opsional)..." />
          <button onClick={handleSubmitRating} disabled={rating === 0 || isSubmitting}
            className="px-4 py-2 bg-foreground text-background rounded-[5px] text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
            {isSubmitting ? 'Mengirim...' : 'Kirim Penilaian'}
          </button>
        </div>
      )}

      {existingRating !== null && (
        <div className="bg-card border border-border rounded-lg p-6">
          <h2 className="font-display font-bold mb-3 flex items-center gap-2">
            <Star className="h-4 w-4" /> Penilaian Anda
          </h2>
          <div className="flex gap-0.5 mb-2">
            {[1, 2, 3, 4, 5].map(star => (
              <Star key={star} className={`h-5 w-5 ${star <= existingRating ? 'text-amber-400 fill-current' : 'text-muted-foreground'}`} />
            ))}
          </div>
          {existingReview && (
            <p className="text-sm text-muted-foreground flex items-start gap-1.5">
              <MessageSquare className="h-3.5 w-3.5 mt-0.5 shrink-0" /> {existingReview}
            </p>
          )}
        </div>
      )}

      {preview && <PhotoLightbox images={preview.images} index={preview.index} onClose={() => setPreview(null)} />}
    </div>
  )
}
