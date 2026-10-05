import type { HTMLAttributes, ReactNode } from 'react';
import { Link } from 'react-router-dom';

export interface BreadcrumbItem {
  label: ReactNode;
  // Ruta a la que lleva; si no se pasa, se muestra como texto
  to?: string;
}

interface BreadcrumbsProps extends HTMLAttributes<HTMLElement> {
  // De la página más general a la actual (ej. Inicio › Servicios › Corte)
  items: BreadcrumbItem[];
  // Separador entre elementos
  separator?: ReactNode;
}

// Migas de pan: muestra dónde está el usuario y permite volver a los niveles anteriores
export const Breadcrumbs = ({ items, separator = '›', className = '', ...props }: BreadcrumbsProps) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Ruta de navegación" className={`font-inter text-sm ${className}`} {...props}>
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((item, index) => {
          // El último elemento es la página actual: nunca es link
          const isCurrent = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {isCurrent ? (
                <span aria-current="page" className="font-semibold text-black">
                  {item.label}
                </span>
              ) : item.to ? (
                <Link to={item.to} className="text-capilar-grey hover:text-capilar-violet transition-colors">
                  {item.label}
                </Link>
              ) : (
                <span className="text-capilar-grey">{item.label}</span>
              )}
              {!isCurrent && (
                <span aria-hidden="true" className="text-gray-400">
                  {separator}
                </span>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};
