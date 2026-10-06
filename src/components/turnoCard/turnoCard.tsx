import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { formatPrice } from '../../api/services';
import { fromIsoDate } from '../../api/turnos';
import type { EstadoTurno, Turno } from '../../api/turnos';

// Texto y colores de cada estado. El cliente lee el estado desde su lado ("Esperando confirmación")
const estados: Record<EstadoTurno, { label: string; clienteLabel: string; classes: string }> = {
  PENDIENTE: { label: 'Por confirmar', clienteLabel: 'Esperando confirmación', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  CONFIRMADO: { label: 'Confirmado', clienteLabel: 'Confirmado', classes: 'bg-green-50 text-green-800 border-green-300' },
  REPROGRAMADO: {
    label: 'Esperando al cliente',
    clienteLabel: 'Nuevo horario propuesto',
    classes: 'bg-purple-50 text-capilar-violet border-capilar-violet/40',
  },
  COMPLETADO: { label: 'Completado', clienteLabel: 'Completado', classes: 'bg-gray-100 text-gray-700 border-gray-300' },
  RECHAZADO: { label: 'Rechazado', clienteLabel: 'No confirmado', classes: 'bg-red-50 text-red-700 border-red-300' },
  CANCELADO: { label: 'Cancelado', clienteLabel: 'Cancelado', classes: 'bg-red-50 text-red-700 border-red-300' },
};

export const TurnoStatus = ({ estado, paraCliente = false }: { estado: EstadoTurno; paraCliente?: boolean }) => {
  const { label, clienteLabel, classes } = estados[estado];
  return (
    <span className={`inline-flex shrink-0 rounded-full border px-3 py-1 font-inter text-xs font-semibold ${classes}`}>
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
}

// Turno con fecha, horario, servicios con su profesional, estado y acciones.
// Para el salón muestra también el cliente con su teléfono y sus alergias.
export const TurnoCard = ({ turno, paraCliente = false, actions, note }: TurnoCardProps) => {
  const date = fromIsoDate(turno.fecha);
  const isClosed = turno.estado === 'CANCELADO' || turno.estado === 'RECHAZADO';
  const total = turno.detalles.reduce((sum, detalle) => sum + Number(detalle.precioBase), 0);

  return (
    <article
      className={`flex flex-col gap-4 rounded-[6px] border border-gray-200 bg-white p-5 shadow-md sm:flex-row sm:items-start ${
        isClosed ? 'opacity-70' : ''
      }`}
    >
      {/* Fecha: día grande, mes y día de la semana */}
      <div className="flex w-20 shrink-0 flex-col items-center rounded-[6px] bg-capilar-gradient px-3 py-2 text-white">
        <span className="font-inter text-xs uppercase">{date.toLocaleDateString('es-AR', { weekday: 'short' })}</span>
        <span className="font-inter text-3xl leading-tight font-semibold">{date.getDate()}</span>
        <span className="font-inter text-xs uppercase">{date.toLocaleDateString('es-AR', { month: 'short' })}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2">
        <div className="flex flex-wrap items-center gap-3">
          <span className="font-inter text-lg font-semibold text-black">
            {turno.horaInicio} – {turno.horaFin}
          </span>
          <TurnoStatus estado={turno.estado} paraCliente={paraCliente} />
        </div>

        {!paraCliente && (
          <div className="flex flex-col gap-1 font-inter text-sm">
            <span className="font-semibold text-black">
              {turno.cliente.nombre} {turno.cliente.apellido}
              <span className="font-normal text-capilar-grey"> · {turno.cliente.telefono}</span>
            </span>
            {turno.cliente.alergia && (
              <span className="self-start rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800">
                Alergias: {turno.cliente.alergia}
              </span>
            )}
          </div>
        )}

        <ul className="flex flex-col gap-1 font-inter text-sm text-capilar-grey">
          {turno.detalles.map((detalle) => (
            <li key={detalle.id}>
              <span className="text-black">{detalle.servicio}</span>
              {turno.detalles.length > 1 && ` (${detalle.horaInicio} – ${detalle.horaFin})`} · con {detalle.profesional}
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

      {actions && <div className="flex shrink-0 flex-wrap gap-2 sm:flex-col sm:items-stretch">{actions}</div>}
    </article>
  );
};

// Botón chico de las acciones de un turno
const actionVariants = {
  positiva: 'border-capilar-violet bg-capilar-violet text-white hover:bg-capilar-violet/85',
  neutra: 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet',
  peligro: 'border-gray-300 bg-white text-capilar-grey hover:border-red-500 hover:text-red-500',
};

interface TurnoActionProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: keyof typeof actionVariants;
}

export const TurnoAction = ({ variant = 'neutra', className = '', ...props }: TurnoActionProps) => (
  <button
    type="button"
    className={`rounded-lg border px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest whitespace-nowrap transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${actionVariants[variant]} ${className}`}
    {...props}
  />
);
