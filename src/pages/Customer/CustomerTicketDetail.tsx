import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useTickets } from '../../context/TicketContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'
import { Badge } from '../../components/Badge'
import { ArrowLeft, Star, MessageSquare } from 'lucide-react'
import { toast } from 'sonner'

export default function CustomerTicketDetail() {
    const { ticketCode } = useParams<{ ticketCode: string }>()
    const navigate = useNavigate()
    const { user } = useAuth()
    const { tickets } = useTickets()
    const ticket = tickets.find(t => t.code === ticketCode)

    const [rating, setRating] = useState(0)
    const [review, setReview] = useState('')
    const [existingRating, setExistingRating] = useState<number | null>(null)
    const [existingReview, setExistingReview] = useState<string | null>(null)
    const [isSubmitting, setIsSubmitting] = useState(false)

    useEffect(() => {
        if (!ticket) return
        setExistingRating(ticket.rating ?? null)
        setExistingReview(ticket.review ?? null)
    }, [ticket])

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
                <button onClick={() => navigate('/customer')} className="mt-4 text-sm underline">Kembali</button>
            </div>
        )
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <button onClick={() => navigate('/customer')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition">
                <ArrowLeft className="h-4 w-4" /> Kembali
            </button>

            <div className="bg-card border border-border rounded-lg p-6">
                <div className="flex items-center gap-3 mb-4">
                    <h1 className="text-xl font-display font-bold font-mono">{ticket.code}</h1>
                    <Badge status={ticket.status} />
                    {ticket.priority && <Badge priority={ticket.priority} />}
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                    <div><span className="text-muted-foreground">Site: </span>{ticket.site}</div>
                    <div><span className="text-muted-foreground">Unit: </span>{ticket.unit || '-'}</div>
                    <div><span className="text-muted-foreground">Dibuat: </span>{new Date(ticket.createdAt).toLocaleString('id-ID')}</div>
                    {ticket.assignedTo && <div><span className="text-muted-foreground">Teknisi: </span>{ticket.assignedTo}</div>}
                </div>
                {ticket.description && (
                    <div className="mt-4 p-3 bg-muted rounded text-sm">{ticket.description}</div>
                )}
                {ticket.frtMinutes != null && (
                    <div className="mt-4 text-xs text-muted-foreground">
                        FRT: <span className="font-mono text-blue-600">{ticket.frtMinutes} menit</span>
                    </div>
                )}
            </div>

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
                        className="w-full px-3 py-2 rounded-[3px] border border-border bg-background text-sm resize-none mb-3"
                        placeholder="Tulis ulasan Anda (opsional)..." />
                    <button onClick={handleSubmitRating} disabled={rating === 0 || isSubmitting}
                        className="px-4 py-2 bg-foreground text-background rounded-[3px] text-sm font-semibold hover:opacity-90 transition disabled:opacity-50">
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
        </div>
    )
}
