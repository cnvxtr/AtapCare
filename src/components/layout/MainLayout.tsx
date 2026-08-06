import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import logo from '../../assets/logo.png'
import {
  LayoutDashboard, Inbox, ClipboardList, LayoutGrid,
  ChevronRight, Bell, LogOut, Menu, PanelLeftClose, PanelLeftOpen,
  Users, Building2, FileBarChart2, Timer, Sun, Moon, Check
} from 'lucide-react'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '../../components/ui/tooltip'
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent,
  DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator
} from '../../components/ui/dropdown-menu'
import {
  getMyNotifications, getUnreadCount, markAllRead, deliverDueBroadcasts,
  type NotificationRow
} from '../../services/notifications'
import { getStoredTheme, setTheme } from '../../lib/theme'
import ErrorBoundary from '../ErrorBoundary'

const ROLE_LABELS: Record<string, string> = {
  admin: 'Administrator',
  helpdesk: 'Helpdesk',
  pm: 'Project Manager',
  teknisi: 'Teknisi Lapangan',
}

const roleHome = (role?: string) =>
  role === 'admin' ? '/admin' : role === 'teknisi' ? '/tugas' : '/dashboard'

const menuItems = (role?: string) =>
  role === 'teknisi'
    ? [{ icon: ClipboardList, label: 'Tugas', path: '/tugas' }]
    : role === 'pm'
      ? [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: LayoutGrid, label: 'Command Center', path: '/command-center' },
      ]
    : role === 'admin'
      ? [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
        { icon: Users, label: 'Manajemen Pengguna', path: '/admin/users' },
        { icon: Building2, label: 'Master Data', path: '/admin/master-data' },
        { icon: FileBarChart2, label: 'Laporan', path: '/admin/reports' },
        { icon: Timer, label: 'Konfigurasi SLA', path: '/admin/sla' },
      ]
      : [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
        { icon: Inbox, label: 'Tiket', path: '/inbox' },
        { icon: FileBarChart2, label: 'Laporan', path: '/reports' },
      ]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, switchRole } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [hoverLogo, setHoverLogo] = useState(false)
  const [showDropdown, setShowDropdown] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [notifs, setNotifs] = useState<NotificationRow[]>([])
  const [isDark, setIsDark] = useState(getStoredTheme() === 'dark')

  useEffect(() => {
    if (!user) return
    let alive = true
    const refresh = async () => {
      await deliverDueBroadcasts()
      const [n, c] = await Promise.all([getMyNotifications(user.id), getUnreadCount(user.id)])
      if (!alive) return
      setNotifs(n)
      setNotifCount(c)
    }
    refresh()
    // Polling 30 detik (blueprint 2.8.1)
    const t = setInterval(refresh, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [user])

  const roleLabel = user?.role === 'teknisi' ? 'Teknisi'
    : user?.role === 'pm' ? 'Project Manager'
    : user?.role === 'admin' ? 'Administrator'
    : 'Helpdesk'

  const pathname = location.pathname
  const nav = menuItems(user?.role)
  const pageTitle = nav.find(n => n.path === pathname)?.label || 'Dashboard'

  const handleLogout = () => {
    logout()
    setShowLogoutConfirm(false)
    setIsSidebarOpen(false)
  }

  const initials = (user?.full_name || 'U').split(' ').map(s => s[0]).join('').slice(0, 2).toUpperCase()

  const roleList = (user?.roles || user?.role || '').split(',').filter(Boolean)
  const canSwitchRole = roleList.length > 1

  const handleSwitchRole = async (r: string) => {
    if (!user || r === user.role || switchingRole) return
    setSwitchingRole(true)
    const res = await switchRole(r)
    setSwitchingRole(false)
    if (res?.error) {
      toast.error(res.error)
      return
    }
    setShowDropdown(false)
    toast.success(`Role berubah menjadi ${ROLE_LABELS[r] || r}`)
    navigate(roleHome(r))
  }

  return (
    <div className="max-w-full min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex ${collapsed ? 'w-16' : 'w-64'} shrink-0 flex-col border-r border-border bg-card transition-all duration-200 overflow-hidden lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className={`h-16 flex items-center gap-2 px-5 border-b border-border ${collapsed ? 'justify-center px-0' : ''}`}>
          <div className={`relative shrink-0 cursor-pointer`} onClick={collapsed ? () => setCollapsed(false) : () => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')} onMouseEnter={() => setHoverLogo(true)} onMouseLeave={() => setHoverLogo(false)} role={collapsed ? 'button' : undefined} tabIndex={collapsed ? 0 : undefined}>
            {collapsed && hoverLogo ? (
              <PanelLeftOpen className="h-5 w-5 text-foreground" />
            ) : (
              <img src={logo} alt="Atap Care" className="h-6 w-6 object-contain" />
            )}
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight min-w-0 cursor-pointer" onClick={() => navigate(user?.role === 'admin' ? '/admin' : '/dashboard')}>
              <span className="font-display font-bold tracking-tight truncate">Atap Care</span>
              <span className="text-[9px] text-muted-foreground uppercase tracking-tight truncate">PT Atap Teknologi Indonesia</span>
            </div>
          )}
          {!collapsed && (
            <div className="flex-1" />
          )}
          {!collapsed && (
            <button onClick={() => setCollapsed(true)} className="h-7 w-7 grid place-items-center rounded-[3px] text-muted-foreground hover:bg-accent hover:text-foreground transition">
              <PanelLeftClose className="h-5 w-5" />
            </button>
          )}
        </div>

        {/* Navigation */}
        <TooltipProvider>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className={`px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground ${collapsed ? 'hidden' : ''}`}>
            {user?.role === 'teknisi' ? 'Tugas' : user?.role === 'admin' ? 'Administrasi' : 'Workspace'}
          </div>
          {nav.map((item) => {
            const active = pathname === item.path
            const Icon = item.icon
            const button = (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsSidebarOpen(false) }}
                className={`group flex items-center gap-3 rounded px-3 py-2 text-sm font-medium transition-all w-full text-left ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className={`flex-1 ${collapsed ? 'hidden' : ''}`}>{item.label}</span>
              </button>
            )
            return collapsed ? (
              <Tooltip key={item.path}>
                <TooltipTrigger asChild>{button}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8} className="bg-foreground text-background border-0 text-xs font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            ) : button
          })}
        </nav>
        </TooltipProvider>

        {/* Profile widget */}
        <div className="relative p-2 border-t border-border">
          <button onClick={() => !collapsed && setShowDropdown(!showDropdown)} className={`w-full glass rounded-[3px] p-3 relative overflow-hidden text-left hover:opacity-90 transition ${collapsed ? 'grid place-items-center' : ''}`}>
            <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-foreground/5 blur-2xl" />
            <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2'}`}>
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-xs font-bold shrink-0">
                {initials}
              </div>
              {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold truncate text-foreground">{user?.full_name || 'User'}</p>
              <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
            </div>
          )}
          </div>
        </button>

          {showDropdown && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setShowDropdown(false)} />
              <div className="absolute bottom-full left-2 right-2 mb-2 z-50 bg-card border border-border rounded-lg shadow-xl overflow-hidden">
                {canSwitchRole && (
                  <>
                    <div className="px-3 pt-2.5 pb-1 text-[10px] uppercase tracking-widest text-muted-foreground">
                      Ganti Role
                    </div>
                    <div className="px-1.5 py-1.5 space-y-0.5">
                      {roleList.map((r) => {
                        const active = r === user?.role
                        return (
                          <button
                            key={r}
                            onClick={() => handleSwitchRole(r)}
                            disabled={active || switchingRole}
                            className={`w-full flex items-center justify-between px-3 py-2 text-sm rounded transition-colors text-left disabled:opacity-100 ${
                              active
                                ? 'bg-foreground text-background font-semibold'
                                : 'text-foreground hover:bg-foreground hover:text-background'
                            }`}
                          >
                            <span>{ROLE_LABELS[r] || r}</span>
                            {active && <Check className="h-3.5 w-3.5" />}
                          </button>
                        )
                      })}
                    </div>
                    <div className="border-t border-border" />
                  </>
                )}
                <button onClick={() => { setShowDropdown(false); setShowLogoutConfirm(true) }} className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm text-red-500 hover:bg-red-100 hover:text-red-500 transition-colors text-left font-semibold">
                  <LogOut className="h-4 w-4" /> Keluar
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      {/* Main */}
      <div className={`flex-1 min-w-0 flex flex-col pt-16 ${collapsed ? 'lg:ml-16' : 'lg:ml-64'}`}>
        {/* Top bar */}
        <header className={`h-16 fixed top-0 right-0 z-30 border-b border-border bg-background ${collapsed ? 'lg:left-16' : 'lg:left-64'}`}>
          <div className="h-full px-4 sm:px-6 flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-3 sm:p-2 -ml-2 rounded hover:bg-accent transition lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <ChevronRight className="h-3 w-3 hidden sm:inline" />
              <span className="text-foreground font-medium truncate">{pageTitle}</span>
            </div>
            <div className="flex-1" />
            <button
              onClick={() => { const next = !isDark ? 'dark' : 'light'; setTheme(next); setIsDark(!isDark) }}
              title={isDark ? 'Mode terang' : 'Mode gelap'}
              className="relative h-11 w-11 sm:h-9 sm:w-9 grid place-items-center rounded border border-border hover:bg-accent transition"
            >
              {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="relative h-11 w-11 sm:h-9 sm:w-9 grid place-items-center rounded border border-border hover:bg-accent transition">
                  <Bell className="h-4 w-4" />
                  {notifCount > 0 && (
                    <span className="absolute -top-1 -right-1 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold grid place-items-center">
                      {notifCount > 9 ? '9+' : notifCount}
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 bg-card border-border">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span className="text-sm">Notifikasi</span>
                  {notifCount > 0 && (
                    <button
                      onClick={() => { if (user) { markAllRead(user.id); setNotifCount(0); setNotifs(notifs.map(n => ({ ...n, read: true }))) } }}
                      className="text-xs text-muted-foreground hover:text-foreground"
                    >
                      Tandai dibaca
                    </button>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifs.length === 0 ? (
                  <div className="px-4 py-8 text-center text-sm text-muted-foreground">Tidak ada notifikasi</div>
                ) : (
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.map((n) => (
                      <DropdownMenuItem key={n.id} className={`cursor-default flex flex-col items-start py-2.5 ${n.read ? 'opacity-60' : ''}`}>
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        {n.message && <span className="text-xs text-muted-foreground mt-0.5">{n.message}</span>}
                        <span className="text-[10px] text-muted-foreground/70 mt-1">
                          {new Date(n.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </DropdownMenuItem>
                    ))}
                  </div>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 sm:p-6 flex-1 bg-background">
          {/* ponytail: ErrorBoundary = jaring diagnostik render-crash (bukan solusi per-route); */}
          {/* kalau crash terulang, pesan error muncul di layar sehingga bisa dilacak. */}
          <ErrorBoundary>
            <Outlet />
          </ErrorBoundary>
        </main>
      </div>

      {/* BACKDROP MOBILE */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* MODAL LOGOUT */}
      {showLogoutConfirm && createPortal((
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm fade-in">
          <div className="bg-card border border-border w-full max-w-sm rounded-lg shadow-2xl p-6 text-center" onClick={(e) => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">Keluar dari Aplikasi?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Apakah Anda yakin ingin keluar? Anda harus login kembali untuk mengakses sistem.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded text-sm font-semibold transition-colors">
                Batal
              </button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded text-sm font-bold transition-colors">
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}
