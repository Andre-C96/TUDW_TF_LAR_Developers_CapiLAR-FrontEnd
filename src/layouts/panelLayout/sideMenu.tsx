import type { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/auth/useAuth';
import { panelSections, subsectionHref } from './panelSections';

const MenuIcon = ({ children }: { children: ReactNode }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className="h-5 w-5 shrink-0"
  >
    {children}
  </svg>
);

const itemClass = (activo: boolean) =>
  `flex items-center gap-3 rounded-[6px] px-3 py-2 font-inter text-sm font-semibold transition-colors ${
    activo ? 'bg-purple-50 text-capilar-violet' : 'text-capilar-grey hover:bg-gray-50 hover:text-capilar-violet'
  }`;

// Menú lateral fijo del panel según el rol: el inicio, cada sección y, debajo, sus subopciones (pestañas o filtros).
// En pantallas medianas queda solo con los íconos; en las chicas no se muestra (se navega desde las cards del inicio).
export const SideMenu = () => {
  const { hasRole } = useAuth();
  const { pathname, search } = useLocation();
  const params = new URLSearchParams(search);
  const sections = panelSections.filter((section) => hasRole(...section.roles));

  return (
    <aside className="sticky top-24 mt-32 ml-4 hidden max-h-[calc(100dvh-7rem)] shrink-0 self-start md:block">
      <nav
        aria-label="Menú del panel"
        className="scrollbar-soft flex max-h-[calc(100dvh-7rem)] w-16 flex-col gap-1 overflow-y-auto rounded-[6px] border border-gray-200 bg-white p-2 shadow-sm lg:w-60 lg:p-3"
      >
        <Link to="/panel" title="Inicio" aria-current={pathname === '/panel' ? 'page' : undefined} className={itemClass(pathname === '/panel')}>
          <MenuIcon>
            <path d="M3 11l9-8 9 8M5 10v10h14V10" />
          </MenuIcon>
          <span className="hidden lg:inline">Inicio</span>
        </Link>

        {sections.map((section) => {
          const activa = pathname.startsWith(section.to);
          return (
            <div key={section.to} className="flex flex-col">
              <Link
                to={section.to}
                title={section.title}
                aria-current={activa && pathname === section.to && !search ? 'page' : undefined}
                className={itemClass(activa)}
              >
                <MenuIcon>{section.icon}</MenuIcon>
                <span className="hidden lg:inline">{section.title}</span>
              </Link>

              {section.subsections && (
                <ul className="mt-1 mb-2 ml-[1.375rem] hidden flex-col border-l border-gray-200 lg:flex">
                  {section.subsections.map((sub) => {
                    const [key, value] = sub.param;
                    const elegida = pathname === section.to && params.get(key) === value;
                    return (
                      <li key={sub.label}>
                        <Link
                          to={subsectionHref(section, sub)}
                          aria-current={elegida ? 'page' : undefined}
                          className={`-ml-px block border-l-2 py-1.5 pr-2 pl-4 font-inter text-sm transition-colors ${
                            elegida
                              ? 'border-capilar-violet font-semibold text-capilar-violet'
                              : 'border-transparent text-capilar-grey hover:text-capilar-violet'
                          }`}
                        >
                          {sub.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          );
        })}
      </nav>
    </aside>
  );
};
