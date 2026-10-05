import type { HTMLAttributes, ReactNode } from 'react';

interface LoaderProps extends HTMLAttributes<HTMLDivElement> {
  size?: 'sm' | 'md' | 'lg';
  // Texto debajo del spinner (opcional). Si no hay, se anuncia "Cargando..." solo para lectores de pantalla
  label?: ReactNode;
  // Cubre toda la pantalla con un fondo semitransparente (carga de página)
  fullScreen?: boolean;
}

// Tamaño del círculo y grosor del aro según el tamaño
const sizes = {
  sm: { box: 'w-5 h-5', ring: 3 },
  md: { box: 'w-10 h-10', ring: 4 },
  lg: { box: 'w-16 h-16', ring: 6 },
};

export const Loader = ({ size = 'md', label, fullScreen = false, className = '', ...props }: LoaderProps) => {
  const { box, ring } = sizes[size];

  // Aro con degradado de marca: degradado cónico y máscara que recorta el centro
  const spinnerStyle = {
    background: 'conic-gradient(from 0deg, transparent, var(--color-capilar-violet), var(--color-capilar-peach))',
    mask: `radial-gradient(farthest-side, transparent calc(100% - ${ring}px), #000 calc(100% - ${ring - 1}px))`,
  };

  const content = (
    <div
      role="status"
      aria-live="polite"
      className={`flex flex-col items-center justify-center gap-3 ${fullScreen ? '' : className}`}
      {...(fullScreen ? {} : props)}
    >
      <div className={`${box} rounded-full animate-spin`} style={spinnerStyle} />
      {label ? (
        <span className="font-inter text-sm text-capilar-grey">{label}</span>
      ) : (
        <span className="sr-only">Cargando...</span>
      )}
    </div>
  );

  if (!fullScreen) return content;

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-white/70 backdrop-blur-sm ${className}`}
      {...props}
    >
      {content}
    </div>
  );
};
