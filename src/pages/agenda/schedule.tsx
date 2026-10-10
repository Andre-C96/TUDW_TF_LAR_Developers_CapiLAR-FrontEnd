import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  BLOQUEO_MOTIVO_MAX,
  MAX_DIAS_CONSULTA,
  bloqueoLocal,
  createAvailabilityRequest,
  createBlockRequest,
  getAvailabilityRequest,
  getBlocksRequest,
  removeAvailabilityDateRequest,
  removeAvailabilityRequest,
  removeBlockRequest,
} from '../../api/professionals';
import type { Bloqueo, Disponibilidad } from '../../api/professionals';
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
  'rounded-lg border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet disabled:cursor-not-allowed disabled:opacity-50';
const arrowClasses =
  'flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-lg text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet';

const SectionHeader = ({ title, text }: { title: string; text: string }) => (
  <div className="flex flex-col gap-1">
    <Title as="h2" className="text-xl! md:text-2xl!">
      {title}
    </Title>
    <p className="font-inter text-sm text-capilar-grey">{text}</p>
  </div>
);

// Chip con ✕ para quitar (horario o bloqueo). Sin onRemove se muestra sin la ✕ (ej. un día que ya pasó)
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

// "sáb 10 oct" (todo el día), "sáb 10 oct al lun 12 oct", "sáb 10 oct, 09:00 a 13:00"
const formatBloqueo = (bloqueo: Bloqueo) => {
  const [inicioFecha, inicioHora] = bloqueoLocal(bloqueo.fechaInicio).split('T');
  const [finFecha, finHora] = bloqueoLocal(bloqueo.fechaFin).split('T');
  if (inicioHora === '00:00' && finHora === '00:00') {
    // Días completos: el fin es las 00:00 del día siguiente al último
    const ultimo = toIsoDate(addDays(fromIsoDate(finFecha), -1));
    return ultimo === inicioFecha ? formatFechaCorta(inicioFecha) : `${formatFechaCorta(inicioFecha)} al ${formatFechaCorta(ultimo)}`;
  }
  if (inicioFecha === finFecha) return `${formatFechaCorta(inicioFecha)}, ${inicioHora} a ${finHora}`;
  return `${formatFechaCorta(inicioFecha)} ${inicioHora} al ${formatFechaCorta(finFecha)} ${finHora}`;
};

interface ScheduleProps {
  token: string;
  legajo: number;
}

// Pestaña Mis horarios: en qué fechas y horarios atiende (cada semana puede ser distinta)
// y los días u horas en que no atiende (imprevistos, vacaciones). Con eso el back calcula los horarios libres.
export const Schedule = ({ token, legajo }: ScheduleProps) => (
  <div className="flex flex-col gap-8">
    <WorkHours token={token} legajo={legajo} />
    <Blocks token={token} legajo={legajo} />
  </div>
);

// Horarios de trabajo por fecha: la semana con flechas, cargar un horario en varias fechas a la vez
// y copiar los horarios de la semana a la siguiente
const WorkHours = ({ token, legajo }: ScheduleProps) => {
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const desde = toIsoDate(monday);
  const hasta = toIsoDate(addDays(monday, 6));
  const hours = useFetch(`horarios-${legajo}-${desde}`, () => getAvailabilityRequest(token, legajo, desde, hasta));

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
      hours.reload();
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
      hours.reload();
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
      toast.success('Semana copiada', { description: 'Revisá la semana siguiente y ajustá lo que cambie.' });
    } catch (err) {
      // Si la semana siguiente ya tenía horarios que se superponen, el back avisa en qué día
      hours.reload();
      toast.error('No se pudo copiar toda la semana', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setIsCopying(false);
    }
  };

  const hasHours = (hours.data?.length ?? 0) > 0;

  return (
    <div className={boxClasses}>
      <SectionHeader
        title="Días y horarios de atención"
        text="Cargá en qué días y horarios atendés: cada semana puede ser distinta. Podés tener más de un horario por día (ej. mañana y tarde), hasta 12 horas en total."
      />

      {/* Semana: flechas, "Hoy" y copiar a la siguiente */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <button type="button" onClick={() => setMonday((prev) => addDays(prev, -7))} aria-label="Semana anterior" className={arrowClasses}>
            ‹
          </button>
          <span className="min-w-48 text-center font-inter text-sm font-semibold text-black">{formatWeek(monday)}</span>
          <button type="button" onClick={() => setMonday((prev) => addDays(prev, 7))} aria-label="Semana siguiente" className={arrowClasses}>
            ›
          </button>
          <button type="button" onClick={() => setMonday(startOfWeek(new Date()))} className={smallButtonClasses}>
            Hoy
          </button>
        </div>
        <button type="button" onClick={copyToNextWeek} disabled={!hasHours || isCopying} className={smallButtonClasses}>
          {isCopying ? 'Copiando...' : 'Copiar a la semana siguiente'}
        </button>
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

      {/* Cargar: marcar días en el calendario y el horario */}
      <form onSubmit={add} noValidate className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4 md:flex-row md:items-start">
        <div className="self-center rounded-[6px] border border-gray-200 bg-white p-3 md:self-start">
          <MultiDatePicker value={fechas} onChange={setFechas} min={today} max={lastDay} maxSelected={MAX_DIAS_CONSULTA} />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          <div className="flex flex-col gap-1">
            <span className={labelClasses}>Agregar horario</span>
            <p className="font-inter text-sm text-capilar-grey">
              {fechas.length === 0
                ? `Marcá en el calendario los días que atendés (hasta ${MAX_DIAS_CONSULTA} por vez).`
                : `${fechas.length === 1 ? '1 día marcado' : `${fechas.length} días marcados`}: ${fechas.map(formatFechaCorta).join(', ')}.`}
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
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
              <Button type="button" variant="grey" onClick={() => setFechas([])} className="py-3 uppercase">
                Limpiar
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSaving}
              className="px-8 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : 'Agregar'}
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
};

