import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  MAX_DIAS_CONSULTA,
  createAvailabilityRequest,
  getAvailabilityRequest,
  getUpcomingWorkDatesRequest,
  removeAvailabilityDateRequest,
  removeAvailabilityRequest,
} from '../../api/professionals';
import type { Disponibilidad } from '../../api/professionals';
import {
  MAX_DIAS_ANTICIPACION,
  addDays,
  formatFechaCorta,
  formatWeek,
  fromIsoDate,
  startOfWeek,
  toIsoDate,
} from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { MultiDatePicker } from '../../components/datePicker/datePicker';
import { FormField } from '../../components/form/form';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

const boxClasses = 'flex flex-col gap-6 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8';
const labelClasses = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';
const smallButtonClasses =
  'rounded-md border border-gray-300 bg-white px-2.5 py-1 font-inter text-[11px] font-semibold uppercase tracking-wider text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet disabled:cursor-not-allowed disabled:opacity-50';
const arrowClasses =
  'flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-lg text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet';

// Chip con ✕ para quitar un horario. Sin onRemove se muestra sin la ✕ (ej. un día que ya pasó)
const RemovableChip = ({
  children,
  label,
  onRemove,
  disabled,
}: {
  children: ReactNode;
  label: string;
  onRemove?: () => void;
  disabled: boolean;
}) => (
  <span
    className={`inline-flex items-center gap-2 rounded-full border border-capilar-violet/20 bg-capilar-violet/10 py-1.5 font-inter text-sm text-black ${
      onRemove ? 'pr-2 pl-4' : 'px-4'
    }`}
  >
    {children}
    {onRemove && (
      <button
        type="button"
        onClick={onRemove}
        disabled={disabled}
        aria-label={label}
        className="flex h-6 w-6 items-center justify-center rounded-full text-xs text-capilar-grey transition-colors hover:bg-white hover:text-red-500 disabled:opacity-50"
      >
        ✕
      </button>
    )}
  </span>
);

interface ScheduleProps {
  token: string;
  legajo: number;
}

