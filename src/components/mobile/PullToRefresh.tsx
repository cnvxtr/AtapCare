import { useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { isNativePlatform } from '../../lib/platform'

const THRESHOLD = 72
const MAX_PULL = 120

function RefreshBadge({ progress }: { progress: number }) {
  return (
    <div
      className="h-12 w-12 grid place-items-center"
      style={{
        opacity: Math.max(0.2, Math.min(1, progress)),
        transform: `scale(${0.7 + Math.min(1, progress) * 0.3})`,
      }}
    >
      <div className="h-8 w-8 border-4 border-foreground/20 border-t-foreground rounded-full animate-spin" />
    </div>
  )
}

export default function PullToRefresh({
  children,
  onRefresh,
}: {
  children: React.ReactNode
  onRefresh?: () => void | Promise<void>
}) {
  const [refreshing, setRefreshing] = useState(false)
  const startY = useRef<number | null>(null)
  const [dist, setDist] = useState(0)

  // Web (desktop & mobile browser): pull-to-refresh native Chrome/Edge,
  // bukan kustom. Tetap di halaman terakhir karena route URL-driven.
  if (!isNativePlatform()) return <>{children}</>

  const onTouchStart = (e: React.TouchEvent) => {
    if (refreshing || window.scrollY > 0) {
      startY.current = null
      return
    }
    startY.current = e.touches[0].clientY
  }

  const onTouchMove = (e: React.TouchEvent) => {
    if (startY.current === null) return
    const dy = e.touches[0].clientY - startY.current
    if (dy <= 0 || window.scrollY > 0) {
      setDist(0)
      return
    }
    setDist(Math.min(dy * 0.5, MAX_PULL))
  }

  const onTouchEnd = () => {
    if (startY.current === null) return
    startY.current = null
    if (dist >= THRESHOLD) {
      setRefreshing(true)
      const finish = () => {
        setRefreshing(false)
        setDist(0)
      }
      if (onRefresh) {
        Promise.resolve(onRefresh()).finally(finish)
      } else {
        // ponytail: tanpa callback tidak reload (hindari balik ke splash);
        // pasang onRefresh bila perlu refetch data.
        setTimeout(finish, 1000)
      }
    } else {
      setDist(0)
    }
  }

  return (
    <div onTouchStart={onTouchStart} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="min-h-full">
      <motion.div
        className="fixed inset-0 z-[60] grid place-items-center pointer-events-none"
        initial={false}
        animate={{ opacity: refreshing ? 1 : Math.min(1, dist / THRESHOLD) }}
      >
        <RefreshBadge progress={refreshing ? 1 : dist / THRESHOLD} />
      </motion.div>
      {children}
    </div>
  )
}