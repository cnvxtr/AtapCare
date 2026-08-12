// Pill status SLA. null = SLA belum mulai (BR-28D) → tampil "—" netral.
// Warna: merah Overdue, amber ≤4 jam sisa, hijau normal.
// size 'md' dipakai di header drawer (konteks lebih besar dari tabel).
export default function SlaBadge({
  remaining,
  size = 'sm',
}: {
  remaining: number | null
  size?: 'sm' | 'md'
}) {
  const pad = size === 'md' ? 'px-1.5 py-0.5 text-[10px]' : 'px-1 py-0.5 text-[8px]'
  if (remaining == null) {
    return (
      <span
        title="SLA belum mulai"
        className={`shrink-0 rounded-[3px] font-bold whitespace-nowrap bg-muted text-muted-foreground ${pad}`}
      >
        —
      </span>
    )
  }
  return (
    <span
      className={`shrink-0 rounded-[3px] font-bold whitespace-nowrap ${pad} ${
        remaining <= 0 ? 'bg-red-100 text-red-700' : remaining <= 4 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
      }`}
    >
      {remaining <= 0 ? 'Overdue' : `${Math.ceil(remaining)}jam`}
    </span>
  )
}
