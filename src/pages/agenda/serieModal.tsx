import { useState } from 'react';
import { ApiError } from '../../api/client';
import { FRECUENCIAS, createSerieRequest, previewSerieRequest, rangoFechaFin } from '../../api/series';
import type { EstadoFecha, FrecuenciaSerie, SerieCreada, SerieData } from '../../api/series';
import { formatFechaCorta, formatFechaLarga, toIsoDate } from '../../api/turnos';
import type { Turno } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { DatePicker } from '../../components/datePicker/datePicker';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const labelClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';
// En las fechas ocupadas se muestran los primeros horarios libres
const MAX_HORARIOS = 6;

const estadosFecha: Record<EstadoFecha, { label: string; classes: string }> = {
  LIBRE: { label: 'Se reserva', classes: 'bg-green-50 text-green-800 border-green-300' },
  SIN_HORARIO: { label: 'Sin horario cargado', classes: 'bg-amber-50 text-amber-800 border-amber-300' },
  OCUPADA: { label: 'Ocupado', classes: 'bg-red-50 text-red-700 border-red-300' },
};

const Chip = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: string }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    className={`rounded-full border px-3 py-1.5 font-inter text-sm transition-colors ${
      selected
        ? 'border-capilar-violet bg-capilar-violet text-white'
        : 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
    }`}
  >
    {children}
  </button>
);

interface SerieModalProps {
  token: string;
  legajo: number;
  // Turno CONFIRMADO del que sale la serie
  turno: Turno;
  onClose: () => void;
  onCreated: (serie: SerieCreada) => void;
}

// Repetir un servicio de un turno confirmado, a la misma hora, cada tantos días y hasta 60 días adelante.
// La vista previa se actualiza con cada cambio y dice qué fechas se reservan, cuáles no tienen horario cargado
// (se reservan igual) y cuáles están ocupadas (el cliente elige otro horario de ese día).
export const SerieModal = ({ token, legajo, turno, onClose, onCreated }: SerieModalProps) => {
  const propios = turno.detalles.filter((d) => d.legajo === legajo);
  const [detalleId, setDetalleId] = useState(propios[0]?.id);
  const [frecuencia, setFrecuencia] = useState<FrecuenciaSerie>('QUINCENAL');
  const [fechaFinElegida, setFechaFin] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const rango = rangoFechaFin(turno.fecha, frecuencia);
  const min = toIsoDate(rango.min);
  const max = toIsoDate(rango.max);
  // Si la elegida quedó fuera del rango (cambió la frecuencia), se usa la última posible
  const fechaFin = fechaFinElegida >= min && fechaFinElegida <= max ? fechaFinElegida : max;

  const data: SerieData = {
    turnoId: turno.id,
    ...(propios.length > 1 ? { turnoDetalleId: detalleId } : {}),
    frecuencia,
    fechaFin,
  };
  const preview = useFetch(rango.vacio ? null : `serie-${turno.id}-${detalleId}-${frecuencia}-${fechaFin}`, () =>
    previewSerieRequest(token, data),
  );
  const fechas = preview.data?.fechas ?? [];
  const seReservan = fechas.filter((f) => f.estado !== 'OCUPADA').length;
  const detalle = propios.find((d) => d.id === detalleId);

  const create = async () => {
    setSaving(true);
    setError('');
    try {
      onCreated(await createSerieRequest(token, data));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : unexpectedError);
      setSaving(false);
    }
  };

  return (
    <Modal isOpen onClose={() => !saving && onClose()} ariaLabel="Repetir turno" className="max-w-4xl!">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 pr-6">
          <Title as="h2">Repetir turno</Title>
          <p className="font-inter text-sm text-capilar-grey">
            <span className="font-semibold text-black">
              {turno.cliente.nombre} {turno.cliente.apellido}
            </span>{' '}
            · {detalle?.servicio} · <span className="first-letter:uppercase">{formatFechaLarga(turno.fecha)}</span>, {detalle?.horaInicio}. Se
            repite a la misma hora; al cliente le llega un mail con todas las fechas.
          </p>
        </div>

        <div className="grid gap-8 md:grid-cols-[auto_1fr]">
          <div className="flex flex-col gap-5">
            {propios.length > 1 && (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>Servicio</span>
                <div role="radiogroup" aria-label="Servicio que se repite" className="flex flex-wrap gap-2">
                  {propios.map((d) => (
                    <Chip key={d.id} selected={d.id === detalleId} onClick={() => setDetalleId(d.id)}>
                      {d.servicio}
                    </Chip>
                  ))}
                </div>
              </div>
            )}

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Frecuencia</span>
              <div role="radiogroup" aria-label="Frecuencia" className="flex flex-wrap gap-2 md:max-w-80">
                {(Object.keys(FRECUENCIAS) as FrecuenciaSerie[]).map((f) => (
                  <Chip key={f} selected={f === frecuencia} onClick={() => setFrecuencia(f)}>
                    {FRECUENCIAS[f].label}
                  </Chip>
                ))}
              </div>
            </div>

            {!rango.vacio && (
              <div className="flex flex-col gap-2">
                <span className={labelClass}>Hasta</span>
                <div className="self-start rounded-[6px] border border-gray-200 bg-white p-3">
                  <DatePicker value={fechaFin} onChange={setFechaFin} min={rango.min} max={rango.max} />
                </div>
                <span className="font-inter text-xs text-capilar-grey">Hasta 60 días desde hoy.</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-3">
            <span className={labelClass}>Fechas</span>
            {rango.vacio ? (
              <p className="font-inter text-sm text-capilar-grey">
                Con esta frecuencia la próxima fecha queda a más de 60 días: elegí una frecuencia más corta.
              </p>
            ) : preview.error ? (
              <Alert variant="error" title="No se pudo armar la serie">
                {preview.error}
              </Alert>
            ) : preview.isLoading ? (
              <Loader size="sm" label="Revisando la agenda..." className="items-start! py-2" />
            ) : (
              <ul className="flex flex-col divide-y divide-gray-100 rounded-lg border border-gray-200">
                {fechas.map((f) => (
                  <li key={f.fecha} className="flex flex-col gap-1 px-4 py-2 font-inter text-sm">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="w-28 font-semibold text-black first-letter:uppercase">{formatFechaCorta(f.fecha)}</span>
                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-semibold ${estadosFecha[f.estado].classes}`}>
                        {estadosFecha[f.estado].label}
                      </span>
                    </div>
                    {f.estado === 'SIN_HORARIO' && (
                      <span className="text-xs text-capilar-grey">Se reserva igual: te avisamos por mail para que cargues tu horario.</span>
                    )}
                    {f.estado === 'OCUPADA' && (
                      <span className="text-xs text-capilar-grey">
                        {f.motivo && `${f.motivo}. `}
                        {f.horariosLibres.length > 0
                          ? `El cliente puede elegir otro horario: ${f.horariosLibres.slice(0, MAX_HORARIOS).join(', ')}${
                              f.horariosLibres.length > MAX_HORARIOS ? ' y más' : ''
                            }.`
                          : 'Ese día no quedan horarios libres.'}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button variant="grey" onClick={onClose} disabled={saving} className="px-5 py-2 text-xs uppercase">
            Volver
          </Button>
          <Button
            onClick={create}
            disabled={saving || fechas.length === 0}
            className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? 'Creando...' : seReservan > 0 ? `Crear serie (${seReservan} ${seReservan === 1 ? 'turno' : 'turnos'})` : 'Crear serie'}
          </Button>
        </div>
      </div>
    </Modal>
  );
};
