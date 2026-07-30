import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'

// Import Providers
import { TicketProvider } from './context/TicketContext'
import { AuthProvider } from './context/AuthContext' // <-- TAMBAHKAN INI

import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider> {/* <-- TAMBAHKAN INI (Membungkus App agar bisa pakai useNavigate) */}
        <TicketProvider>
          <App />
        </TicketProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)