import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuth } from '../../context/AuthContext'
import { LogOut, Sun, Moon, Bell, ChevronDown, Check } from 'lucide-react'
import {
  getMyNotifications, getUnreadCount, markAllRead, markNotificationRead,
  type NotificationRow,
} from '../../services/notifications'
import { approveBackup, rejectBackup } from '../../services/ticketService'
import { getStoredTheme, setTheme } from '../../lib/theme'
import { registerPush, playChime } from '../../lib/pushNotifications'
import { ROLE_LABELS } from '../../services/users'
import ErrorBoundary from '../ErrorBoundary'
import BottomTabs from './BottomTabs'

const PAGE_TITLES: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/inbox': 'Tiket',
  '/reports': 'Laporan',
  '/tugas': 'Tugas',
  '/command-center': 'Command Center',
  '/admin': 'Dashboard',
  '/admin/users': 'Pengguna',
  '/admin/master-data': 'Master Data',
  '/admin/reports': 'Laporan',
  '/admin/ratings': 'Penilaian Helpdesk',
  '/customer': 'Dashboard',
  '/customer/report': 'Lapor Kendala',
}

const roleHome = (r?: string) =>
  r === 'admin' ? '/admin' : r === 'teknisi' ? '/tugas' : r === 'customer' ? '/customer' : r === 'executive' ? '/executive' : '/dashboard'

