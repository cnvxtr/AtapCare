import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import logo from '../../assets/logo.png'

interface SplashScreenProps {
  onFinish: () => void
}

export default function SplashScreen({ onFinish }: SplashScreenProps) {
  const [phase, setPhase] = useState<'in' | 'out'>('in')

  useEffect(() => {
    const timer = setTimeout(() => setPhase('out'), 2200)
    return () => clearTimeout(timer)
  }, [])

  useEffect(() => {
    if (phase === 'out') {
      const timer = setTimeout(onFinish, 450)
      return () => clearTimeout(timer)
    }
  }, [phase, onFinish])

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-white"
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Center: Logo + App Name horizontal */}
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, scale: 0.85 }}
          animate={phase === 'in'
            ? { opacity: 1, scale: 1 }
            : { opacity: 0, scale: 1.05 }}
          transition={{ type: 'spring', stiffness: 200, damping: 20, duration: 0.6 }}
        >
          <img
            src={logo}
            alt="Atap Care"
            className="h-16 w-16 object-contain"
          />
          <h1 className="text-3xl font-display font-bold tracking-tight text-neutral-900">
            Atap Care
          </h1>
        </motion.div>

        {/* Loading bar */}
        <motion.div
          className="mt-8 h-0.5 w-32 rounded-full bg-neutral-200 overflow-hidden"
          initial={{ opacity: 0 }}
          animate={phase === 'in' ? { opacity: 1 } : { opacity: 0 }}
          transition={{ delay: 0.5 }}
        >
          <motion.div
            className="h-full bg-neutral-400 rounded-full"
            initial={{ width: '0%' }}
            animate={{ width: '100%' }}
            transition={{ delay: 0.5, duration: 1.5, ease: 'easeInOut' }}
          />
        </motion.div>

        {/* Company Name — fixed at bottom center */}
        <motion.p
          className="absolute bottom-8 text-[10px] uppercase tracking-[0.2em] text-neutral-400 font-medium"
          initial={{ opacity: 0, y: 8 }}
          animate={phase === 'in'
            ? { opacity: 1, y: 0 }
            : { opacity: 0, y: 4 }}
          transition={{ delay: 0.7, duration: 0.5 }}
        >
          PT Atap Teknologi Indonesia
        </motion.p>
      </motion.div>
    </AnimatePresence>
  )
}
