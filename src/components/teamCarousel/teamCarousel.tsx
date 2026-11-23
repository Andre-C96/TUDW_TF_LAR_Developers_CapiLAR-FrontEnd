import { useState } from 'react';
import { fotoProfesionalUrl, getProfessionalsRequest } from '../../api/professionals';
import type { ProfesionalResumen } from '../../api/professionals';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { Carousel } from '../carousel/carousel';
import { Loader } from '../loader/loader';
import { Title } from '../title/title';

interface TeamCarouselProps {
  // Título de la sección: va a la altura de los circulitos de página del carrusel
  title: string;
}

// Foto redonda del profesional. Sin foto, o si no se pudo cargar (mientras el back la pida con sesión responde 401),
// las iniciales sobre el degradado de marca, como en el Avatar
const FotoProfesional = ({ profesional }: { profesional: ProfesionalResumen }) => {
  const [fallo, setFallo] = useState(false);
  const { legajo, nombre, apellido, tieneFoto } = profesional;

  return (
    <span className="flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-full bg-capilar-gradient font-inter text-4xl font-semibold text-white shadow-md">
      {tieneFoto && !fallo ? (
        <img
          src={fotoProfesionalUrl(legajo)}
          alt={`Foto de ${nombre} ${apellido}`}
          loading="lazy"
          onError={() => setFallo(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <span aria-hidden="true">
          {nombre[0]}
          {apellido[0]}
        </span>
      )}
    </span>
  );
};

// "Nosotros" en el inicio: el equipo del salón (lista pública), con foto y nombre. Sin tarjeta: directo sobre el
// fondo blanco, en el mismo carrusel que los servicios
export const TeamCarousel = ({ title }: TeamCarouselProps) => {
  const equipo = useFetch('equipo', () => getProfessionalsRequest());
  const heading = <Title as="h2">{title}</Title>;

  if (equipo.isLoading) {
    return (
      <>
        {heading}
        <Loader label="Cargando el equipo..." className="py-8" />
      </>
    );
  }

  // Sin equipo o si falló: el inicio no muestra un error, solo un aviso amable
  if (!equipo.data || equipo.data.length === 0) {
    return (
      <>
        {heading}
        <p className="font-inter text-sm text-capilar-grey">Pronto vas a conocer a nuestro equipo de profesionales.</p>
      </>
    );
  }

  return (
    <Carousel
      items={equipo.data}
      getKey={(profesional) => profesional.legajo}
      label={title}
      title={heading}
      itemWidth={180}
      gap={32}
      renderItem={(profesional) => (
        <div className="flex flex-col items-center gap-4 py-2">
          <FotoProfesional profesional={profesional} />
          <p className="text-center font-inter text-base font-medium text-black">
            {profesional.nombre} {profesional.apellido}
          </p>
        </div>
      )}
    />
  );
};
