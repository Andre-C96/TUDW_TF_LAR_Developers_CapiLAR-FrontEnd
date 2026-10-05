import { Button } from '../button/button';
import { useActiveSection } from '../../customHooks/activeSection/useActiveSection';

interface HeaderProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  // Nombre del usuario logueado: si viene, se muestra el saludo y "Cerrar sesión" en lugar de los botones de acceso
  userName?: string;
  onLogoutClick?: () => void;
}

// Anclas a las secciones de la landing (scroll suave, no cambian de ruta)
const navLinks = [
  { label: 'INICIO', href: '#inicio' },
  { label: 'SERVICIOS', href: '#servicios' },
  { label: 'NOSOTROS', href: '#nosotros' },
  { label: 'CONTACTO', href: '#contacto' },
];

// Fuera del componente para que no cambie en cada render (si no, el hook se reinicia siempre)
const sectionIds = navLinks.map((link) => link.href.slice(1));

export const Header = ({ onLoginClick, onRegisterClick, userName, onLogoutClick }: HeaderProps) => {
  const activeId = useActiveSection(sectionIds);

  return (
    <header className="fixed top-4 inset-x-4 z-50 flex items-center justify-between gap-5 px-5 py-2 bg-white/80 backdrop-blur-md rounded-[6px] shadow-md">
      {/* Logo */}
      <a href="#inicio">
        <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-8 w-auto" />
      </a>

      {/* Links de navegación */}
      <nav>
        <ul className="flex items-center gap-5 2xl:gap-8">
          {navLinks.map((link) => {
            const isActive = activeId === link.href.slice(1);
            return (
              <li key={link.href}>
                <a
                  href={link.href}
                  className="group relative py-1 font-inter text-sm xl:text-base 2xl:text-xl font-medium tracking-wide"
                >
                  {link.label}
                  {/* Línea con degradado: aparece al pasar el mouse y queda fija en la sección actual */}
                  <span
                    className={`absolute left-0 -bottom-0.5 h-[2px] w-full bg-capilar-gradient origin-left transition-transform duration-300 ${
                      isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </a>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Acciones */}
      <div className="flex items-center gap-3">
        {userName ? (
          <>
            {/* El saludo resalta más que la acción de salir */}
            <span className="font-inter text-base xl:text-lg font-semibold">
              Hola, <span className="bg-capilar-gradient bg-clip-text text-transparent">{userName}</span>
            </span>
            <Button variant="grey" className="text-xs px-3! py-1! border! shadow-none!" onClick={onLogoutClick}>
              CERRAR SESIÓN
            </Button>
          </>
        ) : (
          <>
            <Button variant="primario" className="text-sm" onClick={onRegisterClick}>
              REGISTRARSE
            </Button>
            <Button variant="secundario" className="text-sm" onClick={onLoginClick}>
              INICIAR SESIÓN
            </Button>
          </>
        )}
      </div>
    </header>
  );
};
