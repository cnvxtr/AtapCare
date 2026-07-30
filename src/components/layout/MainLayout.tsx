import { useState } from 'react'
import { Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
  LayoutDashboard, Inbox, Clock, Archive, ClipboardList,
  ChevronRight, Bell, Search, Command, X, LogOut, Lock, AlertCircle, Menu
} from 'lucide-react'

const menuItems = (role?: string) => role === 'teknisi'
  ? [{ icon: ClipboardList, label: 'Tugas Saya', path: '/tugas' }]
  : [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
    { icon: Inbox, label: 'Antrean Masuk', path: '/inbox' },
    { icon: Clock, label: 'Tiket Aktif', path: '/active' },
    { icon: Archive, label: 'Arsip', path: '/archive' },
  ]

export default function MainLayout() {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout, lastLoginTime } = useAuth()
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

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

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 left-0 z-50 flex w-64 shrink-0 flex-col border-r border-border bg-card transition-transform duration-300 lg:relative lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        {/* Logo */}
        <div className="h-16 flex items-center gap-2 px-5 border-b border-border">
          <div className="relative">
            <div className="h-8 w-8 rounded-lg bg-foreground text-background grid place-items-center font-display font-bold text-sm">
              A
            </div>
            <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-success" />
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-display font-bold tracking-tight">Atap Care</span>
            <span className="text-[10px] text-muted-foreground uppercase tracking-widest">Ops Console</span>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          <div className="px-2 pb-2 pt-1 text-[10px] uppercase tracking-widest text-muted-foreground">
            {user?.role === 'teknisi' ? 'Tugas' : 'Workspace'}
          </div>
          {nav.map((item) => {
            const active = pathname === item.path
            const Icon = item.icon
            return (
              <button
                key={item.path}
                onClick={() => { navigate(item.path); setIsSidebarOpen(false) }}
                className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-all w-full text-left ${
                  active
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                }`}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{item.label}</span>
              </button>
            )
          })}
        </nav>

        {/* Profile widget */}
        <div className="p-3 border-t border-border">
          <button onClick={() => setIsProfileModalOpen(true)} className="w-full glass rounded-xl p-3 relative overflow-hidden text-left hover:opacity-90 transition">
            <div className="absolute -top-6 -right-6 h-16 w-16 rounded-full bg-foreground/5 blur-2xl" />
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-foreground to-foreground/60 grid place-items-center text-background text-xs font-bold">
                {initials}
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold truncate text-foreground">{user?.full_name || 'User'}</p>
                <p className="text-[10px] text-muted-foreground">{roleLabel}</p>
              </div>
            </div>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="h-16 sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="h-full px-6 flex items-center gap-4">
            <button onClick={() => setIsSidebarOpen(true)} className="p-2 -ml-2 rounded-lg hover:bg-accent transition lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2 text-sm text-muted-foreground min-w-0">
              <span className="font-mono text-[10px] uppercase tracking-widest hidden sm:inline">/ Atap Care</span>
              <ChevronRight className="h-3 w-3 hidden sm:inline" />
              <span className="text-foreground font-medium truncate">{pageTitle}</span>
            </div>
            <div className="flex-1" />
            <div className="hidden md:flex items-center gap-2 px-3 h-9 rounded-lg border border-border bg-card w-72 text-sm text-muted-foreground">
              <Search className="h-4 w-4" />
              <span className="flex-1">Cari tiket, SN, teknisi…</span>
              <kbd className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-muted flex items-center gap-0.5">
                <Command className="h-2.5 w-2.5" />K
              </kbd>
            </div>
            <button className="relative h-9 w-9 grid place-items-center rounded-lg border border-border hover:bg-accent transition">
              <Bell className="h-4 w-4" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive pulse-ring" />
            </button>
          </div>
        </header>

        {/* Page header */}
        <div className="px-6 pt-8 pb-6 border-b border-border bg-gradient-to-b from-card to-background">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <h1 className="text-3xl font-display font-bold tracking-tight">{pageTitle}</h1>
              {user?.full_name && (
                <p className="text-sm text-muted-foreground mt-1.5">
                  Selamat datang, <span className="font-semibold text-foreground">{user.full_name}</span>
                </p>
              )}
            </div>
          </div>
        </div>

        <main className="p-6 flex-1 bg-background">
          <Outlet />
        </main>
      </div>

      {/* BACKDROP MOBILE */}
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden backdrop-blur-sm" onClick={() => setIsSidebarOpen(false)} />
      )}

      {/* MODAL PROFIL */}
      {isProfileModalOpen && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsProfileModalOpen(false)}>
          <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b border-border flex justify-between items-center bg-card">
              <h3 className="text-lg font-display font-bold text-foreground">Profil Saya</h3>
              <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                <X className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>
            <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto bg-card">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Nama</p>
                  <p className="font-semibold text-foreground">{user?.full_name || '-'}</p>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Username</p>
                  <p className="font-semibold text-foreground font-mono">{user?.username || '-'}</p>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Role</p>
                  <p className="font-semibold text-foreground">{roleLabel}</p>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Default</p>
                  <p className="font-semibold text-foreground">{roleLabel}</p>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Status</p>
                  <span className="inline-flex items-center px-2 py-1 rounded text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">Aktif</span>
                </div>
                <div className="p-3 bg-muted border border-border rounded-lg">
                  <p className="text-muted-foreground mb-1 text-xs font-medium uppercase tracking-wider">Terakhir Login</p>
                  <p className="font-semibold text-foreground font-mono text-xs">{lastLoginTime || 'Belum pernah login'}</p>
                </div>
              </div>
              <div className="border-t border-border pt-6">
                <h4 className="font-semibold text-foreground mb-4 flex items-center gap-2">
                  <Lock className="w-4 h-4 text-muted-foreground" /> Ganti Password
                </h4>
                <div className="space-y-3">
                  <input type="password" placeholder="Password Lama" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none transition-all" />
                  <input type="password" placeholder="Password Baru" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none transition-all" />
                  <input type="password" placeholder="Konfirmasi Password Baru" className="w-full px-3 py-2.5 bg-card border border-border rounded-lg text-sm focus:ring-2 focus:ring-ring/20 focus:border-ring outline-none transition-all" />
                  <button className="w-full py-2.5 bg-foreground text-primary-foreground rounded-lg text-sm font-semibold hover:bg-foreground/90 transition-colors mt-2">
                    Simpan Password
                  </button>
                </div>
              </div>
              <div className="bg-amber-50/80 p-3 rounded-lg border border-amber-200 flex items-start gap-3">
                <AlertCircle className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-amber-800">
                  Untuk perubahan nama, role, atau status, silakan hubungi <span className="font-semibold text-amber-900">Administrator</span>.
                </p>
              </div>
              <button
                onClick={() => { setIsProfileModalOpen(false); setShowLogoutConfirm(true) }}
                className="w-full py-2.5 bg-destructive/10 text-destructive rounded-lg text-sm font-semibold hover:bg-destructive/20 transition-colors flex items-center justify-center gap-2"
              >
                <LogOut className="w-4 h-4" /> Keluar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL LOGOUT */}
      {showLogoutConfirm && (
        <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
          <div className="bg-card border border-border w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
            <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <LogOut className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-display font-bold text-foreground mb-2">Keluar dari Aplikasi?</h3>
            <p className="text-sm text-muted-foreground mb-6">
              Apakah Anda yakin ingin keluar? Anda harus login kembali untuk mengakses sistem.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm font-semibold transition-colors">
                Batal
              </button>
              <button onClick={handleLogout} className="flex-1 px-4 py-2.5 bg-destructive text-destructive-foreground hover:bg-destructive/90 rounded-lg text-sm font-bold transition-colors">
                Ya, Keluar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
