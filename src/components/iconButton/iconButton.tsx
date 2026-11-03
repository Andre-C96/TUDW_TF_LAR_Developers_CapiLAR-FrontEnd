import type { ButtonHTMLAttributes } from 'react';

// Trazos de cada ícono (grilla de 24×24) y su color al pasar el mouse
const icons = {
  editar: {
    path: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z',
    title: 'Editar',
    hover: 'hover:border-capilar-violet hover:bg-purple-50 hover:text-capilar-violet',
  },
  eliminar: {
    path: 'M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6M10 11v6M14 11v6',
    title: 'Eliminar',
    hover: 'hover:border-red-300 hover:bg-red-50 hover:text-red-500',
  },
};

interface IconButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> {
  icon: keyof typeof icons;
  // Para lectores de pantalla (ej. "Editar Corte")
  'aria-label': string;
}

// Botón cuadrado solo con el ícono (lápiz o tacho), para las acciones de las filas del admin
export const IconButton = ({ icon, className = '', ...props }: IconButtonProps) => {
  const { path, title, hover } = icons[icon];
  return (
    <button
      type="button"
      title={title}
      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-[6px] border border-gray-300 bg-white text-capilar-grey transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${hover} ${className}`}
      {...props}
    >
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
        className="h-4 w-4"
      >
        <path d={path} />
      </svg>
    </button>
  );
};
