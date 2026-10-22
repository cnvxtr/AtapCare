import { useState, useEffect } from 'react'
import { Capacitor } from '@capacitor/core'

export function isNativePlatform(): boolean {
  if (typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('splash') === '1') return true
  return Capacitor.isNativePlatform()
}

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
