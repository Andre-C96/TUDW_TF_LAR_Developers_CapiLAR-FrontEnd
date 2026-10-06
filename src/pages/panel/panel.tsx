import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import type { Rol } from '../../api/auth';
import { Card } from '../../components/card/card';
import { GradientIcon } from '../../components/gradientIcon/gradientIcon';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

interface Workspace {
  title: string;
  text: string;
  to: string;
  icon: ReactNode;
  // Roles que ven la card 
  roles: Rol[];
}

// Espacios de trabajo del panel
const workspaces: Workspace[] = [
  {
    title: 'Agenda',
    text: 'Tus turnos del día y de la semana.',
    to: '/panel/agenda',
    roles: ['PROFESIONAL'],
    icon: (
      <GradientIcon id="icon-agenda">
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </GradientIcon>
    ),
  },
  {
    title: 'Perfil',
    text: 'Tus datos personales y de contacto.',
    to: '/panel/perfil',
    roles: ['PROFESIONAL'],
    icon: (
      <GradientIcon id="icon-perfil">
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </GradientIcon>
    ),
  },
  {
    title: 'Usuarios',
    text: 'Buscá usuarios y administrá sus roles.',
    to: '/panel/usuarios',
    roles: ['ADMIN'],
    icon: (
      <GradientIcon id="icon-usuarios">
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2.4.6 4 2.6 4 5.7" />
      </GradientIcon>
    ),
  },
  {
    title: 'Servicios',
    text: 'Cargá los servicios con su duración y precio.',
    to: '/panel/servicios',
    roles: ['ADMIN'],
    icon: (
      <GradientIcon id="icon-servicios">
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
      </GradientIcon>
    ),
  },
];

// Inicio de profesional y admin: accesos a sus espacios de trabajo
export const Panel = () => {
  const { hasRole } = useAuth();
  const visible = workspaces.filter((workspace) => hasRole(...workspace.roles));

  return (
    <section className="mx-auto flex max-w-5xl flex-col items-center gap-10 px-6 pt-32 pb-16">
      <div className="flex flex-col items-center gap-2 text-center">
        <Title>Tu espacio de trabajo</Title>
        <p className="font-inter text-capilar-grey">Elegí a dónde querés ir.</p>
      </div>

      <div className="flex w-full flex-wrap justify-center gap-8">
        {visible.map((workspace) => (
          <Link
            key={workspace.to}
            to={workspace.to}
            className="w-full rounded-[6px] transition duration-300 hover:-translate-y-1 hover:shadow-lg focus-visible:outline-2 focus-visible:outline-capilar-violet sm:w-64"
          >
            <Card icon={workspace.icon} title={workspace.title} className="h-full">
              {workspace.text}
            </Card>
          </Link>
        ))}
      </div>
    </section>
  );
};