export default function MobileLayout() {
  const location = useLocation()
  const navigate = useNavigate()
  const { user, logout, switchRole } = useAuth()
  const [showNotifSheet, setShowNotifSheet] = useState(false)
  const [showRoleSheet, setShowRoleSheet] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)
  const [switchingRole, setSwitchingRole] = useState(false)
  const [notifCount, setNotifCount] = useState(0)
  const [notifs, setNotifs] = useState<NotificationRow[]>([])
  const [backupBusy, setBackupBusy] = useState<string | null>(null)
  const [isDark, setIsDark] = useState(getStoredTheme() === 'dark')

  const prevNotifIds = useRef<string[]>([])
  const firstNotifLoad = useRef(true)

  useEffect(() => {
    if (!user) return
    let alive = true
    const refresh = async () => {
      const [n, c] = await Promise.all([getMyNotifications(user.id), getUnreadCount(user.id)])
      if (!alive) return
      const fresh = n.filter(x => !prevNotifIds.current.includes(x.id))
      prevNotifIds.current = n.map(x => x.id)
      if (!firstNotifLoad.current && fresh.length > 0 && document.visibilityState === 'visible') playChime()
      firstNotifLoad.current = false
      setNotifs(n)
      setNotifCount(c)
    }
    refresh()
    const t = setInterval(refresh, 30_000)
    return () => { alive = false; clearInterval(t) }
  }, [user])

  useEffect(() => {
    if (!user) return
    void registerPush(user.id)
  }, [user])

  const pageTitle = location.pathname.startsWith('/customer/ticket/')
    ? 'Detail Tiket'
    : PAGE_TITLES[location.pathname] || 'Atap Care'

  const handleLogout = () => {
    logout()
    setShowLogoutConfirm(false)
  }

  const handleBackupAction = async (n: NotificationRow, action: 'approve' | 'reject') => {
    if (!n.ticket_id || backupBusy) return
    setBackupBusy(n.id)
    const ok = action === 'approve' ? await approveBackup(n.ticket_id) : await rejectBackup(n.ticket_id)
    if (ok) await markNotificationRead(n.id)
    setBackupBusy(null)
    if (ok) {
      toast.success(action === 'approve' ? 'Pengalihan disetujui.' : 'Pengalihan ditolak.')
      setNotifs(prev => prev.filter(x => x.id !== n.id))
      setNotifCount(c => Math.max(0, c - 1))
    } else {
      toast.error(action === 'approve' ? 'Gagal menyetujui pengalihan.' : 'Gagal menolak pengalihan.')
    }
  }

  // Ganti Role — perilaku identik dengan sidebar web.
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
    setShowRoleSheet(false)
    toast.success(`Role berubah menjadi ${ROLE_LABELS[r] || r}`)
    navigate(roleHome(r))
  }

  const toggleTheme = () => {
    const next = isDark ? 'light' : 'dark'
    setTheme(next)
    setIsDark(!isDark)
  }

  const handleMarkAllRead = () => {
    if (!user) return
    markAllRead(user.id)
    setNotifCount(0)
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 h-16 flex items-center justify-between px-5 border-b border-border bg-background/80 backdrop-blur-xl">
        <h1 className="text-lg font-display font-bold tracking-tight truncate">{pageTitle}</h1>
        <div className="flex items-center gap-1">
          {/* Ganti Role — hanya untuk multi-role */}
          {canSwitchRole && user && (
            <button
              onClick={() => setShowRoleSheet(true)}
              className="flex items-center gap-1 h-9 px-2.5 rounded-full border border-border bg-card text-xs font-semibold hover:bg-accent transition-colors"
            >
              {ROLE_LABELS[user.role] || user.role}
              <ChevronDown className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Notifikasi */}
          <button
            onClick={() => setShowNotifSheet(true)}
            className="relative h-11 w-11 grid place-items-center rounded-xl hover:bg-accent transition-colors"
          >
            <Bell className="h-5 w-5" />
            {notifCount > 0 && (
              <span className="absolute top-1.5 right-1.5 h-4.5 min-w-[18px] px-1 rounded-full bg-red-600 text-white text-[10px] font-bold grid place-items-center">
                {notifCount > 9 ? '9+' : notifCount}
              </span>
            )}
          </button>

          {/* Dark Mode Toggle */}
          <button
            onClick={toggleTheme}
            className="h-11 w-11 grid place-items-center rounded-xl hover:bg-accent transition-colors"
          >
            {isDark ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 px-4 py-3 pb-[calc(3.5rem+env(safe-area-inset-bottom))]">
        <ErrorBoundary>
          <Outlet />
        </ErrorBoundary>
      </main>

      {/* Bottom Tabs */}
      <BottomTabs role={user?.role || 'helpdesk'} />

      {/* Notification Bottom Sheet */}
      {createPortal(
        <>
          <div
            className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-200 ${showNotifSheet ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setShowNotifSheet(false)}
          />
          <div
            className={`fixed bottom-0 inset-x-0 z-[56] bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[75vh] flex flex-col transition-transform duration-300 ease-out ${showNotifSheet ? 'translate-y-0' : 'translate-y-full'}`}
          >
            {/* Handle */}
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            {/* Header */}
            <div className="px-5 pb-3 border-b border-border flex items-center justify-between">
              <span className="text-sm font-semibold text-foreground">Notifikasi</span>
              {notifCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-muted-foreground hover:text-foreground border border-border rounded-lg px-2 py-1 hover:bg-accent transition-colors"
                >
                  Tandai dibaca
                </button>
              )}
            </div>
            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {notifs.length === 0 ? (
                <div className="px-5 py-12 text-center text-sm text-muted-foreground">
                  Tidak ada notifikasi
                </div>
              ) : (
                <div className="p-4 space-y-2">
                  {notifs.map((n) => {
                    const actionable = n.ticket_id && notifCount > 0
                    return (
                      <div key={n.id} className={`flex flex-col items-start py-3 px-3.5 bg-muted rounded-xl ${n.read ? 'opacity-60' : ''}`}>
                        <span className="text-sm font-medium text-foreground">{n.title}</span>
                        {n.message && <span className="text-xs text-muted-foreground mt-0.5">{n.message}</span>}
                        <span className="text-[10px] text-muted-foreground/70 mt-1">
                          {new Date(n.created_at).toLocaleString('id-ID', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                        </span>
                        {actionable && (
                          <div className="flex gap-2 mt-2 w-full">
                            <button
                              disabled={backupBusy !== null}
                              onClick={() => handleBackupAction(n, 'approve')}
                              className="flex-1 py-1.5 text-xs bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                            >
                              Setujui
                            </button>
                            <button
                              disabled={backupBusy !== null}
                              onClick={() => handleBackupAction(n, 'reject')}
                              className="flex-1 py-1.5 text-xs bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                            >
                              Tolak
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Role Switcher Bottom Sheet */}
      {createPortal(
        <>
          <div
            className={`fixed inset-0 z-[55] bg-black/40 transition-opacity duration-200 ${showRoleSheet ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
            onClick={() => setShowRoleSheet(false)}
          />
          <div
            className={`fixed bottom-0 inset-x-0 z-[56] bg-card border-t border-border rounded-t-2xl shadow-2xl max-h-[60vh] flex flex-col transition-transform duration-300 ease-out ${showRoleSheet ? 'translate-y-0' : 'translate-y-full'}`}
          >
            <div className="flex justify-center pt-3 pb-1">
              <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
            </div>
            <div className="px-5 pb-3 border-b border-border">
              <span className="text-sm font-semibold text-foreground">Ganti Role</span>
              <p className="text-xs text-muted-foreground mt-0.5">Role aktif saat ini: {ROLE_LABELS[user?.role || ''] || user?.role}</p>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1">
              {roleList.map((r) => (
                <button
                  key={r}
                  disabled={switchingRole || r === user?.role}
                  onClick={() => handleSwitchRole(r)}
                  className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-muted hover:bg-accent disabled:opacity-50 transition-colors"
                >
                  <span className="text-sm font-medium text-foreground">{ROLE_LABELS[r] || r}</span>
                  {r === user?.role && <Check className="h-4 w-4 text-foreground" />}
                </button>
              ))}
            </div>
          </div>
        </>,
        document.body
      )}

      {/* Logout Modal */}
      {showLogoutConfirm && createPortal((
        <div className="fixed inset-0 bg-black/50 z-[100] flex items-center justify-center p-4 backdrop-blur-sm fade-in">
          <div className="bg-card border border-border w-full max-w-sm rounded-2xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">Keluar?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Anda harus login kembali untuk mengakses sistem.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setShowLogoutConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded-xl text-sm font-semibold transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleLogout}
                className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-xl text-sm font-bold transition-colors"
              >
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      ), document.body)}
    </div>
  )
}
