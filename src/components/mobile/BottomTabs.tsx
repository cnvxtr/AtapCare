import { useState, useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Inbox, FileBarChart2, Users, Building2,
  LayoutGrid, ClipboardList,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { resolveAvatarUrl } from '../../services/photoService'
import type { LucideIcon } from 'lucide-react'

interface TabItem {
  path: string
  icon: LucideIcon
  label: string
}

const TABS: Record<string, TabItem[]> = {
  helpdesk: [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/inbox', icon: Inbox, label: 'Tiket' },
    { path: '/reports', icon: FileBarChart2, label: 'Laporan' },
  ],
  admin: [
    { path: '/admin', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/admin/users', icon: Users, label: 'Pengguna' },
    { path: '/admin/master-data', icon: Building2, label: 'Data' },
    { path: '/admin/reports', icon: FileBarChart2, label: 'Laporan' },
  ],
  pm: [
    { path: '/dashboard', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/command-center', icon: LayoutGrid, label: 'Command' },
  ],
  teknisi: [
    { path: '/tugas', icon: ClipboardList, label: 'Tugas' },
  ],
  executive: [
    { path: '/executive', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/executive/inbox', icon: Inbox, label: 'Tiket' },
    { path: '/executive/reports', icon: FileBarChart2, label: 'Laporan' },
  ],
  customer: [
    { path: '/customer', icon: LayoutDashboard, label: 'Beranda' },
    { path: '/customer/report', icon: FileBarChart2, label: 'Lapor' },
  ],
}

export default function BottomTabs({ role }: { role: string }) {
  const tabs = TABS[role] || TABS.helpdesk
  const location = useLocation()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [resolvedAvatar, setResolvedAvatar] = useState<string | null>(null)
  useEffect(() => {
    resolveAvatarUrl(user?.avatar_url).then(setResolvedAvatar)
  }, [user?.avatar_url])

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()

  const activePath = tabs.find(t => location.pathname === t.path)?.path || tabs[0].path
  const profileActive = location.pathname === '/profile'

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl safe-area-pb">
        <div className="flex items-stretch justify-around h-14">
          {tabs.map((tab) => {
            const active = activePath === tab.path && !profileActive
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                onClick={() => navigate(tab.path)}
                className="relative flex flex-1 flex-col items-center justify-center gap-0.5 outline-none tap-highlight-transparent"
              >
                {active && (
                  <motion.div
                    layoutId="tab-indicator"
                    className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-foreground"
                    transition={{ type: 'spring', stiffness: 500, damping: 35 }}
                  />
                )}
                <Icon
                  className={`h-5 w-5 transition-colors duration-200 ${
                    active ? 'text-foreground' : 'text-muted-foreground'
                  }`}
                  strokeWidth={active ? 2.2 : 1.8}
                />
                <span
                  className={`text-[10px] leading-none transition-colors duration-200 ${
                    active ? 'text-foreground font-semibold' : 'text-muted-foreground'
                  }`}
                >
                  {tab.label}
                </span>
              </button>
            )
          })}

          {/* Profil tab — always last */}
          <button
            onClick={() => navigate('/profile')}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 outline-none tap-highlight-transparent"
          >
            {profileActive && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-foreground"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            {resolvedAvatar ? (
              <img src={resolvedAvatar} alt="Avatar" className={`h-6 w-6 rounded-full object-cover border ${profileActive ? 'border-foreground' : 'border-border'}`} />
            ) : (
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-[9px] font-bold">
                {initials}
              </div>
            )}
            <span
              className={`text-[10px] leading-none transition-colors duration-200 ${
                profileActive ? 'text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              Profil
            </span>
          </button>
        </div>
      </nav>
    </>
  )
}
