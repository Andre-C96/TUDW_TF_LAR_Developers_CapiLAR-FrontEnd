import { Title } from '../../components/title/title';

interface ComingSoonProps {
  // Nombre de la sección que todavía no existe (ej. "Mis turnos")
  title: string;
}

// Página provisoria para las secciones que todavía no están hechas
export const ComingSoon = ({ title }: ComingSoonProps) => (
  <section className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-6 pt-24 pb-12 text-center">
    <Title>{title}</Title>
    <p className="bg-capilar-gradient bg-clip-text font-inter text-lg font-semibold text-transparent">Próximamente</p>
    <p className="font-inter text-capilar-grey">Estamos trabajando en esta sección.</p>
  </section>
);
