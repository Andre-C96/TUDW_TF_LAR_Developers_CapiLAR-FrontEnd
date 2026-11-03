import { Link, Outlet } from 'react-router-dom';

// Páginas a las que se llega desde un enlace de un correo (recupero, verificación, recordatorio):
// sin header ni footer, solo el logo y el contenido centrado. Cada página arma su caja.
export const LinkLayout = () => (
  <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
    <Link to="/" aria-label="Ir al inicio">
      <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-10 w-auto" />
    </Link>
    <Outlet />
  </main>
);
