import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/auth/useAuth';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';

// Estructura del panel de profesional y admin: header sin links de la landing, contenido y footer
export const PanelLayout = () => {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <Header
        showNav={false}
        userName={user?.nombre}
        onLogoutClick={() => {
          // Sin sesión, ProtectedRoute redirige a la home
          logout();
          toast('Cerraste sesión', { description: '¡Te esperamos pronto!' });
        }}
      />

      <main className="flex-1">
        <Outlet />
      </main>

      <Footer />
    </div>
  );
};
