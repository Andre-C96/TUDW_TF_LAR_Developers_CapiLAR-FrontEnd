import { StrictMode } from 'react'
import type { CSSProperties } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.tsx'
import { Toaster } from 'sonner'
import { AuthProvider } from './context/auth/authProvider'
import './index.css'

// Toast de éxito en violeta de marca en lugar del verde de richColors (los de error siguen en rojo)
const toasterStyle = {
  '--success-bg': 'color-mix(in srgb, var(--color-capilar-violet) 8%, white)',
  '--success-border': 'color-mix(in srgb, var(--color-capilar-violet) 35%, white)',
  '--success-text': 'color-mix(in srgb, var(--color-capilar-violet) 70%, black)',
} as CSSProperties

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        {/* Avisos emergentes (toast) de toda la app */}
        <Toaster position="bottom-right" richColors closeButton style={toasterStyle} toastOptions={{ className: 'font-inter' }} />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)
