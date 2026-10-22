import { createPortal } from 'react-dom'
import { Check, X } from 'lucide-react'

export type ReviewRow = { label: string; value: string; multiline?: boolean }

export default function ReviewConfirm({
    title, rows, confirmLabel, onConfirm, onClose, busy = false,
}: {
    title: string
    rows: ReviewRow[]
    confirmLabel: string
    onConfirm: () => void
    onClose: () => void
    busy?: boolean
}) {
    return createPortal((
        <div className="fixed inset-0 bg-black/80 z-[140] flex items-center justify-center p-4 fade-in">
            <div className="bg-card w-full max-w-md rounded-lg border-2 border-border p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                    <h3 className="text-lg font-bold flex items-center gap-2"><Check className="w-5 h-5" /> {title}</h3>
                    <button onClick={onClose} disabled={busy} className="p-2 bg-foreground text-background rounded-[3px] hover:opacity-80 transition-opacity disabled:opacity-50"><X className="w-5 h-5" /></button>
                </div>
                <div className="space-y-3">
                    {rows.filter((r) => r.value.trim()).map((r) => (
                        <div key={r.label} className="bg-muted p-4 rounded-lg border border-border">
                            <p className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">{r.label}</p>
                            <p className={`text-sm text-foreground ${r.multiline ? 'whitespace-pre-line' : 'font-medium'}`}>{r.value}</p>
                        </div>
                    ))}
                </div>
                <div className="flex gap-3 pt-4">
                    <button onClick={onClose} disabled={busy} className="flex-1 py-2 bg-muted rounded font-medium disabled:opacity-50">Batal</button>
                    <button onClick={onConfirm} disabled={busy} className="flex-1 py-2 bg-foreground text-primary-foreground rounded font-bold disabled:opacity-50">{busy ? 'Memproses...' : confirmLabel}</button>
                </div>
            </div>
        </div>
    ), document.body)
}