const Blocks = ({ token, legajo }: ScheduleProps) => {
  const blocks = useFetch(`bloqueos-${legajo}`, () => getBlocksRequest(token, legajo));
  const today = toIsoDate(new Date());
  const [desdeFecha, setDesdeFecha] = useState(today);
  const [hastaFecha, setHastaFecha] = useState(today);
  const [allDay, setAllDay] = useState(true);
  const [desdeHora, setDesdeHora] = useState('09:00');
  const [hastaHora, setHastaHora] = useState('13:00');
  const [motivo, setMotivo] = useState('');
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [removingId, setRemovingId] = useState<number | null>(null);

  const add = async (event: FormEvent) => {
    event.preventDefault();
    setFormError('');
    if (!desdeFecha || !hastaFecha) return setFormError('Completá las fechas');
    if (desdeFecha < today) return setFormError('La fecha de inicio ya pasó');

    // Días completos: de las 00:00 del primero a las 00:00 del día siguiente al último
    const fechaInicio = `${desdeFecha}T${allDay ? '00:00' : desdeHora}`;
    const fechaFin = allDay ? `${toIsoDate(addDays(fromIsoDate(hastaFecha), 1))}T00:00` : `${hastaFecha}T${hastaHora}`;
    if (fechaInicio >= fechaFin) return setFormError('El inicio tiene que ser anterior al fin');

    setIsSaving(true);
    try {
      const created = await createBlockRequest(token, legajo, { fechaInicio, fechaFin, motivo: motivo.trim() || undefined });
      blocks.setData((prev) => [...prev, created].sort((a, b) => a.fechaInicio.localeCompare(b.fechaInicio)));
      setMotivo('');
      toast.success('Agenda bloqueada', { description: `${formatBloqueo(created)}: no se van a poder reservar turnos.` });
    } catch (err) {
      // 409 si ya hay turnos en ese período
      setFormError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const remove = async (bloqueo: Bloqueo) => {
    setRemovingId(bloqueo.id);
    try {
      await removeBlockRequest(token, legajo, bloqueo.id);
      blocks.setData((prev) => prev.filter((b) => b.id !== bloqueo.id));
      toast('Bloqueo quitado', { description: 'Esos horarios vuelven a estar disponibles.' });
    } catch (err) {
      toast.error('No se pudo quitar el bloqueo', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setRemovingId(null);
    }
  };

  return (
    <div className={boxClasses}>
      <SectionHeader
        title="Días libres"
        text="Para un imprevisto en días que ya tenías cargados (trámites, vacaciones): esas horas no se pueden reservar. Si ya tenés turnos en ese período, cancelalos o reprogramalos antes."
      />

      {blocks.error ? (
        <Alert variant="error" title="No se pudieron cargar tus días libres">
          {blocks.error}
        </Alert>
      ) : !blocks.data ? (
        <Loader size="sm" className="items-start! py-2" />
      ) : blocks.data.length === 0 ? (
        <p className="font-inter text-sm text-capilar-grey">No tenés días libres cargados.</p>
      ) : (
        <div className="flex flex-wrap gap-2">
          {blocks.data.map((b) => (
            <RemovableChip key={b.id} label={`Quitar bloqueo ${formatBloqueo(b)}`} onRemove={() => remove(b)} disabled={removingId === b.id}>
              <span className="first-letter:uppercase">{formatBloqueo(b)}</span>
              {b.motivo && <span className="text-capilar-grey"> · {b.motivo}</span>}
            </RemovableChip>
          ))}
        </div>
      )}

      <form onSubmit={add} noValidate className="flex flex-col gap-4 rounded-lg bg-gray-50 p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            label="Desde el día"
            type="date"
            min={today}
            value={desdeFecha}
            onChange={(event) => {
              setDesdeFecha(event.target.value);
              if (event.target.value > hastaFecha) setHastaFecha(event.target.value);
            }}
          />
          <FormField label="Hasta el día" type="date" min={desdeFecha} value={hastaFecha} onChange={(event) => setHastaFecha(event.target.value)} />
        </div>

        <label className="flex items-center gap-2 font-inter text-sm text-black">
          <input type="checkbox" checked={allDay} onChange={(event) => setAllDay(event.target.checked)} className="h-4 w-4 accent-capilar-violet" />
          Todo el día
        </label>

        {!allDay && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField label="Desde la hora" type="time" step={900} value={desdeHora} onChange={(event) => setDesdeHora(event.target.value)} />
            <FormField label="Hasta la hora" type="time" step={900} value={hastaHora} onChange={(event) => setHastaHora(event.target.value)} />
          </div>
        )}

        <FormField
          label="Motivo (opcional)"
          value={motivo}
          maxLength={BLOQUEO_MOTIVO_MAX}
          placeholder="Ej.: vacaciones"
          onChange={(event) => setMotivo(event.target.value)}
        />

        {formError && (
          <p role="alert" className="font-inter text-sm text-red-500">
            {formError}
          </p>
        )}

        <Button
          type="submit"
          disabled={isSaving}
          className="self-end px-8 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? 'Guardando...' : 'Bloquear'}
        </Button>
      </form>
    </div>
  );
};
