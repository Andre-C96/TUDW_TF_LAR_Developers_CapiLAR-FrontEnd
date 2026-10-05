import { Routes, Route } from 'react-router-dom'
import { Layout } from './components/layout/layout'
import { Home } from './pages/home/home'
import { NotFound } from './pages/notFound/notFound'
import { ResetPassword } from './pages/resetPassword/resetPassword'

function App() {
  return (
    <Routes>
      {/* Páginas públicas con header y footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />
      </Route>

      {/* Link del correo de recupero de contraseña */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
