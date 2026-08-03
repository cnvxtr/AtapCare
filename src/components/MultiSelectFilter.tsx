import { Check, ChevronDown } from 'lucide-react'
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from './ui/dropdown-menu'
import { cn } from '@/lib/utils'

export type FilterOption = { value: string; label: string }

// Semua <-> spesifik: klik spesifik mematikan 'all' (spesifik lain independen);
// bila tidak ada spesifik terpilih, 'all' di-restore agar filter tak pernah kosong.
export function toggleFilter(
    selected: Record<string, boolean>,
    key: string,
    specificKeys: string[]
): Record<string, boolean> {
    const next: Record<string, boolean> =
        key === 'all'
            ? { all: !selected['all'] }
            : { ...selected, all: false, [key]: !selected[key] }
    if (!next['all'] && !specificKeys.some(k => next[k])) next['all'] = true
    return next
}

export default function MultiSelectFilter({
    label,
    options,
    selected,
    onToggle,
    className,
}: {
    label: string
    options: FilterOption[]
    selected: Record<string, boolean>
    onToggle: (value: string) => void
    className?: string
}) {
    const text = selected['all']
        ? label
        : options.filter(o => selected[o.value]).map(o => o.label).join(', ')

    const row = (key: string, text: string, checked: boolean) => (
        <label
            key={key}
            className={`relative flex w-full items-center rounded-sm py-1.5 pl-2 pr-8 text-sm cursor-pointer transition-colors ${checked ? 'bg-foreground text-primary-foreground' : 'hover:bg-foreground hover:text-primary-foreground'}`}
        >
            <input type="checkbox" checked={checked} onChange={() => onToggle(key)} className="sr-only" />
            <span className="truncate">{text}</span>
            <span className="absolute right-2 flex h-3.5 w-3.5 items-center justify-center">
                {checked && <Check className="h-4 w-4" />}
            </span>
        </label>
    )

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <button type="button" className={cn('inline-flex items-center justify-between gap-1 text-left', className)}>
                    <span className="truncate">{text}</span>
                    <ChevronDown className="w-4 h-4 opacity-50 shrink-0" />
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="border-border bg-card text-foreground p-1.5 min-w-[170px] max-h-72 overflow-y-auto">
                {row('all', label, !!selected['all'])}
                {options.length > 0 && <div className="h-px bg-border my-1" />}
                {options.map(o => row(o.value, o.label, !!selected[o.value]))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}
