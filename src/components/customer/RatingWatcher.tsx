import { useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { Star, X } from 'lucide-react'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { useTickets, type Ticket } from '../../context/TicketContext'
import { supabase } from '../../lib/supabase'

// Popup rating global untuk customer: muncul otomatis di halaman mana pun saat
// tiket jadi CLOSED & belum dirating (data dari useTickets yang Realtime), tanpa
// harus klik tiket dulu. "Nanti Saja" menahan tiket itu sampai halaman di-reload.
export default function RatingWatcher() {
  const { user } = useAuth()
  const { tickets } = useTickets()
  const [dismissed, setDismissed] = useState<Set<string>>(new Set())

  const target = useMemo(() => {
    if (user?.role !== 'customer') return null
    return tickets
      .filter(t => t.status === 'CLOSED' && t.rating == null && !dismissed.has(t.id))
      .sort((a, b) => new Date(b.closedAt || b.createdAt).getTime() - new Date(a.closedAt || a.createdAt).getTime())[0] ?? null
  }, [tickets, dismissed, user?.role])

  if (!target) return null

  const dismiss = () => setDismissed(prev => new Set(prev).add(target.id))

  return <RatingModal key={target.id} ticket={target} onClose={dismiss} />
}

function RatingModal({ ticket, onClose }: { ticket: Ticket; onClose: () => void }) {
  const [rating, setRating] = useState(0)
  const [review, setReview] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (rating === 0) return
    setIsSubmitting(true)
    const { error } = await supabase.rpc('submit_rating', {
      p_ticket_id: ticket.id,
      p_rating: rating,
      p_review: review.trim() || null,
    })
    setIsSubmitting(false)
    if (error) { toast.error('Gagal mengirim rating.'); return }
    toast.success('Rating berhasil dikirim!')
    onClose()
  }

  return createPortal(
    <div className="fixed inset-0 z-[120] bg-black/80 flex items-center justify-center p-4 animate-[fade-in_0.2s_ease]" onClick={onClose}>
      <div className="bg-card w-full max-w-sm rounded-lg border border-border p-6" onClick={e => e.stopPropagation()}>
        <div className="flex items-start justify-between mb-4">
          <h2 className="font-display font-bold flex items-center gap-2">
            <Star className="h-4 w-4" /> Beri Penilaian
          </h2>
          <button onClick={onClose} className="p-1.5 bg-foreground text-background rounded-[3px] hover:opacity-80 transition" aria-label="Tutup">
            <X className="w-4 h-4" />
          </button>
        </div>
        <p className="text-sm text-muted-foreground mb-3">Seberapa baik pelayanan yang Anda terima untuk tiket {ticket.code}?</p>
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
          placeholder="Tulis ulasan Anda..." />
        <button onClick={handleSubmit} disabled={rating === 0 || isSubmitting}
          className="w-full py-2 bg-foreground text-background rounded-[5px] text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
          {isSubmitting ? 'Mengirim...' : 'Kirim Penilaian'}
        </button>
        <button onClick={onClose} className="w-full py-2 mt-2 bg-muted text-foreground rounded-[5px] text-sm font-medium hover:opacity-90 transition">
          Nanti Saja
        </button>
      </div>
    </div>,
    document.body,
  )
}