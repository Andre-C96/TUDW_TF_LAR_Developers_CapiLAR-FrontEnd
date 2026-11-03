import type { HTMLAttributes, ReactNode } from 'react';

interface CardProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  // Ícono que se muestra dentro de un círculo arriba de la card (opcional)
  icon?: ReactNode;
  title?: ReactNode;
  // Contenido libre: texto descriptivo, botones, etc.
  children?: ReactNode;
}

export const Card = ({ icon, title, children, className = '', ...props }: CardProps) => {
  return (
    <div
      className={`flex flex-col items-center gap-4 p-8 text-center bg-gray-50 border border-gray-200 rounded-[6px] shadow-md ${className}`}
      {...props}
    >
      {icon && (
        <div className="flex items-center justify-center w-16 h-16 rounded-full bg-white shadow-sm">
          {icon}
        </div>
      )}
      {title && (
        <h3 className="font-inter font-semibold text-lg md:text-xl text-black">
          {title}
        </h3>
      )}
      {children && (
        <div className="font-inter text-sm text-capilar-grey">
          {children}
        </div>
      )}
    </div>
  );
};
