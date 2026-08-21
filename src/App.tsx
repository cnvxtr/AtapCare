import { useState } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'

import Login from './pages/Login'
import MainLayout from './components/layout/MainLayout'
import MobileLayout from './components/mobile/MobileLayout'
import SplashScreen from './components/mobile/SplashScreen'
import { isNativePlatform, useIsMobile } from './lib/platform'
import { TicketProvider } from './context/TicketContext'
import HPDashboard from './pages/Helpdesk/HPDashboard'
import HPInbox from './pages/Helpdesk/HPInbox'
import HPReport from './pages/Helpdesk/HPReport'
import TugasTeknisi from './pages/Teknisi/Tugas'
import PMCommandCenter from './pages/Project_Management/PMCommandCenter'
import PMDashboard from './pages/Project_Management/PMDashboard'
import { AdminDashboard } from './pages/Admin/AdminDashboard'
import { AdminUsers } from './pages/Admin/AdminUsers'
import { AdminMasterData } from './pages/Admin/AdminMasterData'
import { AdminReports } from './pages/Admin/AdminReports'

import Landing from './pages/indexclient'
import Troubleshoot from './pages/Troubleshoot'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'

import CustomerDashboard from './pages/Customer/CustomerDashboard'
import CustomerReport from './pages/Customer/CustomerReport'
import CustomerTicketDetail from './pages/Customer/CustomerTicketDetail'
import ExecutiveDashboard from './pages/Executive/ExecutiveDashboard'
import ExecutiveInbox from './pages/Executive/ExecutiveInbox'
import ExecutiveReport from './pages/Executive/ExecutiveReport'
import Profile from './pages/Profile'

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
  if (user?.role === 'customer') return <Navigate to="/customer" replace />
  if (user?.role === 'executive') return <Navigate to="/executive" replace />
  return <Navigate to="/dashboard" replace />
}

function RoleDashboard() {
  const { user } = useAuth()
  if (user?.role === 'pm') return <PMDashboard />
  if (user?.role === 'customer') return <CustomerDashboard />
  if (user?.role === 'executive') return <ExecutiveDashboard />
  return <HPDashboard />
}

function AppRoutes() {
  const { isAuthenticated, user, loading } = useAuth()
  const [splashDone, setSplashDone] = useState(() => !isNativePlatform())

  if (!splashDone) {
    return <SplashScreen onFinish={() => setSplashDone(true)} />
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-muted">
        <p className="text-muted-foreground font-medium">Memuat sistem...</p>
      </div>
    )
  }

  const isMobile = useIsMobile()
  const AppLayout = isMobile ? MobileLayout : MainLayout

  return (
    <Routes>
      {/* GERBANG 1: Portal Publik (Tanpa Login) */}
      <Route path="/" element={<Landing />} />
      <Route path="/troubleshoot/:scenario" element={<Troubleshoot />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/terms" element={<Terms />} />

      {/* GERBANG 2: Login Karyawan */}
      <Route
        path="/login"
        element={isAuthenticated ? <Navigate to={
          user?.role === 'admin' ? '/admin' :
          user?.role === 'teknisi' ? '/tugas' :
          user?.role === 'customer' ? '/customer' :
          user?.role === 'executive' ? '/executive' : '/dashboard'
        } replace /> : <Login />}
      />

      {/* GERBANG 2: Halaman Terproteksi */}
      <Route
        element={
          <ProtectedRoute>
            <TicketProvider>
              <AppLayout />
            </TicketProvider>
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
        <Route path="/admin/reports" element={<RoleGate roles={['admin']}><AdminReports /></RoleGate>} />

        <Route path="/customer" element={<RoleGate roles={['customer']}><CustomerDashboard /></RoleGate>} />
        <Route path="/customer/report" element={<RoleGate roles={['customer']}><CustomerReport /></RoleGate>} />
        <Route path="/customer/ticket/:ticketCode" element={<RoleGate roles={['customer']}><CustomerTicketDetail /></RoleGate>} />

        <Route path="/executive" element={<RoleGate roles={['executive']}><ExecutiveDashboard /></RoleGate>} />
        <Route path="/executive/inbox" element={<RoleGate roles={['executive']}><ExecutiveInbox /></RoleGate>} />
        <Route path="/executive/reports" element={<RoleGate roles={['executive']}><ExecutiveReport /></RoleGate>} />

        <Route path="/profile" element={<Profile />} />
      </Route>

      {/* Fallback: tampilkan 404 */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default function App() {
  return <AppRoutes />
}
