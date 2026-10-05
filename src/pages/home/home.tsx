import type { ReactNode } from 'react';
import { useOutletContext } from 'react-router-dom';
import heroImage from '../../assets/hero.jpg';
import { Button } from '../../components/button/button';
import { Card } from '../../components/card/card';
import type { LayoutContext } from '../../components/layout/layout';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

// Ícono de línea con el degradado de marca (cada uno necesita un id de degradado propio)
const GradientIcon = ({ id, children }: { id: string; children: ReactNode }) => (
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

const features = [
  {
    title: 'Gestión de turnos',
    text: 'Reservá, reprogramá o cancelá tus turnos en cualquier momento, sin llamadas ni esperas.',
    icon: (
      <GradientIcon id="icon-calendar">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </GradientIcon>
    ),
  },
  {
    title: 'Historial capilar',
    text: 'Tus tratamientos, colores y cortes quedan registrados para que cada visita parta de lo anterior.',
    icon: (
      <GradientIcon id="icon-scissors">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
      </GradientIcon>
    ),
  },
  {
    title: 'Evolución de tu estilo',
    text: 'Mirá cómo cambia tu pelo con las fotos de cada servicio, de un turno al otro.',
    icon: (
      <GradientIcon id="icon-camera">
        <path d="M4 8h3l2-3h6l2 3h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
        <circle cx="12" cy="13.5" r="3.5" />
      </GradientIcon>
    ),
  },
];

// Sección de la landing con título centrado (el id es el ancla del header)
const HomeSection = ({ id, title, children }: { id: string; title: string; children: ReactNode }) => (
  <section id={id} className="bg-white px-6 py-16">
    <div className="mx-auto flex max-w-6xl flex-col items-center gap-8">
      <Title as="h2">{title}</Title>
      {children}
    </div>
  </section>
);

// Contenido pendiente de una sección
const ComingSoon = ({ children }: { children: ReactNode }) => (
  <p className="font-inter text-sm text-capilar-grey">{children}</p>
);

export const Home = () => {
  const { openAuth } = useOutletContext<LayoutContext>();
  const { isAuthenticated, isCheckingSession } = useAuth();

  return (
    <>
      {/* Inicio: hero + features */}
      <section id="inicio">
        {/* foto a lo ancho con el título centrado */}
        <div
          className="flex min-h-[80vh] items-center justify-center bg-cover bg-center px-6 pt-24 pb-12"
          style={{ backgroundImage: `url(${heroImage})` }}
        >
          <h1 className="max-w-md text-center font-inter text-4xl font-extralight leading-tight text-black md:text-5xl">
            Tu identidad, potenciada en cada detalle.
          </h1>
        </div>

        {/* Features */}
        <div className="bg-white px-6 py-16">
          <div className="mx-auto grid max-w-6xl gap-8 md:grid-cols-3">
            {features.map((feature) => (
              <Card key={feature.title} icon={feature.icon} title={feature.title}>
                {feature.text}
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* cards de servicios */}
      <HomeSection id="servicios" title="Servicios">
        <ComingSoon>Próximamente vas a ver acá los servicios disponibles.</ComingSoon>
      </HomeSection>

      {/* foto y nombre de los profesionales */}
      <HomeSection id="nosotros" title="Nosotros">
        <ComingSoon>Próximamente vas a conocer a nuestro equipo de profesionales.</ComingSoon>
      </HomeSection>

      {/* dirección, horario y redes */}
      <HomeSection id="contacto" title="Contacto">
        <ComingSoon>Próximamente vas a encontrar acá nuestra dirección, horarios y redes.</ComingSoon>
      </HomeSection>

      {/* CTA de registro: solo sin sesión (mientras se valida una sesión guardada tampoco, para que no aparezca y desaparezca) */}
      {/* borde con degradado (contenedor con degradado + caja interna) */}
      {!isAuthenticated && !isCheckingSession && (
        <section className="bg-white px-6 pb-16">
          <div className="mx-auto max-w-4xl rounded-[6px] bg-capilar-gradient p-[2px] shadow-md">
            <div className="rounded-[4px] bg-white">
              <div className="flex flex-col items-center justify-between gap-4 rounded-[4px] bg-capilar-violet/10 px-6 py-4 text-center md:flex-row md:text-left">
                <h2 className="font-inter text-lg font-medium text-black">¿Listo para potenciar tu identidad?</h2>
                <Button className="text-sm text-white! font-semibold! tracking-wider" onClick={() => openAuth('register')}>
                  REGISTRARSE
                </Button>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
};
