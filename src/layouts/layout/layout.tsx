import { useEffect, useState } from 'react';
import { Navigate, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/auth/useAuth';
import { AuthModal } from '../../components/authModal/authModal';
import type { AuthView } from '../../components/authModal/authModal';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { Loader } from '../../components/loader/loader';
import type { UserMenuItem } from '../../components/userMenu/userMenu';

// Lo que las páginas hijas reciben con useOutletContext (ej. el CTA de la home abre el registro)
export interface LayoutContext {
  openAuth: (view: AuthView) => void;
}

// Secciones del cliente en el menú del saludo
const clientMenu: UserMenuItem[] = [
  { label: 'Mis turnos', to: '/mis-turnos' },
  { label: 'Historial', to: '/historial' },
  { label: 'Mi perfil', to: '/mi-perfil' },
];

// Estructura común de las páginas públicas: header fijo, contenido y footer
export const Layout = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout, isCheckingSession, hasRole } = useAuth();
  const requestedView = (location.state as { authView?: AuthView } | null)?.authView;
  // Otra página puede abrir el modal al volver acá (ej. "Iniciar sesión" después de restablecer la contraseña)
  const [authView, setAuthView] = useState<AuthView | null>(requestedView ?? null);

  // El state queda guardado en el historial y sobrevive al recargar: se borra una vez usado
  // para que el modal no vuelva a abrirse en cada recarga
  useEffect(() => {
    if (requestedView) navigate(location.pathname, { replace: true, state: null });
  }, [requestedView, location.pathname, navigate]);

  // Al recargar con sesión guardada, esperar al backend para no mostrar la home a quien va al panel
  if (isCheckingSession) return <Loader size="lg" fullScreen />;

  // Profesional y admin no usan las páginas públicas: van a su panel (también justo después del login)
  if (hasRole('PROFESIONAL', 'ADMIN')) return <Navigate to="/panel" replace />;

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        onLoginClick={() => setAuthView('login')}
        onRegisterClick={() => setAuthView('register')}
        userName={user?.nombre}
        userMenu={hasRole('CLIENTE') ? clientMenu : undefined}
        onLogoutClick={() => {
          logout();
          toast('Cerraste sesión', { description: '¡Te esperamos pronto!' });
        }}
      />

      <main className="flex-1">
        <Outlet context={{ openAuth: setAuthView } satisfies LayoutContext} />
      </main>

      <Footer />

      <AuthModal view={authView} onViewChange={setAuthView} onClose={() => setAuthView(null)} />
    </div>
  );
};