// Pestaña Mis horarios: en qué fechas y horarios atiende (cada semana puede ser distinta; un día sin horarios es un día libre).
// Con eso el back calcula los horarios libres. A la izquierda, el calendario con los días ya cargados resaltados, para cargar
// un horario en varias fechas a la vez; a la derecha, la semana con flechas y "Copiar a la semana siguiente"
export const Schedule = ({ token, legajo }: ScheduleProps) => {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const desde = toIsoDate(monday);
  const hasta = toIsoDate(addDays(monday, 6));
  const hours = useFetch(`horarios-${legajo}-${desde}`, () => getAvailabilityRequest(token, legajo, desde, hasta));
  // Para resaltar en el calendario los días que ya tienen horario
  const workDates = useFetch(`disponibilidad-${legajo}`, () => getUpcomingWorkDatesRequest(token, legajo));

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayIso = toIsoDate(today);
  const lastDay = addDays(today, MAX_DIAS_ANTICIPACION);

  const [fechas, setFechas] = useState<string[]>([]);
  const [inicio, setInicio] = useState('09:00');
  const [fin, setFin] = useState('18:00');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isCopying, setIsCopying] = useState(false);
  const [removing, setRemoving] = useState<string | null>(null);

  const days = Array.from({ length: 7 }, (_, i) => toIsoDate(addDays(monday, i)));

  const reload = () => {
    hours.reload();
    workDates.reload();
  };

  // Al marcar un día en el calendario, la semana de la derecha pasa a ser la de ese día
  const pickDates = (next: string[]) => {
    const added = next.find((fecha) => !fechas.includes(fecha));
    if (added) setMonday(startOfWeek(fromIsoDate(added)));
    setFechas(next);
  };

  // Mismo horario en varias fechas: el back guarda todas o ninguna
  const add = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (fechas.length === 0) return setFormError('Marcá al menos un día en el calendario');
    if (!inicio || !fin) return setFormError('Completá el horario de inicio y de fin');
    if (inicio >= fin) return setFormError('El horario de inicio tiene que ser anterior al de fin');

    setIsSaving(true);
    try {
      const created = await createAvailabilityRequest(token, legajo, { fechas, horarioInicio: inicio, horarioFin: fin });
      reload();
      setFechas([]);
      toast.success('Horario cargado', {
        description: `De ${inicio} a ${fin} ${created.length === 1 ? `el ${formatFechaCorta(created[0].fecha)}` : `en ${created.length} días`}.`,
      });
    } catch (err) {
      // 409 si se superpone con otro horario de ese día; 400 si la jornada pasa de 12 h
      setFormError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  // Quita un horario (key: id) o todos los de un día (key: fecha). 409 si hay turnos reservados
  const remove = async (key: string, request: () => Promise<unknown>, description: string) => {
    setRemoving(key);
    try {
      await request();
      reload();
      toast('Horario quitado', { description });
    } catch (err) {
      toast.error('No se pudo quitar', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setRemoving(null);
    }
  };

  // Los mismos horarios, 7 días después. Se agrupan por horario para mandar cada uno con todas sus fechas
  const copyToNextWeek = async () => {
    const groups = new Map<string, string[]>();
    for (const h of hours.data ?? []) {
      const fecha = toIsoDate(addDays(fromIsoDate(h.fecha), 7));
      if (fecha < todayIso || fecha > toIsoDate(lastDay)) continue;
      const key = `${h.horarioInicio}|${h.horarioFin}`;
      groups.set(key, [...(groups.get(key) ?? []), fecha]);
    }
    if (groups.size === 0) return;

    setIsCopying(true);
    try {
      for (const [key, groupFechas] of groups) {
        const [horarioInicio, horarioFin] = key.split('|');
        await createAvailabilityRequest(token, legajo, { fechas: groupFechas, horarioInicio, horarioFin });
      }
      setMonday((prev) => addDays(prev, 7));
      workDates.reload();
      toast.success('Semana copiada', { description: 'Revisá la semana siguiente y ajustá lo que cambie.' });
    } catch (err) {
      // Si la semana siguiente ya tenía horarios que se superponen, el back avisa en qué día
      reload();
      toast.error('No se pudo copiar toda la semana', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setIsCopying(false);
    }
  };

  const hasHours = (hours.data?.length ?? 0) > 0;

  return (
    <div className={boxClasses}>
      <div className="flex flex-col gap-1">
        <Title as="h2" className="text-xl! md:text-2xl!">
          Días y horarios de atención
        </Title>
        <p className="font-inter text-sm text-capilar-grey">
          Cargá en qué días y horarios atendés: cada semana puede ser distinta. Podés tener más de un horario por día (ej. mañana y tarde),
          hasta 12 horas en total. Los días sin horarios no se pueden reservar.
        </p>
      </div>

      <div className="grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-start">
        {/* Cargar: marcar días en el calendario y el horario */}
        <form onSubmit={add} noValidate className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 lg:w-80">
          <div className="self-center rounded-[6px] border border-gray-200 bg-white p-2">
            <MultiDatePicker
              value={fechas}
              onChange={pickDates}
              min={today}
              max={lastDay}
              maxSelected={MAX_DIAS_CONSULTA}
              markedDates={workDates.data ?? undefined}
              className="rdp-compact"
            />
          </div>
          <div className="flex flex-col gap-1">
            <span className={labelClasses}>Agregar horario</span>
            <p className="font-inter text-xs text-capilar-grey">
              {fechas.length === 0
                ? `Marcá en el calendario los días que atendés (hasta ${MAX_DIAS_CONSULTA} por vez). Los resaltados ya tienen horario.`
                : `${fechas.length === 1 ? '1 día marcado' : `${fechas.length} días marcados`}: ${fechas.map(formatFechaCorta).join(', ')}.`}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <FormField label="Desde" type="time" step={900} value={inicio} onChange={(event) => setInicio(event.target.value)} />
            <FormField label="Hasta" type="time" step={900} value={fin} onChange={(event) => setFin(event.target.value)} />
          </div>
          {formError && (
            <p role="alert" className="font-inter text-sm text-red-500">
              {formError}
            </p>
          )}
          <div className="flex justify-end gap-3">
            {fechas.length > 0 && (
              <Button type="button" variant="grey" onClick={() => setFechas([])} className="py-2 text-sm uppercase">
                Limpiar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </form>

        {/* Semana: flechas, "Hoy", copiar a la siguiente y los horarios de cada día */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col items-start gap-2">
            <div className="flex items-center gap-2">
              <button type="button" onClick={() => setMonday((prev) => addDays(prev, -7))} aria-label="Semana anterior" className={arrowClasses}>
                ‹
              </button>
              <span className="min-w-48 text-center font-inter text-sm font-semibold text-black">{formatWeek(monday)}</span>
              <button type="button" onClick={() => setMonday((prev) => addDays(prev, 7))} aria-label="Semana siguiente" className={arrowClasses}>
                ›
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={() => setMonday(startOfWeek(new Date()))} className={smallButtonClasses}>
                Hoy
              </button>
              <button type="button" onClick={copyToNextWeek} disabled={!hasHours || isCopying} className={smallButtonClasses}>
                {isCopying ? 'Copiando...' : 'Copiar a la semana siguiente'}
              </button>
            </div>
          </div>

          {hours.error ? (
            <Alert variant="error" title="No se pudieron cargar tus horarios">
              {hours.error}
            </Alert>
          ) : !hours.data ? (
            <Loader size="sm" className="items-start! py-2" />
          ) : (
            <ul className="divide-y divide-gray-100">
              {days.map((fecha) => {
                const delDia: Disponibilidad[] = hours.data!.filter((h) => h.fecha === fecha);
                const isPast = fecha < todayIso;
                return (
                  <li key={fecha} className={`flex flex-col gap-2 py-3 sm:flex-row sm:items-center ${isPast ? 'opacity-50' : ''}`}>
                    <span className="w-32 shrink-0 font-inter text-sm font-semibold text-black first-letter:uppercase">{formatFechaCorta(fecha)}</span>
                    {delDia.length === 0 ? (
                      <span className="font-inter text-sm text-gray-400">No atendés</span>
                    ) : (
                      <div className="flex flex-1 flex-wrap items-center gap-2">
                        {delDia.map((h) => (
                          <RemovableChip
                            key={h.id}
                            label={`Quitar el horario de ${h.horarioInicio} a ${h.horarioFin} del ${formatFechaCorta(fecha)}`}
                            onRemove={
                              isPast
                                ? undefined
                                : () =>
                                    remove(
                                      String(h.id),
                                      () => removeAvailabilityRequest(token, legajo, h.id),
                                      `${formatFechaCorta(fecha)}, de ${h.horarioInicio} a ${h.horarioFin}.`,
                                    )
                            }
                            disabled={removing !== null}
                          >
                            {h.horarioInicio} a {h.horarioFin}
                          </RemovableChip>
                        ))}
                        {!isPast && delDia.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              remove(fecha, () => removeAvailabilityDateRequest(token, legajo, fecha), `Ya no atendés el ${formatFechaCorta(fecha)}.`)
                            }
                            disabled={removing !== null}
                            className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-red-500 disabled:opacity-50"
                          >
                            Quitar día
                          </button>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
};
