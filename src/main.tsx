import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Import Providers
import { TicketProvider } from './context/TicketContext'
import { AuthProvider } from './context/AuthContext' // <-- TAMBAHKAN INI
import { Toaster } from 'sonner'

import './index.css'
import App from './App.tsx'
import { applyTheme } from './lib/theme'

// Theme: default terang; dark mode hanya bila diaktifkan via toggle di header.
applyTheme()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider> {/* <-- TAMBAHKAN INI (Membungkus App agar bisa pakai useNavigate) */}
        <TicketProvider>
          <App />
          <Toaster position="top-right" richColors />
        </TicketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)