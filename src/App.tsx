import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import MainLayout from './components/layout/MainLayout'
import HPDashboard from './pages/Helpdesk/HPDashboard'
import HPInbox from './pages/Helpdesk/HPInbox'
import HPReport from './pages/Helpdesk/HPReport'
import TugasTeknisi from './pages/Teknisi/Tugas'
import PMCommandCenter from './pages/Project_Management/PMCommandCenter'
import PMDashboard from './pages/Project_Management/PMDashboard'
import { AdminDashboard } from './pages/Admin/AdminDashboard'
import { AdminUsers } from './pages/Admin/AdminUsers'
import { AdminMasterData } from './pages/Admin/AdminMasterData'
import { AdminSlaConfig } from './pages/Admin/AdminSlaConfig'
import { AdminReports } from './pages/Admin/AdminReports'

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
  if (user?.role === 'admin') return <Navigate to="/admin" replace />
  if (user?.role === 'teknisi') return <Navigate to="/tugas" replace />
  return <Navigate to="/dashboard" replace />
}

function RoleDashboard() {
  const { user } = useAuth()
  return user?.role === 'pm' ? <PMDashboard /> : <HPDashboard />
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
        element={isAuthenticated ? <Navigate to={user?.role === 'admin' ? '/admin' : user?.role === 'teknisi' ? '/tugas' : '/dashboard'} replace /> : <Login />}
      />

      {/* GERBANG 2: Halaman Terproteksi */}
      <Route
        element={
          <ProtectedRoute>
            <MainLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/dashboard" element={<RoleGate roles={['helpdesk', 'pm']}><RoleDashboard /></RoleGate>} />
        <Route path="/inbox" element={<RoleGate roles={['helpdesk']}><HPInbox /></RoleGate>} />
        <Route path="/reports" element={<RoleGate roles={['helpdesk']}><HPReport /></RoleGate>} />
        <Route path="/tugas" element={<RoleGate roles={['teknisi']}><TugasTeknisi /></RoleGate>} />
        <Route path="/command-center" element={<RoleGate roles={['pm']}><PMCommandCenter /></RoleGate>} />

        <Route path="/admin" element={<RoleGate roles={['admin']}><AdminDashboard /></RoleGate>} />
        <Route path="/admin/users" element={<RoleGate roles={['admin']}><AdminUsers /></RoleGate>} />
        <Route path="/admin/master-data" element={<RoleGate roles={['admin']}><AdminMasterData /></RoleGate>} />
        <Route path="/admin/sla" element={<RoleGate roles={['admin']}><AdminSlaConfig /></RoleGate>} />
        <Route path="/admin/reports" element={<RoleGate roles={['admin']}><AdminReports /></RoleGate>} />
      </Route>

      {/* Fallback: tampilkan 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
