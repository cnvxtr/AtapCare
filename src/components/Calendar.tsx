import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

const WEEKDAYS = ['Min', 'Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab']
const MONTHS = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember']

const toIso = (y: number, m: number, d: number) => `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`

export default function Calendar({ value, onChange }: { value: string; onChange: (iso: string) => void }) {
    const now = new Date()
    const [view, setView] = useState({ y: now.getFullYear(), m: now.getMonth() })
    const todayIso = toIso(now.getFullYear(), now.getMonth(), now.getDate())

    const firstDay = new Date(view.y, view.m, 1).getDay()
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate()
    const cells: (number | null)[] = [
        ...Array.from({ length: firstDay }, () => null),
        ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
    ]

    const shift = (delta: number) => {
        const d = new Date(view.y, view.m + delta, 1)
        setView({ y: d.getFullYear(), m: d.getMonth() })
    }

    return (
        <div className="select-none rounded-lg border border-border bg-card p-3">
            <div className="flex items-center justify-between mb-2">
                <button
                    type="button"
                    onClick={() => shift(-1)}
                    aria-label="Bulan sebelumnya"
                    className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-foreground hover:text-primary-foreground"
                >
                    <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="font-display font-bold text-sm text-foreground">{MONTHS[view.m]} {view.y}</span>
                <button
                    type="button"
                    onClick={() => shift(1)}
                    aria-label="Bulan berikutnya"
                    className="p-1.5 rounded transition-colors text-muted-foreground hover:bg-foreground hover:text-primary-foreground"
                >
                    <ChevronRight className="w-4 h-4" />
                </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
                {WEEKDAYS.map(d => <span key={d} className="text-center text-[10px] font-mono uppercase text-muted-foreground">{d}</span>)}
            </div>
            <div key={`${view.y}-${view.m}`} className="grid grid-cols-7 gap-1 animate-in fade-in duration-150">
                {cells.map((d, i) => {
                    if (d === null) return <span key={i} />
                    const iso = toIso(view.y, view.m, d)
                    const isSelected = iso === value
                    const isToday = iso === todayIso
                    const isWeekend = [0, 6].includes(new Date(view.y, view.m, d).getDay())
                    return (
                        <button
                            key={i}
                            type="button"
                            disabled={iso < todayIso}
                            onClick={() => onChange(iso)}
                            className={`aspect-square rounded text-sm transition-colors active:scale-95 disabled:opacity-30 disabled:cursor-not-allowed ${isSelected
                                ? 'bg-foreground text-primary-foreground font-bold'
                                : isToday
                                    ? 'ring-1 ring-inset ring-foreground hover:bg-foreground hover:text-primary-foreground'
                                    : isWeekend
                                        ? 'text-muted-foreground hover:bg-foreground hover:text-primary-foreground'
                                        : 'text-foreground hover:bg-foreground hover:text-primary-foreground'
                                }`}
                        >
                            {d}
                        </button>
                    )
                })}
            </div>
        </div>
    )
}
