import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Import Providers
import { AuthProvider } from './context/AuthContext'
import { Toaster } from 'sonner'

import './index.css'
import App from './App.tsx'
import { isNativePlatform } from './lib/platform'

// Daftarkan service worker sejak app dibuka (bukan hanya setelah login) supaya
// PWA bisa di-install dan push siap; di APK native tidak perlu.
if ('serviceWorker' in navigator && !isNativePlatform()) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => { })
  })
}

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