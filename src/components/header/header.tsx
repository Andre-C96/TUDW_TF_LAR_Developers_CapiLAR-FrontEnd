import { Link, useLocation } from 'react-router-dom';
import { Button } from '../button/button';
import { UserMenu } from '../userMenu/userMenu';
import type { UserMenuItem } from '../userMenu/userMenu';
import { useActiveSection } from '../../customHooks/activeSection/useActiveSection';

interface HeaderProps {
  onLoginClick?: () => void;
  onRegisterClick?: () => void;
  // Nombre del usuario logueado: si viene, se muestra el saludo y "Cerrar sesión" en lugar de los botones de acceso
  userName?: string;
  onLogoutClick?: () => void;
  // false en el panel de profesional y admin: solo logo, saludo y "Cerrar sesión"
  showNav?: boolean;
  // Secciones del usuario: si vienen, el saludo despliega un menú con ellas
  userMenu?: UserMenuItem[];
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
const noSections: string[] = [];

const navLinkClass = 'group relative py-1 font-inter text-sm xl:text-base 2xl:text-xl font-medium tracking-wide';

export const Header = ({
  onLoginClick,
  onRegisterClick,
  userName,
  onLogoutClick,
  showNav = true,
  userMenu,
}: HeaderProps) => {
  // Las secciones existen solo en la home: fuera de ella los links vuelven a la home y bajan a la sección
  const isHome = useLocation().pathname === '/';
  // Al cambiar la lista, el hook vuelve a observar (ej. al volver a la home desde "Mis turnos")
  const activeId = useActiveSection(showNav && isHome ? sectionIds : noSections);
  const logo = <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-8 w-auto" />;

  return (
    <header className="fixed top-4 inset-x-4 z-50 flex items-center justify-between gap-5 px-5 py-2 bg-white/80 backdrop-blur-md rounded-[6px] shadow-md">
      {/* Logo: en la home sube al inicio; en cualquier otra página vuelve a la ruta principal */}
      {showNav && isHome ? <a href="#inicio">{logo}</a> : <Link to="/">{logo}</Link>}

      {/* Links de navegación */}
      {showNav && (
        <nav>
          <ul className="flex items-center gap-5 2xl:gap-8">
            {navLinks.map((link) => {
              const isActive = activeId === link.href.slice(1);
              const content = (
                <>
                  {link.label}
                  {/* Línea con degradado: aparece al pasar el mouse y queda fija en la sección actual */}
                  <span
                    className={`absolute left-0 -bottom-0.5 h-[2px] w-full bg-capilar-gradient origin-left transition-transform duration-300 ${
                      isActive ? 'scale-x-100' : 'scale-x-0 group-hover:scale-x-100'
                    }`}
                  />
                </>
              );
              return (
                <li key={link.href}>
                  {isHome ? (
                    <a href={link.href} className={navLinkClass}>
                      {content}
                    </a>
                  ) : (
                    <Link to={`/${link.href}`} className={navLinkClass}>
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ul>
        </nav>
      )}

      {/* Acciones */}
      <div className="flex items-center gap-3">
        {userName ? (
          <>
            {/* El saludo resalta más que la acción de salir */}
            {userMenu ? (
              <UserMenu userName={userName} items={userMenu} />
            ) : (
              <span className="font-inter text-base xl:text-lg font-semibold">
                Hola, <span className="bg-capilar-gradient bg-clip-text text-transparent">{userName}</span>
              </span>
            )}
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
