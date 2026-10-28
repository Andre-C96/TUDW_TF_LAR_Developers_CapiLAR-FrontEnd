import { useId, useState } from 'react';
import type { ReactNode } from 'react';
import { describeSerie } from '../../api/series';
import type { EstadoSerie, Serie, TurnoDeSerie } from '../../api/series';
import { formatFechaCorta, fromIsoDate, toIsoDate } from '../../api/turnos';
import { TurnoStatus } from '../turnoCard/turnoCard';

// Estado de la serie: solo el texto en negrita con su color (como el de los turnos)
const estados: Record<EstadoSerie, { label: string; classes: string }> = {
  ACTIVA: { label: 'Activa', classes: 'text-green-700' },
  SUSPENDIDA: { label: 'Suspendida', classes: 'text-amber-700' },
  BAJA: { label: 'Dada de baja', classes: 'text-capilar-grey' },
};

// "3 de noviembre"
const formatDia = (fecha: string) => fromIsoDate(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' });

interface SerieCardProps {
  serie: Serie;
  // Vista de la clienta: muestra el profesional en vez de la clienta y los estados desde su lado
  paraCliente?: boolean;
  // Botones de la serie (suspender, reactivar, dar de baja)
  actions?: ReactNode;
  // Acción junto a una fecha (ej. elegir otro horario en una fecha ocupada)
  fechaAction?: (fecha: string, turno: TurnoDeSerie | null) => ReactNode;
}

// Serie de turnos: servicio, con quién y cada cuánto; las fechas con el estado de su turno se despliegan aparte
export const SerieCard = ({ serie, paraCliente = false, actions, fechaAction }: SerieCardProps) => {
  const estado = estados[serie.estado];
  const hoy = toIsoDate(new Date());
  const [abierta, setAbierta] = useState(false);
  const fechasId = useId();
  // Fechas ocupadas por delante: el cliente puede elegir otro horario (se avisa aunque las fechas estén cerradas)
  const ocupadas = serie.estado === 'ACTIVA' ? serie.fechas.filter((f) => !f.turno && f.fecha >= hoy).length : 0;

  return (
    <article
      className={`flex flex-col gap-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm ${serie.estado === 'BAJA' ? 'opacity-70' : ''}`}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-1 font-inter">
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-lg font-semibold text-black">{serie.servicio}</span>
            <span className={`text-xs font-bold ${estado.classes}`}>{estado.label}</span>
          </div>
          <span className="text-sm text-capilar-grey">
            {paraCliente ? `Con ${serie.profesional}` : `${serie.cliente.nombre} ${serie.cliente.apellido}`} ·{' '}
            {describeSerie(serie)}
          </span>
          <span className="text-xs text-capilar-grey">
            Del {formatDia(serie.fechaInicio)} al {formatDia(serie.fechaFin)}
          </span>
        </div>
        {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
      </div>

      <button
        type="button"
        onClick={() => setAbierta(!abierta)}
        aria-expanded={abierta}
        aria-controls={fechasId}
        className="flex items-center gap-2 self-start font-inter text-xs font-semibold uppercase tracking-widest text-capilar-violet hover:underline"
      >
        {abierta ? 'Ocultar fechas' : `Ver fechas (${serie.fechas.length})`}
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`h-4 w-4 transition-transform duration-300 ${abierta ? 'rotate-180' : ''}`}
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
        {ocupadas > 0 && (
          <span className="rounded-md bg-amber-50 px-2 py-0.5 normal-case tracking-normal text-amber-800">
            {ocupadas} {ocupadas === 1 ? 'fecha ocupada' : 'fechas ocupadas'}
            {paraCliente && ': elegí otro horario'}
          </span>
        )}
      </button>

      {abierta && (
        <ul id={fechasId} className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
          {serie.fechas.map(({ fecha, turno }) => (
            <li key={fecha} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-4 py-2 font-inter text-sm">
              <span className="w-28 shrink-0 font-semibold text-black first-letter:uppercase">{formatFechaCorta(fecha)}</span>
              {turno ? (
                <>
                  <span className="text-capilar-grey">{turno.horaInicio}</span>
                  <TurnoStatus estado={turno.estado} paraCliente={paraCliente} />
                </>
              ) : (
                <span className="text-capilar-grey">
                  {serie.estado !== 'ACTIVA' || fecha < hoy
                    ? 'Sin turno'
                    : paraCliente
                      ? 'Ocupado a esa hora: elegí otro horario'
                      : 'Ocupado: el cliente puede elegir otro horario'}
                </span>
              )}
              {fechaAction && <span className="ml-auto">{fechaAction(fecha, turno)}</span>}
            </li>
          ))}
        </ul>
      )}
    </article>
  );
};
