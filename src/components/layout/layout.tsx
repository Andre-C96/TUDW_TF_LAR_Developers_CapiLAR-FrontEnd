import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/auth/useAuth';
import { AuthModal } from '../authModal/authModal';
import type { AuthView } from '../authModal/authModal';
import { Footer } from '../footer/footer';
import { Header } from '../header/header';

// Lo que las páginas hijas reciben con useOutletContext (ej. el CTA de la home abre el registro)
export interface LayoutContext {
  openAuth: (view: AuthView) => void;
}

// Estructura común de las páginas públicas: header fijo, contenido y footer
export const Layout = () => {
  const location = useLocation();
  const { user, logout } = useAuth();
  // Otra página puede abrir el modal al volver acá (ej. "Iniciar sesión" después de restablecer la contraseña)
  const [authView, setAuthView] = useState<AuthView | null>(
    () => (location.state as { authView?: AuthView } | null)?.authView ?? null,
  );

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        onLoginClick={() => setAuthView('login')}
        onRegisterClick={() => setAuthView('register')}
        userName={user?.nombre}
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
