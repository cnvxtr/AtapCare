import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

/**
 * Detect if running on a native platform (Capacitor).
 * Also supports ?splash=1 in browser for development preview.
 */
export function isNativePlatform(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('splash') === '1') return true
  return Capacitor.isNativePlatform()
}

/**
 * React hook: true when MobileLayout should be used.
 * Native platform OR viewport < 768px.
 */
export function useIsMobile(breakpoint = 768): boolean {
  const [mobile, setMobile] = useState(() =>
    isNativePlatform() || (typeof window !== 'undefined' && window.innerWidth < breakpoint)
  )

  useEffect(() => {
    if (isNativePlatform()) return
    const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`)
    const handler = (e: MediaQueryListEvent) => setMobile(e.matches)
    setMobile(mql.matches)
    mql.addEventListener('change', handler)
    return () => mql.removeEventListener('change', handler)
  }, [breakpoint])

  return mobile
}
