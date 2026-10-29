import type { ReactNode } from 'react';
import type { Rol } from '../../api/auth';

// Subopción del menú lateral: la misma ruta de la sección con un parámetro (null: sin él)
export interface PanelSubsection {
  label: string;
  param: [key: string, value: string | null];
}

export interface PanelSection {
  title: string;
  // Texto de la card en el inicio del panel
  text: string;
  to: string;
  // Trazos del ícono (grilla de 24×24): en degradado en las cards, del color del texto en el menú
  icon: ReactNode;
  roles: Rol[];
  subsections?: PanelSubsection[];
}

// Secciones del panel de profesional y admin: las cards del inicio (/panel) y el menú lateral.
// Para sumar una: agregarla acá con sus roles y su ruta en App.tsx
export const panelSections: PanelSection[] = [
  {
    title: 'Agenda',
    text: 'Tus turnos del día y de la semana.',
    to: '/panel/agenda',
    roles: ['PROFESIONAL'],
    icon: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="2" />
        <path d="M3 10h18M8 3v4M16 3v4" />
      </>
    ),
    // Las pestañas de la agenda (?tab=; sin él, Turnos)
    subsections: [
      { label: 'Turnos', param: ['tab', null] },
      { label: 'Nuevo turno', param: ['tab', 'nuevo'] },
      { label: 'Series', param: ['tab', 'series'] },
      { label: 'Mis horarios', param: ['tab', 'horarios'] },
    ],
  },
  {
    title: 'Clientes',
    text: 'Buscá clientes y mirá su perfil e historial.',
    to: '/panel/clientes',
    roles: ['PROFESIONAL'],
    icon: (
      <>
        <circle cx="10" cy="8" r="4" />
        <path d="M3 21c0-4 3.1-7 7-7 1.4 0 2.7.4 3.8 1" />
        <circle cx="17.5" cy="17.5" r="3" />
        <path d="m19.7 19.7 2.3 2.3" />
      </>
    ),
  },
  {
    title: 'Perfil',
    text: 'Tus datos personales y de contacto.',
    to: '/panel/perfil',
    roles: ['PROFESIONAL'],
    icon: (
      <>
        <circle cx="12" cy="8" r="4" />
        <path d="M4 21c0-4 3.6-7 8-7s8 3 8 7" />
      </>
    ),
  },
  {
    title: 'Usuarios',
    text: 'Buscá usuarios y administrá sus roles.',
    to: '/panel/usuarios',
    roles: ['ADMIN'],
    icon: (
      <>
        <circle cx="9" cy="8" r="3.5" />
        <path d="M2 20c0-3.6 3.1-6 7-6s7 2.4 7 6" />
        <path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.3c2.4.6 4 2.6 4 5.7" />
      </>
    ),
    // El filtro por rol (?rol=)
    subsections: [
      { label: 'Clientes', param: ['rol', 'CLIENTE'] },
      { label: 'Profesionales', param: ['rol', 'PROFESIONAL'] },
      { label: 'Admins', param: ['rol', 'ADMIN'] },
    ],
  },
  {
    title: 'Servicios',
    text: 'Cargá los servicios con su duración y precio.',
    to: '/panel/servicios',
    roles: ['ADMIN'],
    icon: (
      <>
        <circle cx="6" cy="6" r="3" />
        <circle cx="6" cy="18" r="3" />
        <path d="M20 4 8.1 15.9M14.5 14.5 20 20M8.1 8.1 12 12" />
      </>
    ),
    // Abre el formulario de alta (?nuevo=1)
    subsections: [{ label: 'Cargar servicio', param: ['nuevo', '1'] }],
  },
];

// Link de una subopción
export const subsectionHref = (section: PanelSection, { param: [key, value] }: PanelSubsection) =>
  value === null ? section.to : `${section.to}?${new URLSearchParams({ [key]: value })}`;
