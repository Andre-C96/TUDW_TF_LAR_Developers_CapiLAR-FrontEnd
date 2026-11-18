import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  // Ícono que se muestra dentro de un círculo arriba de la card (opcional)
  icon?: ReactNode;
  title?: ReactNode;
  // Contenido libre: texto descriptivo, botones, etc.
  children?: ReactNode;
  // Más chica, para grillas con varias por línea
  compact?: boolean;
}

export const Card = ({ icon, title, children, compact = false, className = '', ...props }: CardProps) => {
  return (
    <div
      className={`flex flex-col items-center text-center ${compact ? 'gap-2 p-4' : 'gap-4 p-8'} bg-gray-50 border border-gray-200 rounded-[6px] shadow-md ${className}`}
      {...props}
    >
      {icon && (
        <div className={`flex items-center justify-center rounded-full bg-white shadow-sm ${compact ? 'h-11 w-11' : 'h-16 w-16'}`}>
          {icon}
        </div>
      )}
      {title && (
        <h3 className={`font-inter font-semibold text-black ${compact ? 'text-base' : 'text-lg md:text-xl'}`}>
          {title}
        </h3>
      )}
      {children && (
        <div className={`font-inter text-capilar-grey ${compact ? 'text-xs' : 'text-sm'}`}>
          {children}
        </div>
      )}
    </div>
  );
};
