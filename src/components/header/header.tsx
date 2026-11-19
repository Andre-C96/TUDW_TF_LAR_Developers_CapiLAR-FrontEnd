import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Button } from '../button/button';
import { UserMenu } from '../userMenu/userMenu';
import type { UserMenuItem } from '../userMenu/userMenu';
import { useActiveSection } from '../../customHooks/activeSection/useActiveSection';
import { useDismiss } from '../../customHooks/dismiss/useDismiss';
import { useScrolled } from '../../customHooks/scrolled/useScrolled';

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
const mobileLinkClass = (isActive: boolean) =>
  `block rounded-[6px] px-3 py-2.5 font-inter text-sm font-medium tracking-wide transition-colors hover:bg-gray-50 ${
    isActive ? 'text-capilar-violet-text' : 'text-black'
  }`;

// Tres rayas que pasan a una cruz con el menú abierto
const MenuIcon = ({ isOpen }: { isOpen: boolean }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    aria-hidden="true"
    className="h-6 w-6"
  >
    {isOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
  </svg>
);

// Header fijo. En pantallas chicas (menos de lg) los links y las acciones no entran en una fila:
// quedan el logo y un botón que despliega un menú debajo con todo eso
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
  // Al bajar, sombra violeta para que el header no se pierda sobre el fondo blanco
  const scrolled = useScrolled();
  const logo = <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-7 w-auto sm:h-8" />;

  // Menú de pantallas chicas. El header del panel (sin links ni secciones) entra en una fila y no lo usa
  const hasMobileMenu = showNav || userMenu !== undefined;
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const headerRef = useRef<HTMLElement>(null);
  const closeMenu = () => setIsMenuOpen(false);
  useDismiss(headerRef, isMenuOpen, closeMenu);

  // Link a una sección de la landing: ancla en la home, ruta a la home desde otra página
  const renderNavLink = (link: (typeof navLinks)[number], className: string, content: ReactNode, onClick?: () => void) =>
    isHome ? (
      <a href={link.href} className={className} onClick={onClick}>
        {content}
      </a>
    ) : (
      <Link to={`/${link.href}`} className={className} onClick={onClick}>
        {content}
      </Link>
    );

  return (
    <header
      ref={headerRef}
      className={`fixed top-4 inset-x-4 z-50 bg-white/80 backdrop-blur-md rounded-[6px] transition-shadow duration-300 ${
        scrolled || isMenuOpen ? 'shadow-lg shadow-capilar-violet/30' : 'shadow-md'
      }`}
    >
      <div className="flex items-center justify-between gap-3 px-5 py-2 sm:gap-5">
        {/* Logo: en la home sube al inicio; en cualquier otra página vuelve a la ruta principal */}
        <div className="shrink-0">
          {showNav && isHome ? (
            <a href="#inicio" onClick={closeMenu}>
              {logo}
            </a>
          ) : (
            <Link to="/" onClick={closeMenu}>
              {logo}
            </Link>
          )}
        </div>

        {/* Links de navegación (pantallas grandes) */}
        {showNav && (
          <nav className="hidden lg:block">
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
                return <li key={link.href}>{renderNavLink(link, navLinkClass, content)}</li>;
              })}
            </ul>
          </nav>
        )}

        {/* Acciones (en pantallas chicas, solo si no hay menú desplegable) */}
        <div className={`min-w-0 items-center gap-3 ${hasMobileMenu ? 'hidden lg:flex' : 'flex'}`}>
          {userName ? (
            <>
              {/* El saludo resalta más que la acción de salir. En el celular, solo el nombre (y con "…" si no entra) */}
              {userMenu ? (
                <UserMenu userName={userName} items={userMenu} />
              ) : (
                <span className="truncate font-inter text-base xl:text-lg font-semibold">
                  <span className="hidden sm:inline">Hola, </span>
                  <span className="bg-capilar-gradient bg-clip-text text-transparent">{userName}</span>
                </span>
              )}
              {/* En el celular, "Salir" para que entre al lado del saludo */}
              <Button variant="grey" className="shrink-0 text-xs px-3! py-1! border! shadow-none!" onClick={onLogoutClick}>
                <span className="sm:hidden">SALIR</span>
                <span className="hidden sm:inline">CERRAR SESIÓN</span>
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

        {/* Botón del menú (pantallas chicas) */}
        {hasMobileMenu && (
          <button
            type="button"
            onClick={() => setIsMenuOpen((open) => !open)}
            aria-expanded={isMenuOpen}
            aria-controls="menu-mobile"
            aria-label={isMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
            className="-mr-2 flex h-10 w-10 items-center justify-center rounded-[6px] text-capilar-grey transition-colors hover:bg-gray-100 hover:text-capilar-violet lg:hidden"
          >
            <MenuIcon isOpen={isMenuOpen} />
          </button>
        )}
      </div>

      {/* Menú desplegado (pantallas chicas): links de la landing y, debajo, el acceso o las secciones del usuario */}
      {hasMobileMenu && isMenuOpen && (
        <div id="menu-mobile" className="flex flex-col gap-3 border-t border-gray-200 px-3 pt-3 pb-4 lg:hidden">
          {showNav && (
            <nav aria-label="Secciones">
              <ul className="flex flex-col">
                {navLinks.map((link) => (
                  <li key={link.href}>
                    {renderNavLink(link, mobileLinkClass(activeId === link.href.slice(1)), link.label, closeMenu)}
                  </li>
                ))}
              </ul>
            </nav>
          )}

          <div className={`flex flex-col gap-3 px-2 ${showNav ? 'border-t border-gray-200 pt-4' : ''}`}>
            {userName ? (
              <>
                <p className="px-1 font-inter text-base font-semibold">
                  Hola, <span className="bg-capilar-gradient bg-clip-text text-transparent">{userName}</span>
                </p>
                {userMenu && (
                  <ul className="-mx-2 -mt-1 flex flex-col">
                    {userMenu.map((item) => (
                      <li key={item.to}>
                        <Link to={item.to} onClick={closeMenu} className={mobileLinkClass(false)}>
                          {item.label}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
                <Button
                  variant="grey"
                  className="w-full py-2! text-xs border! shadow-none!"
                  onClick={() => {
                    closeMenu();
                    onLogoutClick?.();
                  }}
                >
                  CERRAR SESIÓN
                </Button>
              </>
            ) : (
              <>
                <Button
                  variant="primario"
                  className="w-full text-sm"
                  onClick={() => {
                    closeMenu();
                    onRegisterClick?.();
                  }}
                >
                  REGISTRARSE
                </Button>
                <Button
                  variant="secundario"
                  className="w-full text-sm"
                  onClick={() => {
                    closeMenu();
                    onLoginClick?.();
                  }}
                >
                  INICIAR SESIÓN
                </Button>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
};
