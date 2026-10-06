import { Routes, Route } from 'react-router-dom'
import { Layout } from './layouts/layout/layout'
import { PanelLayout } from './layouts/panelLayout/panelLayout'
import { ProtectedRoute } from './components/protectedRoute/protectedRoute'
import { AdminServices } from './pages/adminServices/adminServices'
import { Agenda } from './pages/agenda/agenda'
import { Booking } from './pages/booking/booking'
import { ComingSoon } from './pages/comingSoon/comingSoon'
import { Home } from './pages/home/home'
import { MyTurnos } from './pages/myTurnos/myTurnos'
import { NotFound } from './pages/notFound/notFound'
import { Panel } from './pages/panel/panel'
import { Profile } from './pages/profile/profile'
import { ResetPassword } from './pages/resetPassword/resetPassword'
import { Users } from './pages/users/users'

function App() {
  return (
    <Routes>
      {/* Páginas públicas con header y footer */}
      <Route element={<Layout />}>
        <Route path="/" element={<Home />} />

        {/* Secciones del cliente (menú del saludo) */}
        <Route element={<ProtectedRoute roles={['CLIENTE']} />}>
          <Route path="/reservar" element={<Booking />} />
          <Route path="/mis-turnos" element={<MyTurnos />} />
          <Route path="/historial" element={<ComingSoon title="Historial" />} />
          <Route path="/mi-perfil" element={<Profile />} />
        </Route>
      </Route>

      {/* Panel de profesional y admin: header sin nav, contenido y footer */}
      <Route element={<ProtectedRoute roles={['PROFESIONAL', 'ADMIN']} />}>
        <Route element={<PanelLayout />}>
          <Route path="/panel" element={<Panel />} />

          <Route element={<ProtectedRoute roles={['PROFESIONAL']} />}>
            <Route path="/panel/agenda" element={<Agenda />} />
            <Route path="/panel/perfil" element={<Profile />} />
          </Route>

          <Route element={<ProtectedRoute roles={['ADMIN']} />}>
            <Route path="/panel/usuarios" element={<Users />} />
            <Route path="/panel/servicios" element={<AdminServices />} />
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
