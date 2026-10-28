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
