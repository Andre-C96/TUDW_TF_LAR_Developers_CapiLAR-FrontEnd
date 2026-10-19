import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { getServicesRequest } from '../../api/services';
import type { Servicio } from '../../api/services';
import { Alert } from '../alert/alert';
import { Carousel } from '../carousel/carousel';
import { Loader } from '../loader/loader';
import { ServiceCard } from '../serviceCard/serviceCard';
import { Title } from '../title/title';

interface ServicesCarouselProps {
  // Título de la sección: va a la altura de los circulitos de página del carrusel
  title: string;
  // Botón Reservar de cada card (sin sesión, la home abre el login)
  onReserve?: (servicio: Servicio) => void;
}

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Carrusel con los servicios activos del salón (ServiceCard), con su botón Reservar (el listado es público)
export const ServicesCarousel = ({ title, onReserve }: ServicesCarouselProps) => {
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
      itemWidth={320}
      renderItem={(servicio) => <ServiceCard servicio={servicio} onReserve={onReserve} />}
    />
  );
};
