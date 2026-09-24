import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Import Providers
import { AuthProvider } from './context/AuthContext'
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
        <App />
        <Toaster position="top-right" richColors />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)