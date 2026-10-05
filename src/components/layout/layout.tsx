import { useState } from 'react';
import { Outlet } from 'react-router-dom';
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
  const [authView, setAuthView] = useState<AuthView | null>(null);

  return (
    <div className="flex min-h-screen flex-col">
      <Header onLoginClick={() => setAuthView('login')} onRegisterClick={() => setAuthView('register')} />

      <main className="flex-1">
        <Outlet context={{ openAuth: setAuthView } satisfies LayoutContext} />
      </main>

      <Footer />

      <AuthModal view={authView} onViewChange={setAuthView} onClose={() => setAuthView(null)} />
    </div>
  );
};
