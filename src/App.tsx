import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import MainLayout from './components/layout/MainLayout'
import Dashboard from './pages/Helpdesk/Dashboard'
import Inbox from './pages/Helpdesk/Inbox'
import Active from './pages/Helpdesk/Active'
import Archive from './pages/Helpdesk/Archive'
import TugasTeknisi from './pages/Teknisi/Tugas'

import Landing from './pages/indexclient'
import ReportPage from './pages/report'
import TrackPage from './pages/track'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground font-medium">Memeriksa sesi login...</p>
      </div>
    )
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}

function RoleGate({ roles, children }: { roles: string[]; children: React.ReactNode }) {
  const { user } = useAuth()
  if (user && roles.includes(user.role)) return <>{children}</>
  if (user?.role === 'teknisi') return <Navigate to="/tugas" replace />
  return <Navigate to="/dashboard" replace />
}

function AppRoutes() {
  const { isAuthenticated, user, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground font-medium">Memuat sistem...</p>
      </div>
    )
  }

  return (
    <Routes>
      {/* GERBANG 1: Portal Publik (Tanpa Login) */}
      <Route path="/" element={<Landing />} />
      <Route path="/report" element={<ReportPage />} />
      <Route path="/track" element={<TrackPage />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* GERBANG 2: Login Karyawan */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={user?.role === 'teknisi' ? '/tugas' : '/dashboard'} replace /> : <Login />}
      />

      {/* GERBANG 2: Halaman Terproteksi */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<RoleGate roles={['helpdesk', 'pm', 'admin']}><Dashboard /></RoleGate>} />
        <Route path="/inbox" element={<RoleGate roles={['helpdesk']}><Inbox /></RoleGate>} />
        <Route path="/active" element={<RoleGate roles={['helpdesk']}><Active /></RoleGate>} />
        <Route path="/archive" element={<RoleGate roles={['helpdesk']}><Archive /></RoleGate>} />
        <Route path="/tugas" element={<RoleGate roles={['teknisi']}><TugasTeknisi /></RoleGate>} />
      </Route>

      {/* Fallback: tampilkan 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
