import { Routes, Route } from 'react-router-dom'
import { Layout } from './layouts/layout/layout'
import { PanelLayout } from './layouts/panelLayout/panelLayout'
import { ProtectedRoute } from './components/protectedRoute/protectedRoute'
import { ComingSoon } from './pages/comingSoon/comingSoon'
import { Home } from './pages/home/home'
import { NotFound } from './pages/notFound/notFound'
import { Panel } from './pages/panel/panel'
import { ResetPassword } from './pages/resetPassword/resetPassword'

function App() {
  return (
    <Routes>
      {/* Páginas públicas con header y footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Secciones del cliente (menú del saludo) */}
        <Route element={<ProtectedRoute roles={['CLIENTE']} />}>
          <Route path="/mis-turnos" element={<ComingSoon title="Mis turnos" />} />
          <Route path="/historial" element={<ComingSoon title="Historial" />} />
          <Route path="/mi-perfil" element={<ComingSoon title="Mi perfil" />} />
        </Route>
      </Route>

      {/* Panel de profesional y admin: header sin nav, contenido y footer */}
      <Route element={<ProtectedRoute roles={['PROFESIONAL', 'ADMIN']} />}>
        <Route element={<PanelLayout />}>
          <Route path="/panel" element={<Panel />} />

          <Route element={<ProtectedRoute roles={['PROFESIONAL']} />}>
            <Route path="/panel/agenda" element={<ComingSoon title="Agenda" />} />
            <Route path="/panel/perfil" element={<ComingSoon title="Perfil" />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/panel/usuarios" element={<ComingSoon title="Usuarios" />} />
          </Route>
        </Route>
      </Route>

      {/* Link del correo de recupero de contraseña */}
      <Route path="/reset-password" element={<ResetPassword />} />

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}

export default App
