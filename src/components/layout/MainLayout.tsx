import { useState } from 'react'
import { useNavigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext'
import {
    LayoutDashboard, Inbox, Clock, Archive, LogOut,
    User, ChevronUp, ChevronDown, X, Lock, AlertCircle,
    ClipboardList, Menu
} from 'lucide-react'
import logo from '../../assets/logo.png'

export default function MainLayout() {
    const navigate = useNavigate()
    const location = useLocation()
    const { user, logout, lastLoginTime } = useAuth()

    const [isSidebarOpen, setIsSidebarOpen] = useState(false)
    const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
    const [isProfileModalOpen, setIsProfileModalOpen] = useState(false)
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false)

    const roleLabel = user?.role === 'teknisi' ? 'Teknisi'
        : user?.role === 'pm' ? 'Project Manager'
        : user?.role === 'admin' ? 'Administrator'
        : 'Helpdesk'

    const menuItems = user?.role === 'teknisi'
        ? [
            { icon: ClipboardList, label: 'Tugas Saya', path: '/tugas' },
        ]
        : [
            { icon: LayoutDashboard, label: 'Dashboard', path: '/dashboard' },
            { icon: Inbox, label: 'Antrean Masuk', path: '/inbox' },
            { icon: Clock, label: 'Tiket Aktif', path: '/active' },
            { icon: Archive, label: 'Arsip', path: '/archive' },
        ]

    const handleLogout = () => {
        logout()
        setShowLogoutConfirm(false)
        setIsSidebarOpen(false)
    }

    return (
        <div className="flex h-screen bg-muted text-foreground overflow-hidden relative">

            {/* BACKDROP MOBILE */}
            {isSidebarOpen && (
                <div
                    className="fixed inset-0 bg-black/40 z-40 md:hidden backdrop-blur-sm"
                    onClick={() => setIsSidebarOpen(false)}
                />
            )}

            {/* SIDEBAR */}
            <aside
                className={`
                    fixed inset-y-0 left-0 z-50 bg-card border-r border-border flex flex-col
                    transition-[width,transform] duration-300 ease-out overflow-hidden
                    md:relative
                    ${isSidebarOpen ? 'w-64 translate-x-0 shadow-2xl' : 'w-20 -translate-x-full md:translate-x-0'}
                `}
            >
                {/* LOGO */}
                <div className="h-16 flex items-center flex-shrink-0 border-b border-border bg-card overflow-hidden">
                    <div className={`flex items-center transition-all duration-300 ${isSidebarOpen ? 'px-6' : 'justify-center w-full'}`}>
                        <img
                            src={logo}
                            alt="Atap Care"
                            className="h-8 w-8 rounded-lg object-contain flex-shrink-0"
                        />
                        <div className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${isSidebarOpen ? 'opacity-100 max-w-[180px] ml-2.5' : 'opacity-0 max-w-0 ml-0'}`}>
                            <div className="flex flex-col leading-tight min-w-0">
                                <span className="font-display font-bold text-foreground truncate text-sm">Atap Care</span>
                                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">PT Atap Teknologi Indonesia</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* MENU */}
                <nav className={`flex-1 overflow-hidden space-y-0.5 ${isSidebarOpen ? 'py-6 px-3' : 'py-2 px-2'}`}>
                    {menuItems.map((item) => {
                        const isActive = location.pathname === item.path
                            return (
                                <div key={item.path} className="relative group">
                                    <button
                                        onClick={() => {
                                            navigate(item.path)
                                            if (window.innerWidth < 768) setIsSidebarOpen(false)
                                        }}
                                        className={`w-full flex items-center px-3 py-2.5 rounded-lg text-sm font-medium transition-all whitespace-nowrap
                                            ${isActive
                                                ? 'bg-foreground text-primary-foreground font-semibold'
                                                : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                            }`}
                                    >
                                    <item.icon className="w-5 h-5 flex-shrink-0" strokeWidth={2} />
                                    <span className={`overflow-hidden whitespace-nowrap transition-all duration-200 ease-out ${isSidebarOpen ? 'opacity-100 max-w-[200px] ml-3' : 'opacity-0 max-w-0 ml-0'}`}>{item.label}</span>
                                </button>
                                {/* Tooltip ketika collapsed */}
                                {!isSidebarOpen && (
                                    <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2.5 py-1.5 bg-foreground text-primary-foreground text-xs font-medium rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 shadow-lg">
                                        {item.label}
                                    </div>
                                )}
                            </div>
                        )
                    })}
                </nav>

                {/* PROFILE */}
                <div className="border-t border-border bg-card relative flex-shrink-0 p-3">
                    <button
                        onClick={() => {
                            if (isSidebarOpen) {
                                setIsProfileMenuOpen(!isProfileMenuOpen)
                            } else {
                                setIsProfileModalOpen(true)
                            }
                        }}
                        className="w-full flex items-center p-2 rounded-lg hover:bg-muted transition-colors text-left"
                    >
                        <div className="w-9 h-9 rounded-full bg-muted border border-border flex items-center justify-center flex-shrink-0">
                            <User className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
                        </div>
                        <div className={`flex items-center gap-2 flex-1 min-w-0 overflow-hidden transition-all duration-200 ease-out ${isSidebarOpen ? 'opacity-100 max-w-[200px]' : 'opacity-0 max-w-0'}`}>
                            <div className="flex-1 min-w-0">
                                <p className="text-sm font-semibold text-foreground truncate">{user?.full_name || 'User'}</p>
                                <p className="text-xs text-muted-foreground truncate">{roleLabel}</p>
                            </div>
                            {isProfileMenuOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground flex-shrink-0" /> : <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        </div>
                    </button>

                    {isProfileMenuOpen && isSidebarOpen && (
                        <div className="absolute bottom-full left-3 right-3 mb-2 bg-card border border-border rounded-xl shadow-xl overflow-hidden z-50">
                            <button
                                onClick={() => { setIsProfileModalOpen(true); setIsProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-muted-foreground hover:bg-muted flex items-center gap-3 border-b border-border"
                            >
                                <User className="w-4 h-4 text-muted-foreground" /> Profil Saya
                            </button>
                            <button
                                onClick={() => { setShowLogoutConfirm(true); setIsProfileMenuOpen(false); }}
                                className="w-full text-left px-4 py-3 text-sm text-red-600 hover:bg-red-50 flex items-center gap-3"
                            >
                                <LogOut className="w-4 h-4" /> Keluar
                            </button>
                        </div>
                    )}
                </div>
            </aside>

            {/* MAIN */}
            <div className="flex-1 flex flex-col min-w-0 w-full">

                {/* HEADER GLASS */}
                <header className="h-16 bg-card/80 backdrop-blur-md border-b border-border shadow-sm flex items-center justify-between px-4 md:px-6 sticky top-0 z-30">
                    <button
                        onClick={() => setIsSidebarOpen(!isSidebarOpen)}
                        className="p-2 hover:bg-muted rounded-lg text-muted-foreground transition-colors"
                    >
                        <Menu className="w-5 h-5" strokeWidth={2} />
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-sm text-muted-foreground hidden md:block">
                            Selamat datang, <span className="font-semibold text-foreground">{user?.full_name || 'User'}</span>
                        </span>
                    </div>
                </header>

                {/* PAGE CONTENT */}
                <main className="flex-1 overflow-y-auto p-4 md:p-6 w-full min-w-0 bg-muted" style={{ scrollbarGutter: 'stable' }}>
                    <Outlet />
                </main>
            </div>

            {/* MODAL PROFIL */}
            {isProfileModalOpen && (
                <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4 backdrop-blur-sm" onClick={() => setIsProfileModalOpen(false)}>
                    <div className="bg-card border border-border w-full max-w-lg rounded-xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
                        <div className="p-5 border-b border-border flex justify-between items-center bg-card">
                            <h3 className="text-lg font-display font-bold text-foreground">Profil Saya</h3>
                            <button onClick={() => setIsProfileModalOpen(false)} className="p-2 hover:bg-muted rounded-lg transition-colors">
                                <X className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
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
                        </div>
                    </div>
                </div>
            )}

            {/* MODAL LOGOUT */}
            {showLogoutConfirm && (
                <div className="fixed inset-0 bg-black/50 z-[80] flex items-center justify-center p-4 backdrop-blur-sm">
                    <div className="bg-card border border-border w-full max-w-sm rounded-xl shadow-2xl p-6 text-center">
                        <div className="w-12 h-12 bg-red-50 border border-red-200 rounded-full flex items-center justify-center mx-auto mb-4">
                            <LogOut className="w-6 h-6 text-red-500" strokeWidth={2} />
                        </div>
                        <h3 className="text-lg font-display font-bold text-foreground mb-2">Keluar dari Aplikasi?</h3>
                        <p className="text-sm text-muted-foreground mb-6">
                            Apakah Anda yakin ingin keluar? Anda harus login kembali untuk mengakses sistem.
                        </p>
                        <div className="flex gap-3">
                            <button onClick={() => setShowLogoutConfirm(false)} className="flex-1 px-4 py-2.5 bg-card border border-border text-muted-foreground hover:bg-muted rounded-lg text-sm font-semibold transition-colors">
                                Batal
                            </button>
                            <button onClick={handleLogout} className="flex-1 px-4 py-2.5 bg-red-600 text-white hover:bg-red-700 rounded-lg text-sm font-bold transition-colors">
                                Ya, Keluar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
