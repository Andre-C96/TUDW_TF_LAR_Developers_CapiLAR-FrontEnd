import { Outlet } from 'react-router-dom';
import { toast } from 'sonner';
import { useAuth } from '../../context/auth/useAuth';
import { Footer } from '../../components/footer/footer';
import { Header } from '../../components/header/header';
import { SideMenu } from './sideMenu';

// Estructura del panel de profesional y admin: header sin links de la landing, menú lateral, contenido y footer
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

      {/* Franja blanca detrás del header hasta donde queda el menú lateral (top-24): lo que sube al hacer scroll
          desaparece en esa línea en vez de verse detrás del header */}
      <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-40 h-24 bg-white" />

      {/* Menú lateral fijo (se queda quieto al bajar, hasta el footer) y el contenido al lado */}
      <div className="flex flex-1">
        <SideMenu />
        <main className="min-w-0 flex-1">
          <Outlet />
        </main>
      </div>

      <Footer />
    </div>
  );
};
