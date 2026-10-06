import { useEffect, useRef, useState } from 'react';
import type { Key, ReactNode } from 'react';

interface CarouselProps<T> {
  items: T[];
  // Cómo se dibuja cada elemento (ocupa todo el ancho y alto de su lugar)
  renderItem: (item: T) => ReactNode;
  // Clave única de cada elemento (ej. el id que viene de la API)
  getKey: (item: T) => Key;
  // Texto para lectores de pantalla (ej. "Servicios")
  label: string;
  // Encabezado opcional (ej. el título de la sección): va centrado, con los circulitos de página a su derecha
  title?: ReactNode;
  // Ancho de cada elemento y separación entre ellos, en px
  itemWidth?: number;
  gap?: number;
}

// Flecha a un costado del carrusel, por fuera de los elementos (necesita margen: en celular se oculta y se desliza con el dedo).
// Deshabilitada en la primera o la última página: el carrusel no vuelve a empezar.
const ArrowButton = ({
  direction,
  onClick,
  disabled,
}: {
  direction: 'prev' | 'next';
  onClick: () => void;
  disabled: boolean;
}) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    aria-label={direction === 'prev' ? 'Página anterior' : 'Página siguiente'}
    className={`absolute top-1/2 z-10 hidden h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-white text-capilar-violet shadow-md transition hover:bg-capilar-violet hover:text-white disabled:pointer-events-none disabled:opacity-40 md:flex ${
      direction === 'prev' ? '-left-11' : '-right-11'
    }`}
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d={direction === 'prev' ? 'M15 18l-6-6 6-6' : 'M9 18l6-6-6-6'} />
    </svg>
  </button>
);

// Carrusel horizontal por páginas: entran tantos elementos completos como permita el ancho,
// se desliza con el dedo o el trackpad (frena al principio de cada página) y arriba a la derecha (a la altura
// del título, si tiene) hay un circulito por página para ver en cuál se está y saltar a otra; a los costados,
// flechas de anterior y siguiente. Con una sola página, los elementos quedan centrados y sin circulitos.
export const Carousel = <T,>({
  items,
  renderItem,
  getKey,
  label,
  title,
  itemWidth = 224,
  gap = 24,
}: CarouselProps<T>) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLUListElement>(null);
  const [perPage, setPerPage] = useState(1);
  const [page, setPage] = useState(0);

  // Cuántos elementos completos entran en el ancho disponible (se recalcula al cambiar el tamaño de la ventana)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const observer = new ResizeObserver(([entry]) => {
      setPerPage(Math.max(1, Math.floor((entry.contentRect.width + gap) / (itemWidth + gap))));
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [itemWidth, gap]);

  const visible = Math.min(perPage, items.length);
  const pages = Math.ceil(items.length / perPage);
  const currentPage = Math.min(page, pages - 1);
  // El carrusel mide justo lo que ocupan los elementos visibles: ninguno queda cortado
  const trackWidth = visible * itemWidth + (visible - 1) * gap;
  const pageWidth = perPage * (itemWidth + gap);

  const handleScroll = () => {
    const track = trackRef.current;
    if (!track) return;
    // La última página puede tener menos elementos: al llegar al final, es la última
    const atEnd = track.scrollLeft + track.clientWidth >= track.scrollWidth - 2;
    setPage(atEnd ? pages - 1 : Math.round(track.scrollLeft / pageWidth));
  };

  const goTo = (target: number) => trackRef.current?.scrollTo({ left: target * pageWidth, behavior: 'smooth' });

  return (
    <div ref={containerRef} className="w-full">
      <div className={`mx-auto flex max-w-full flex-col ${title ? 'gap-8' : 'gap-3'}`} style={{ width: trackWidth }}>
        {(title || pages > 1) && (
          // En celular, los circulitos van debajo del título; desde tablet, en la misma fila y a la derecha
          <div
            className={`flex flex-col items-center gap-3 md:relative md:flex-row ${
              title ? 'md:justify-center' : 'md:justify-end'
            }`}
          >
            {title}
            {pages > 1 && (
              <div
                role="group"
                aria-label={`Páginas de ${label}`}
                className="flex md:absolute md:top-1/2 md:right-0 md:-translate-y-1/2"
              >
                {Array.from({ length: pages }, (_, index) => {
                  const isActive = index === currentPage;
                  return (
                    <button
                      key={index}
                      type="button"
                      onClick={() => goTo(index)}
                      aria-label={`Página ${index + 1} de ${pages}`}
                      aria-current={isActive ? 'true' : undefined}
                      className="group flex h-6 items-center px-1"
                    >
                      <span
                        className={`block h-2 rounded-full transition-all duration-300 ${
                          isActive
                            ? 'w-5 bg-capilar-gradient'
                            : 'w-2 bg-capilar-violet/30 group-hover:bg-capilar-violet/60'
                        }`}
                      />
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        <div className="relative">
          {pages > 1 && (
            <>
              <ArrowButton direction="prev" onClick={() => goTo(currentPage - 1)} disabled={currentPage === 0} />
              <ArrowButton direction="next" onClick={() => goTo(currentPage + 1)} disabled={currentPage === pages - 1} />
            </>
          )}

          <ul
            ref={trackRef}
            onScroll={handleScroll}
            aria-label={label}
            className="flex snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            style={{ gap }}
          >
            {items.map((item, index) => (
              <li
                key={getKey(item)}
                // Solo el primero de cada página es punto de frenado, así se avanza de a una página
                className={`flex shrink-0 *:flex-1 ${index % perPage === 0 ? 'snap-start' : ''}`}
                style={{ width: itemWidth }}
              >
                {renderItem(item)}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};
