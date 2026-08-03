const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-red-600 text-white',
  P2: 'bg-amber-500 text-white',
  P3: 'bg-blue-500 text-white',
}

export const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  NEW: { bg: '#d4d4d4', text: '#171717' },
  OPEN: { bg: '#a3a3a3', text: '#171717' },
  UNASSIGNED: { bg: '#737373', text: '#ffffff' },
  SCHEDULED: { bg: '#737373', text: '#ffffff' },
  EN_ROUTE: { bg: '#737373', text: '#ffffff' },
  WORKING: { bg: '#525252', text: '#ffffff' },
  PENDING: { bg: '#404040', text: '#ffffff' },
  RESOLVED: { bg: '#262626', text: '#ffffff' },
  CLOSED: { bg: '#171717', text: '#ffffff' },
  VOID: { bg: '#171717', text: '#ffffff' },
  DUPLICATE: { bg: '#171717', text: '#ffffff' },
}

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Baru',
  OPEN: 'Diproses',
  UNASSIGNED: 'Ditugaskan',
  SCHEDULED: 'Ditugaskan',
  EN_ROUTE: 'Ditugaskan',
  WORKING: 'Dikerjakan',
  PENDING: 'Dijeda',
  RESOLVED: 'Selesai',
  CLOSED: 'Tutup',
  VOID: 'Dibatalkan',
  DUPLICATE: 'Digabungkan',
  REJECTED: 'Ditolak',
}

interface BadgeProps {
  type: 'priority' | 'status'
  value: string
  className?: string
  small?: boolean
  label?: string
}

export function Badge({ type, value, className = '', small, label }: BadgeProps) {
  const isStatus = type === 'status'
  const statusColor = isStatus ? STATUS_COLORS[value] : null
  const styles = isStatus ? '' : PRIORITY_STYLES[value]
  const size = type === 'priority' ? (small ? 'px-1 py-px text-[8px]' : 'px-1.5 py-0.5 text-[10px]') : 'px-2 py-1 text-xs'

  return (
    <span
      className={`inline-block ${size} font-bold rounded border whitespace-nowrap ${styles} ${className}`}
      style={statusColor ? { backgroundColor: statusColor.bg, color: statusColor.text, borderColor: statusColor.bg } : undefined}
    >
      {label || (isStatus ? STATUS_LABELS[value] || value : value)}
    </span>
  )
}

export default Badge
