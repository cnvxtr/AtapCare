import { createPortal } from 'react-dom'
import { AlertTriangle } from 'lucide-react'

// Konfirmasi aksi destruktif. Pola overlay sama dgn ReviewConfirm (z-[140])
// supaya tetap di atas sheet notifikasi (z-[56]) maupun dropdown (z-50).
export default function ConfirmDialog({
    title, message, confirmLabel = 'Hapus', danger = true, onConfirm, onClose, busy = false,
}: {
    title: string
    message?: string
    confirmLabel?: string
    danger?: boolean
    onConfirm: () => void
    onClose: () => void
    busy?: boolean
}) {
    return createPortal((
        <div className="fixed inset-0 bg-black/80 z-[140] flex items-center justify-center p-4 fade-in pointer-events-auto" onClick={onClose}>
            <div className="bg-card w-full max-w-sm rounded-lg border-2 border-border p-6" onClick={(e) => e.stopPropagation()}>
                <h3 className="text-lg font-bold flex items-center gap-2 mb-2">
                    <AlertTriangle className={`w-5 h-5 ${danger ? 'text-red-600' : ''}`} /> {title}
                </h3>
                {message && <p className="text-sm text-muted-foreground">{message}</p>}
                <div className="flex gap-3 pt-5">
                    <button onClick={onClose} disabled={busy} className="flex-1 py-2 bg-muted rounded font-medium disabled:opacity-50">Batal</button>
                    <button
                        onClick={onConfirm}
                        disabled={busy}
                        className={`flex-1 py-2 rounded font-bold disabled:opacity-50 ${danger ? 'bg-red-600 text-white hover:bg-red-700' : 'bg-foreground text-primary-foreground'} transition-colors`}
                    >
                        {busy ? 'Memproses...' : confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    ), document.body)
}
