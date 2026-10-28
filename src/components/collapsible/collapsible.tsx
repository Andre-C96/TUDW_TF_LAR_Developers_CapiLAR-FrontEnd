import { useId, useState } from 'react';
import type { ReactNode } from 'react';

const variants = {
  // Título de sección de una página (ej. "Anteriores" en Mis turnos)
  seccion: {
    heading: 'font-inter text-xl font-semibold text-black md:text-2xl',
    button: 'border-b border-gray-200 pb-3',
  },
  // Grupo dentro de una lista (ej. un día de la agenda)
  grupo: {
    heading: 'font-inter text-base font-semibold text-black first-letter:uppercase',
    button: 'rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm hover:bg-gray-50',
  },
};

interface CollapsibleProps {
  title: ReactNode;
  // Al lado del título (ej. la cantidad de turnos)
  aside?: ReactNode;
  defaultOpen?: boolean;
  variant?: keyof typeof variants;
  as?: 'h2' | 'h3';
  children: ReactNode;
  className?: string;
}

// Bloque con título que se despliega hacia abajo
export const Collapsible = ({
  title,
  aside,
  defaultOpen = false,
  variant = 'seccion',
  as: Heading = 'h2',
  children,
  className = '',
}: CollapsibleProps) => {
  const [abierto, setAbierto] = useState(defaultOpen);
  const contenidoId = useId();
  const styles = variants[variant];

  return (
    <section className={`flex flex-col ${className}`}>
      <Heading>
        <button
          type="button"
          onClick={() => setAbierto(!abierto)}
          aria-expanded={abierto}
          aria-controls={contenidoId}
          className={`flex w-full items-center gap-3 text-left transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-capilar-violet ${styles.button}`}
        >
          <span className={styles.heading}>{title}</span>
          {aside}
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`ml-auto h-5 w-5 shrink-0 text-capilar-grey transition-transform duration-300 ${abierto ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </Heading>

      {/* Truco de grid (0fr → 1fr) para animar la altura al desplegar */}
      <div
        id={contenidoId}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${abierto ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden" inert={!abierto}>
          <div className="pt-4">{children}</div>
        </div>
      </div>
    </section>
  );
};

const countColors = {
  // Lo vigente (ej. turnos próximos)
  violeta: 'bg-purple-50 text-capilar-violet',
  // Lo que ya pasó o se canceló
  gris: 'bg-gray-100 text-capilar-grey',
};

// Cantidad al lado de un título, en una pastilla
export const CountBadge = ({ children, color = 'gris' }: { children: ReactNode; color?: keyof typeof countColors }) => (
  <span className={`rounded-full px-2.5 py-0.5 font-inter text-xs font-semibold ${countColors[color]}`}>{children}</span>
);
