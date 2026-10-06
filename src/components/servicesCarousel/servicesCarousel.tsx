import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { formatDuration, formatPrice, getServicesRequest } from '../../api/services';
import type { Servicio } from '../../api/services';
import { Alert } from '../alert/alert';
import { Card } from '../card/card';
import { Carousel } from '../carousel/carousel';
import { Loader } from '../loader/loader';
import { Title } from '../title/title';

interface ServicesCarouselProps {
  // Título de la sección: va a la altura de los circulitos de página del carrusel
  title: string;
}

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Carrusel con los servicios activos del salón: nombre, duración y precio (el listado es público)
export const ServicesCarousel = ({ title }: ServicesCarouselProps) => {
  const [services, setServices] = useState<Servicio[] | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    let ignore = false;
    getServicesRequest()
      .then((data) => {
        if (!ignore) setServices(data);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : unexpectedError);
      });
    return () => {
      ignore = true;
    };
  }, []);

  const heading = <Title as="h2">{title}</Title>;

  if (error) {
    return (
      <>
        {heading}
        <Alert variant="error" title="No se pudieron cargar los servicios" className="w-full max-w-xl">
          {error}
        </Alert>
      </>
    );
  }

  if (!services) {
    return (
      <>
        {heading}
        <Loader label="Cargando servicios..." className="py-8" />
      </>
    );
  }

  if (services.length === 0) {
    return (
      <>
        {heading}
        <p className="font-inter text-sm text-capilar-grey">Pronto vas a ver acá nuestros servicios.</p>
      </>
    );
  }

  // Cards de ancho fijo: con pocos servicios quedan centradas; con más de los que entran, pasan a páginas
  return (
    <Carousel
      items={services}
      getKey={(servicio) => servicio.id}
      label={title}
      title={heading}
      renderItem={(servicio) => (
        <Card
          // El nombre siempre ocupa el lugar de 2 líneas (centrado; si es más largo, termina en "…"),
          // así la duración y el precio quedan a la misma altura en todas las cards
          title={
            <span className="flex h-[2lh] items-center justify-center" title={servicio.tipo}>
              <span className="line-clamp-2">{servicio.tipo}</span>
            </span>
          }
          className="bg-white! px-6! py-10!"
        >
          <div className="flex flex-col items-center gap-3">
            <span className="flex items-center gap-1.5">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                className="h-4 w-4"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />
                <path d="M12 7v5l3 2" />
              </svg>
              {formatDuration(servicio.tiempoDuracion)}
            </span>
            <span className="bg-capilar-gradient bg-clip-text text-2xl font-semibold text-transparent">
              {formatPrice(servicio.precio)}
            </span>
          </div>
        </Card>
      )}
    />
  );
};
