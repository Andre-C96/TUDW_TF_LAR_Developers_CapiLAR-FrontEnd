import type { ReactNode } from 'react';

interface GradientIconProps {
  // Id del degradado: tiene que ser único en la página
  id: string;
  // Trazos del ícono en una grilla de 24×24 (rect, path, circle...)
  children: ReactNode;
}

// Ícono de línea con el degradado de marca
export const GradientIcon = ({ id, children }: GradientIconProps) => (
  <svg
    viewBox="0 0 24 24"
    className="h-8 w-8"
    fill="none"
    stroke={`url(#${id})`}
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={id} x1="0" y1="0" x2="24" y2="0" gradientUnits="userSpaceOnUse">
        <stop offset="0" stopColor="var(--color-capilar-violet)" />
        <stop offset="1" stopColor="var(--color-capilar-peach)" />
      </linearGradient>
    </defs>
    {children}
  </svg>
);
