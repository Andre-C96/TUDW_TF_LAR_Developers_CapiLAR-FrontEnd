import { useId } from 'react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { formatPrice } from '../../api/services';
import { fromIsoDate } from '../../api/turnos';
import type { EstadoTurno, Turno, TurnoDetalle } from '../../api/turnos';

// Texto y color de cada estado. El cliente lee el estado desde su lado ("Esperando confirmación")
const estados: Record<EstadoTurno, { label: string; clienteLabel: string; classes: string }> = {
  PENDIENTE: { label: 'Por confirmar', clienteLabel: 'Esperando confirmación', classes: 'text-amber-700' },
  CONFIRMADO: { label: 'Confirmado', clienteLabel: 'Confirmado', classes: 'text-green-700' },
  REPROGRAMADO: { label: 'Esperando al cliente', clienteLabel: 'Nuevo horario propuesto', classes: 'text-capilar-violet' },
  COMPLETADO: { label: 'Completado', clienteLabel: 'Completado', classes: 'text-capilar-grey' },
  RECHAZADO: { label: 'Rechazado', clienteLabel: 'No confirmado', classes: 'text-red-600' },
  CANCELADO: { label: 'Cancelado', clienteLabel: 'Cancelado', classes: 'text-red-600' },
  AUSENTE: { label: 'Ausente', clienteLabel: 'No asististe', classes: 'text-orange-700' },
};

// Estado del turno: solo el texto en negrita con su color (sin pastilla, para no cargar la card)
export const TurnoStatus = ({ estado, paraCliente = false }: { estado: EstadoTurno; paraCliente?: boolean }) => {
  const { label, clienteLabel, classes } = estados[estado];
  return (
    <span className={`shrink-0 font-inter text-xs font-bold ${classes}`}>
      {paraCliente ? clienteLabel : label}
    </span>
  );
};

interface TurnoCardProps {
  turno: Turno;
  // Vista del cliente: textos del estado desde su lado y sin sus propios datos
  paraCliente?: boolean;
  // Botones de acción (cancelar, confirmar, etc.)
  actions?: ReactNode;
  // Aviso debajo del turno (ej. por qué no se puede cancelar)
  note?: ReactNode;
  // Acción junto a cada servicio (ej. la ficha técnica)
  detalleAction?: (detalle: TurnoDetalle) => ReactNode;
  // Etiqueta junto al estado (ej. si es parte de una serie)
  badge?: ReactNode;
  // Como fila de una TurnoList (sin borde ni sombra propios)
  enLista?: boolean;
}

// Turnos en modo listado: un solo recuadro con una fila por turno
export const TurnoList = ({ children }: { children: ReactNode }) => (
  <div className="divide-y divide-gray-200 overflow-hidden rounded-[6px] border border-gray-200 bg-white shadow-sm">{children}</div>
);

// Etiqueta de los turnos que son parte de una serie: "↻ Cada 15 días"
export const SerieBadge = ({ children }: { children: ReactNode }) => (
  <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-purple-50 px-2.5 py-1 font-inter text-xs font-semibold text-capilar-violet">
    <span aria-hidden="true">↻</span>
    {children}
  </span>
);

// Hoja de calendario de línea (sin argollas) con el degradado de marca: el mes en la franja de arriba,
// y el día de la semana y el número adentro, en negro
export const CalendarDate = ({ fecha }: { fecha: string }) => {
  const gradientId = useId();
  const date = fromIsoDate(fecha);
  return (
    <div className="relative h-16 w-14 shrink-0 font-inter">
      <svg viewBox="0 0 56 64" fill="none" aria-hidden="true" className="absolute inset-0 h-full w-full">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="56" y2="0" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="var(--color-capilar-violet)" />
            <stop offset="1" stopColor="var(--color-capilar-peach)" />
          </linearGradient>
        </defs>
        <g stroke={`url(#${gradientId})`} strokeWidth={2} strokeLinecap="round">
          <rect x="2" y="2" width="52" height="60" rx="6" />
          <path d="M2 17h52" />
        </g>
      </svg>
      <span className="absolute inset-x-0 top-[6px] text-center text-[9px] leading-none font-semibold uppercase text-capilar-grey">
        {date.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '')}
      </span>
      <span className="absolute inset-x-0 top-[22px] flex flex-col items-center text-black">
        <span className="text-[10px] leading-tight uppercase">{date.toLocaleDateString('es-AR', { weekday: 'short' }).replace('.', '')}</span>
        <span className="text-xl leading-none font-semibold">{date.getDate()}</span>
      </span>
    </div>
  );
};

