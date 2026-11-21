import { useEffect, useState } from 'react';
import { ApiError } from '../../api/client';
import { MAX_DIAS_ANTICIPACION, addDays, buscarDiasSinLugar, formatFechaLarga, getHorariosLibresRequest, toIsoDate } from '../../api/turnos';
import type { HorariosLibresOptions, TurnoItem } from '../../api/turnos';
import { Alert } from '../alert/alert';
import { DatePicker } from '../datePicker/datePicker';
import { Loader } from '../loader/loader';
import { RadioGroup } from '../radioGroup/radioGroup';

export interface Slot {
  fecha: string;
  hora: string;
}

interface SlotPickerProps {
  token: string;
  // Servicios del turno con su profesional: el back calcula los horarios libres para todos juntos
  items: TurnoItem[];
  // Fechas con horario cargado del profesional (sin pasar, se pueden elegir todas)
  workDates?: string[];
  // Cliente para quien se carga el turno (salón) o turno que se reprograma: ver getHorariosLibresRequest
  options?: HorariosLibresOptions;
  value: Slot;
  onChange: (slot: Slot) => void;
}

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Resultado de la última consulta; `key` dice para qué fecha y servicios es (si no coincide, está cargando)
interface Result {
  key: string;
  horarios: string[];
  error: string;
}

// Días completos de la última búsqueda; `key` dice para qué días y servicios es (si no coincide, arranca de cero)
interface SinLugar {
  key: string;
  fechas: string[];
  terminado: boolean;
}

// Elegir fecha (calendario) y horario de inicio (los libres que devuelve el back, cada 15 min)
export const SlotPicker = ({ token, items, workDates, options, value, onChange }: SlotPickerProps) => {
  const [result, setResult] = useState<Result | null>(null);
  const key = `${value.fecha}|${JSON.stringify(items)}|${JSON.stringify(options ?? {})}`;

  // Encuesta TP4: entre los días que trabaja, los que ya no tienen lugar se apagan en el calendario a medida que se sabe
  const [sinLugar, setSinLugar] = useState<SinLugar | null>(null);
  const hoy = toIsoDate(new Date());
  const proximas = (workDates ?? []).filter((fecha) => fecha >= hoy).sort();
  const sinLugarKey = `${proximas.join(',')}|${JSON.stringify(items)}|${JSON.stringify(options ?? {})}`;

  useEffect(() => {
    if (proximas.length === 0 || items.length === 0) return;
    let cancelado = false;
    const agregar = (fecha: string) =>
      setSinLugar((prev) => ({
        key: sinLugarKey,
        fechas: [...(prev?.key === sinLugarKey ? prev.fechas : []), fecha],
        terminado: false,
      }));
    buscarDiasSinLugar(token, proximas, items, options ?? {}, agregar, () => cancelado).then(() => {
      if (!cancelado) setSinLugar((prev) => ({ key: sinLugarKey, fechas: prev?.key === sinLugarKey ? prev.fechas : [], terminado: true }));
    });
    return () => {
      cancelado = true;
    };
    // `sinLugarKey` resume las fechas, los items y las options (llegan como objetos nuevos en cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, sinLugarKey]);

  const actual = sinLugar?.key === sinLugarKey ? sinLugar : null;
  const completos = actual?.fechas ?? [];
  const todosCompletos = actual?.terminado === true && proximas.length > 0 && completos.length >= proximas.length;

  useEffect(() => {
    if (!value.fecha || items.length === 0) return;
    let ignore = false;
    getHorariosLibresRequest(token, value.fecha, items, options)
      .then((data) => {
        if (!ignore) setResult({ key, horarios: data.horarios, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key, horarios: [], error: err instanceof ApiError ? err.message : unexpectedError });
      });
    return () => {
      ignore = true;
    };
    // `key` resume fecha, items y options (llegan como objetos nuevos en cada render)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, key]);

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const current = result?.key === key ? result : null;

  if (todosCompletos) {
    return (
      <p className="font-inter text-sm text-capilar-grey">
        No quedan horarios libres en los próximos {MAX_DIAS_ANTICIPACION} días. Probá con otra persona del equipo.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-6 md:flex-row md:items-start">
      <div className="flex flex-col gap-2 self-center md:self-start">
        <div className="rounded-[6px] border border-gray-200 bg-white p-3">
          <DatePicker
            value={value.fecha}
            onChange={(fecha) => onChange({ fecha, hora: '' })}
            min={today}
            max={addDays(today, MAX_DIAS_ANTICIPACION)}
            enabledDates={workDates}
            fullDates={completos}
          />
        </div>
        {workDates && (
          <p className="flex flex-wrap gap-x-4 gap-y-1 px-1 font-inter text-xs text-capilar-grey">
            <span>
              <span className="font-bold text-capilar-plum">15</span> con horarios
            </span>
            <span>
              <span className="text-gray-400 line-through">15</span> sin lugar
            </span>
            {proximas.length > 0 && !actual?.terminado && <span>Revisando días…</span>}
          </p>
        )}
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        {!value.fecha ? (
          <p className="font-inter text-sm text-capilar-grey">Elegí un día en el calendario para ver los horarios libres.</p>
        ) : (
          <>
            <p className="font-inter text-sm font-semibold text-black first-letter:uppercase">{formatFechaLarga(value.fecha)}</p>
            {!current ? (
              <Loader size="sm" label="Buscando horarios libres..." className="items-start! py-2" />
            ) : current.error ? (
              <Alert variant="error" title="No se pudieron cargar los horarios">
                {current.error}
              </Alert>
            ) : current.horarios.length === 0 ? (
              <p className="font-inter text-sm text-capilar-grey">No quedan horarios libres ese día. Probá con otra fecha.</p>
            ) : (
              <RadioGroup aria-label="Horario de inicio" className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-5">
                {current.horarios.map((hora) => {
                  const selected = value.hora === hora;
                  return (
                    <button
                      key={hora}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      onClick={() => onChange({ fecha: value.fecha, hora })}
                      // Elegido como el resto de las opciones (servicio, profesional, chips): borde violeta y fondo lila
                      className={`rounded-lg border px-2 py-2 font-inter text-sm transition-colors ${
                        selected
                          ? 'border-capilar-violet bg-capilar-violet/10 font-semibold text-black'
                          : 'border-gray-300 bg-white text-black hover:border-capilar-violet hover:text-capilar-violet'
                      }`}
                    >
                      {hora}
                    </button>
                  );
                })}
              </RadioGroup>
            )}
          </>
        )}
      </div>
    </div>
  );
};
