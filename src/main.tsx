import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/auth/authProvider'
import './index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Avisos emergentes (toast) de toda la app */}
        <Toaster position="bottom-right" richColors closeButton toastOptions={{ className: 'font-inter' }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