// Turno con fecha, horario, servicios con su profesional, estado y acciones.
// Para el salón muestra también el cliente con su teléfono y sus alergias.
export const TurnoCard = ({ turno, paraCliente = false, actions, note, detalleAction, badge, enLista = false }: TurnoCardProps) => {
  const isClosed = turno.estado === 'CANCELADO' || turno.estado === 'RECHAZADO' || turno.estado === 'AUSENTE';
  const total = turno.detalles.reduce((sum, detalle) => sum + Number(detalle.precioBase), 0);

  return (
    <article
      className={`flex flex-col gap-3 bg-white px-4 py-3 sm:flex-row sm:items-center ${
        enLista ? '' : 'rounded-[6px] border border-gray-200 shadow-sm'
      } ${isClosed ? 'opacity-70' : ''}`}
    >
      <CalendarDate fecha={turno.fecha} />

      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-inter text-base font-semibold text-black">
            {turno.horaInicio} – {turno.horaFin}
          </span>
          <TurnoStatus estado={turno.estado} paraCliente={paraCliente} />
          {badge}
          {turno.estado === 'CONFIRMADO' && turno.asistenciaConfirmadaEn && (
            <span className="inline-flex shrink-0 items-center gap-1 font-inter text-xs font-semibold text-green-700">
              ✓ Asistencia confirmada
            </span>
          )}
        </div>

        {!paraCliente && (
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-inter text-sm">
            <span className="font-semibold text-black">
              {turno.cliente.nombre} {turno.cliente.apellido}
              <span className="font-normal text-capilar-grey"> · {turno.cliente.telefono}</span>
            </span>
            {!turno.cliente.emailVerificadoEn && (
              <span
                title="Todavía no verificó su correo: puede no recibir los avisos del turno"
                className="self-start rounded-md bg-gray-100 px-2 py-1 text-xs text-capilar-grey"
              >
                Correo sin verificar
              </span>
            )}
            {turno.cliente.alergia && (
              <span className="self-start rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Alergias: {turno.cliente.alergia}
              </span>
            )}
          </div>
        )}

        <ul className="flex flex-col gap-0.5 font-inter text-sm text-capilar-grey">
          {turno.detalles.map((detalle) => (
            <li key={detalle.id}>
              <span className="text-black">{detalle.servicio}</span>
              {turno.detalles.length > 1 && ` (${detalle.horaInicio} – ${detalle.horaFin})`} · con {detalle.profesional}
              {detalleAction?.(detalle)}
            </li>
          ))}
        </ul>

        {paraCliente && <span className="font-inter text-sm font-semibold text-black">Desde {formatPrice(total)}</span>}

        {turno.motivo && isClosed && (
          <p className="font-inter text-sm text-capilar-grey">
            Motivo: <span className="italic">"{turno.motivo}"</span>
          </p>
        )}

        {note && <div className="font-inter text-xs text-capilar-grey">{note}</div>}
      </div>

      {/* Acciones en una fila (se pasan a otra línea solo si no entran) */}
      {actions && <div className="flex shrink-0 flex-wrap gap-1.5 sm:justify-end lg:flex-nowrap">{actions}</div>}
    </article>
  );
};

// Botón chico de las acciones de un turno
const actionVariants = {
  // Borde degradado con relleno blanco (lila al pasar el mouse): resalta sin pesar tanto como un violeta lleno
  positiva:
    'border-transparent text-capilar-violet [background:linear-gradient(white,white)_padding-box,var(--background-image-capilar-gradient)_border-box] hover:[background:linear-gradient(var(--color-purple-50),var(--color-purple-50))_padding-box,var(--background-image-capilar-gradient)_border-box]',
  neutra: 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet',
  peligro: 'border-gray-300 bg-white text-capilar-grey hover:border-red-500 hover:text-red-500',
};

interface TurnoActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof actionVariants;
}

export const TurnoAction = ({ variant = 'neutra', className = '', children, ...props }: TurnoActionProps) => (
  <button
    type="button"
    className={`rounded-[6px] border px-2.5 py-1 font-inter text-[11px] font-semibold uppercase tracking-wider whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${actionVariants[variant]} ${className}`}
    {...props}
  >
    {/* La positiva lleva también la letra con el degradado (el fondo del botón ya lo usa el borde) */}
    {variant === 'positiva' ? <span className="bg-capilar-gradient bg-clip-text text-transparent">{children}</span> : children}
  </button>
);
