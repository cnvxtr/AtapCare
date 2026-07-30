const PRIORITY_STYLES: Record<string, string> = {
  P1: 'bg-destructive/15 text-destructive border-destructive/40',
  P2: 'bg-warning/20 text-warning border-warning/40',
  P3: 'bg-muted text-muted-foreground border-border',
}

const STATUS_STYLES: Record<string, string> = {
  NEW: 'bg-muted text-foreground border-border',
  OPEN: 'bg-muted text-foreground border-border',
  UNASSIGNED: 'bg-transparent text-destructive border-destructive/40',
  SCHEDULED: 'bg-muted text-foreground border-border',
  EN_ROUTE: 'bg-muted text-foreground border-border',
  WORKING: 'bg-muted text-foreground border-border',
  PENDING: 'bg-warning/15 text-warning border-warning/40',
  RESOLVED: 'bg-success/15 text-success border-success/40',
  CLOSED: 'bg-success/15 text-success border-success/40',
  VOID: 'bg-transparent text-muted-foreground border-border',
  DUPLICATE: 'bg-transparent text-muted-foreground border-border',
}

interface BadgeProps {
  type: 'priority' | 'status'
  value: string
  className?: string
}

export function Badge({ type, value, className = '' }: BadgeProps) {
  const styles = type === 'priority' ? PRIORITY_STYLES[value] : STATUS_STYLES[value]
  const size = type === 'priority' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-1 text-xs'

  return (
    <span className={`inline-block ${size} font-bold rounded border whitespace-nowrap ${styles} ${className}`}>
      {value}
    </span>
  )
}

export default Badge
