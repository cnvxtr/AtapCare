import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  LayoutDashboard, Inbox, FileBarChart2, Users, Building2,
  Timer, LayoutGrid, ClipboardList, LogOut, Check,
} from 'lucide-react'
import { createPortal } from 'react-dom'
import { useAuth } from '../../context/AuthContext'
import { ROLE_LABELS } from '../../services/users'
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
    { path: '/admin/sla', icon: Timer, label: 'SLA' },
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
}

const roleHome = (role?: string) =>
  role === 'admin' ? '/admin' : role === 'teknisi' ? '/tugas' : '/dashboard'

export default function BottomTabs({ role }: { role: string }) {
  const tabs = TABS[role] || TABS.helpdesk
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, switchRole } = useAuth()
  const [showProfile, setShowProfile] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)

  const activePath = showProfile ? '__profile' : (tabs.find(t => location.pathname === t.path)?.path || tabs[0].path)

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()
  const roleList = (user?.roles || user?.role || '').split(',').filter(Boolean)
  const canSwitchRole = roleList.length > 1

  const handleSwitchRole = async (r: string) => {
    if (!user || r === user.role || switchingRole) return
    setSwitchingRole(true)
    const res = await switchRole(r)
    setSwitchingRole(false)
    if (res?.error) return
    setShowProfile(false)
    navigate(roleHome(r))
  }

  return (
    <>
      <nav className="fixed bottom-0 inset-x-0 z-50 border-t border-border bg-background/80 backdrop-blur-xl safe-area-pb">
        <div className="flex items-stretch justify-around h-14">
          {tabs.map((tab) => {
            const active = activePath === tab.path && !showProfile
            const Icon = tab.icon
            return (
              <button
                key={tab.path}
                onClick={() => { setShowProfile(false); navigate(tab.path) }}
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
            onClick={() => setShowProfile(!showProfile)}
            className="relative flex flex-1 flex-col items-center justify-center gap-0.5 outline-none tap-highlight-transparent"
          >
            {showProfile && (
              <motion.div
                layoutId="tab-indicator"
                className="absolute top-0 left-1/2 -translate-x-1/2 h-[2px] w-8 rounded-full bg-foreground"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
              />
            )}
            <div className="h-6 w-6 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-[9px] font-bold">
              {initials}
            </div>
            <span
              className={`text-[10px] leading-none transition-colors duration-200 ${
                showProfile ? 'text-foreground font-semibold' : 'text-muted-foreground'
              }`}
            >
              Profil
            </span>
          </button>
        </div>
      </nav>

      {/* Profile Bottom Sheet */}
      {createPortal(
        <>
          <div
            className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-200 ${showProfile ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setShowProfile(false)}
          />
          <div
            className={`fixed bottom-0 inset-x-0 z-[56] bg-card border-t border-border rounded-t-2xl shadow-2xl transition-transform duration-300 ease-out ${showProfile ? 'translate-y-0' : 'translate-y-full'}`}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>

            {/* User Info */}
            <div className="px-5 pt-3 pb-4 border-b border-border">
              <div className="flex items-center gap-3">
                <div className="h-12 w-12 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-sm font-bold shrink-0">
                  {initials}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-foreground truncate">{user?.full_name}</p>
                  <p className="text-xs text-muted-foreground">{ROLE_LABELS[user?.role || ''] || user?.role}</p>
                </div>
              </div>
            </div>

            {/* Role Switcher */}
            {canSwitchRole && (
              <div className="px-5 pt-4 pb-2">
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground font-medium mb-2">Ganti Role</p>
                <div className="space-y-1">
                  {roleList.map((r) => {
                    const active = r === user?.role
                    return (
                      <button
                        key={r}
                        onClick={() => { handleSwitchRole(r) }}
                        disabled={active || switchingRole}
                        className={`w-full flex items-center justify-between px-4 py-3 text-sm rounded-xl transition-colors text-left ${
                          active
                            ? 'bg-foreground text-background font-semibold'
                            : 'text-foreground hover:bg-accent'
                        }`}
                      >
                        <span>{ROLE_LABELS[r] || r}</span>
                        {active && <Check className="h-4 w-4" />}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Logout */}
            <div className="px-5 pt-2 pb-6">
              <button
                onClick={() => { setShowProfile(false); logout() }}
                className="w-full flex items-center justify-center gap-2.5 px-4 py-3 text-sm text-red-500 bg-red-50 dark:bg-red-500/10 hover:bg-red-100 dark:hover:bg-red-500/20 rounded-xl transition-colors font-semibold"
              >
                <LogOut className="h-4 w-4" /> Keluar
              </button>
            </div>
          </div>
        </>,
        document.body
      )}
    </>
  )
}
