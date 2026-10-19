import { useEffect, useEffectEvent, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { puedeCargarFicha } from '../../api/fichas';
import { getUpcomingWorkDatesRequest } from '../../api/professionals';
import { FRECUENCIAS, getSeriesRequest, seriesPorTurno, turnoEnSerie } from '../../api/series';
import {
  MAX_DIAS_AGENDA,
  MAX_DIAS_ANTICIPACION,
  acceptTurnoRequest,
  addDays,
  cancelTurnoRequest,
  completeTurnoRequest,
  formatFechaLarga,
  formatWeek,
  getAgendaRequest,
  markAbsentRequest,
  minutosHastaInicio,
  puedeMarcarAusente,
  rejectTurnoRequest,
  rescheduleTurnoRequest,
  startOfWeek,
  toIsoDate,
} from '../../api/turnos';
import type { Turno, TurnoDetalle } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { SerieBadge, TurnoAction, TurnoCard } from '../../components/turnoCard/turnoCard';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FichaModal } from './fichaModal';
import { SerieModal } from './serieModal';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

type Vista = 'hoy' | 'semana' | 'pendientes';

// Cada cuánto se actualiza la vista Hoy (también al volver a la pestaña)
const REFRESCO_HOY_MS = 60_000;

// Grupos de la vista Hoy, como en el mail de agenda diaria: primero los que avisaron que vienen
const gruposHoy: { titulo: string; dot: string; incluye: (turno: Turno) => boolean }[] = [
  { titulo: 'Asistencia confirmada', dot: 'bg-green-600', incluye: (t) => t.estado === 'CONFIRMADO' && !!t.asistenciaConfirmadaEn },
  { titulo: 'Sin confirmar asistencia', dot: 'bg-capilar-peach', incluye: (t) => t.estado === 'CONFIRMADO' && !t.asistenciaConfirmadaEn },
  { titulo: 'Por resolver', dot: 'bg-amber-400', incluye: (t) => t.estado === 'PENDIENTE' || t.estado === 'REPROGRAMADO' },
  {
    titulo: 'Completados, ausentes y cancelados',
    dot: 'bg-gray-400',
    incluye: (t) => ['COMPLETADO', 'AUSENTE', 'CANCELADO', 'RECHAZADO'].includes(t.estado),
  },
];

// Acción que necesita confirmación (con motivo) o elegir un horario nuevo
type Pending = { type: 'rechazar' | 'cancelar' | 'completar' | 'ausente' | 'reprogramar'; turno: Turno };

interface AgendaTurnosProps {
  token: string;
  legajo: number;
}

// Solicitudes pendientes de acá a 60 días (el máximo para reservar). La agenda se pide de a 31 días: dos tramos.
const getPendingRequest = async (token: string, legajo: number) => {
  const today = new Date();
  const ranges = [0, MAX_DIAS_AGENDA].map((offset) => [
    toIsoDate(addDays(today, offset)),
    toIsoDate(addDays(today, Math.min(offset + MAX_DIAS_AGENDA - 1, MAX_DIAS_ANTICIPACION))),
  ]);
  const parts = await Promise.all(ranges.map(([desde, hasta]) => getAgendaRequest(token, legajo, desde, hasta)));
  return parts.flat().filter((turno) => turno.estado === 'PENDIENTE');
};

// Pestaña Turnos de la agenda: hoy agrupado por asistencia (se actualiza solo), la semana día por día,
// o las solicitudes que esperan respuesta.
// Pendiente (servicios que requieren aprobación): confirmar o rechazar. Confirmado: cancelar o, desde que empieza, completar;
// desde la hora de fin, marcar ausente. Los activos se pueden reprogramar.
export const AgendaTurnos = ({ token, legajo }: AgendaTurnosProps) => {
  const [vista, setVista] = useState<Vista>('hoy');
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const desde = toIsoDate(monday);
  const hasta = toIsoDate(addDays(monday, 6));
  const hoy = toIsoDate(new Date());

  const keys: Record<Vista, string> = { hoy: `hoy-${hoy}`, semana: `agenda-${desde}-${hasta}`, pendientes: 'pendientes' };
  const turnos = useFetch(keys[vista], () => {
    if (vista === 'hoy') return getAgendaRequest(token, legajo, hoy, hoy);
    if (vista === 'semana') return getAgendaRequest(token, legajo, desde, hasta);
    return getPendingRequest(token, legajo);
  });

  // Vista Hoy: se actualiza sola (cada minuto y al volver a la pestaña) sin mostrar el loader
  const refreshHoy = useEffectEvent(async () => {
    try {
      const fresh = await getAgendaRequest(token, legajo, hoy, hoy);
      turnos.setData(() => fresh);
    } catch {
      // Sin conexión: se reintenta en el próximo refresco
    }
  });

  useEffect(() => {
    if (vista !== 'hoy') return;
    const interval = setInterval(refreshHoy, REFRESCO_HOY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshHoy();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [vista]);

  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  // Servicio del turno con la ficha técnica abierta
  const [ficha, setFicha] = useState<{ turno: Turno; detalle: TurnoDetalle } | null>(null);
  // Turno que se va a repetir (serie)
  const [repetir, setRepetir] = useState<Turno | null>(null);
  // Los turnos no traen su serie: se cruzan con las series del profesional
  const series = useFetch('series', () => getSeriesRequest(token));
  const seriePorTurno = seriesPorTurno(series.data ?? []);

  const badgeFor = (turno: Turno) => {
    const serie = seriePorTurno.get(turno.id);
    return serie ? <SerieBadge>{FRECUENCIAS[serie.frecuencia].label}</SerieBadge> : undefined;
  };

  const replace =(updated: Turno) => turnos.setData((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const closePending = () => {
    if (busyId !== null) return;
    setPending(null);
    setActionError('');
  };

  // Corre la acción sobre un turno: actualiza la lista y avisa con un toast; los errores van al modal o a un toast
  const run = async (turno: Turno, request: () => Promise<Turno>, success: string, description: string) => {
    setBusyId(turno.id);
    setActionError('');
    try {
      replace(await request());
      setPending(null);
      toast.success(success, { description });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : unexpectedError;
      if (pending) setActionError(message);
      else toast.error('No se pudo actualizar el turno', { description: message });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDialog = (motivo: string) => {
    if (!pending) return;
    const { turno } = pending;
    if (pending.type === 'rechazar') {
      return run(turno, () => rejectTurnoRequest(token, turno.id, motivo), 'Solicitud rechazada', 'Le avisamos al cliente para que elija otro horario.');
    }
    if (pending.type === 'cancelar') {
      return run(turno, () => cancelTurnoRequest(token, turno.id, motivo), 'Turno cancelado', 'Le avisamos al cliente por mail.');
    }
    if (pending.type === 'completar') {
      return run(turno, () => completeTurnoRequest(token, turno.id), 'Turno completado', 'Ya figura en el historial del cliente.');
    }
    if (pending.type === 'ausente') {
      return run(turno, () => markAbsentRequest(token, turno.id), 'Marcado como ausente', 'Queda registrado que el cliente no vino.');
    }
  };

  const actionsFor = (turno: Turno) => {
    const busy = busyId === turno.id;
    const started = minutosHastaInicio(turno) <= 0;
    const open = (type: Pending['type']) => () => setPending({ type, turno });

    switch (turno.estado) {
      case 'PENDIENTE':
        return (
          <>
            <TurnoAction
              variant="positiva"
              disabled={busy}
              onClick={() => run(turno, () => acceptTurnoRequest(token, turno.id), 'Turno confirmado', 'Le avisamos al cliente por mail.')}
            >
              Confirmar
            </TurnoAction>
            {!started && (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('rechazar')}>
              Rechazar
            </TurnoAction>
          </>
        );
      case 'CONFIRMADO':
        return (
          <>
            {started ? (
              <TurnoAction variant="positiva" disabled={busy} onClick={open('completar')}>
                Completar
              </TurnoAction>
            ) : (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            {puedeMarcarAusente(turno) && (
              <TurnoAction disabled={busy} onClick={open('ausente')}>
                Marcar ausente
              </TurnoAction>
            )}
            {/* Se repite antes de completarlo: la serie sale de un turno confirmado */}
            {series.data && !turnoEnSerie(series.data, turno.id) && (
              <TurnoAction disabled={busy} onClick={() => setRepetir(turno)}>
                Repetir
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('cancelar')}>
              Cancelar
            </TurnoAction>
          </>
        );
      case 'REPROGRAMADO':
        return (
          <>
            {!started && (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('cancelar')}>
              Cancelar
            </TurnoAction>
          </>
        );
      default:
        return undefined;
    }
  };

  // Ficha técnica de cada servicio: verla si existe (cualquier profesional) o cargarla (el suyo, confirmado y desde que
  // empieza ese servicio). La vista Hoy se refresca cada minuto, así que el botón aparece solo a la hora del turno
  const fichaActionFor = (turno: Turno) => (detalle: TurnoDetalle) => {
    const tiene = !!detalle.fichaId;
    if (!tiene && !(detalle.legajo === legajo && puedeCargarFicha(turno, detalle))) return null;
    return (
      <button
        type="button"
        onClick={() => setFicha({ turno, detalle })}
        className={`ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 align-middle font-inter text-xs font-semibold transition-colors ${
          tiene
            ? 'border-capilar-violet/40 bg-purple-50 text-capilar-violet hover:border-capilar-violet'
            : 'border-dashed border-gray-300 text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
        }`}
      >
        {tiene ? 'Ver ficha' : '+ Cargar ficha'}
      </button>
    );
  };

  // La ficha se creó o se quitó: el turno de la lista se actualiza sin volver a pedir la agenda
  const setFichaId = (turnoId: number, detalleId: number, fichaId: number | null) =>
    turnos.setData((prev) =>
      prev.map((t) =>
        t.id === turnoId ? { ...t, detalles: t.detalles.map((d) => (d.id === detalleId ? { ...d, fichaId } : d)) } : t,
      ),
    );

  // Servicios propios sin ficha: al completar el turno ya no se puede cargar
  const sinFicha = (turno: Turno) => turno.detalles.some((d) => d.legajo === legajo && !d.fichaId);

  // Turnos agrupados por día, en el orden en que llegan (fecha y hora)
  const byDay = new Map<string, Turno[]>();
  for (const turno of turnos.data ?? []) byDay.set(turno.fecha, [...(byDay.get(turno.fecha) ?? []), turno]);

  const dialogTexts = {
    rechazar: {
      title: 'Rechazar solicitud',
      text: '¿Rechazar esta solicitud? Al cliente le llega un aviso para que elija otro horario.',
      confirm: 'Rechazar',
      reason: { label: 'Motivo', required: true, hint: 'Es interno del salón: el cliente no lo ve.', placeholder: 'Ej.: no llego con el tiempo para ese servicio' },
    },
    cancelar: {
      title: 'Cancelar turno',
      text: '¿Cancelar este turno? El horario queda libre y le avisamos al cliente.',
      confirm: 'Cancelar turno',
      reason: { label: 'Motivo', required: true, hint: 'Se lo enviamos al cliente en el aviso.', placeholder: 'Ej.: no voy a estar ese día' },
    },
    completar: {
      title: 'Completar turno',
      text: '¿Marcar este turno como realizado?',
      confirm: 'Completar',
      reason: undefined,
    },
    ausente: {
      title: 'Marcar ausente',
      text: '¿El cliente no vino a este turno? Queda registrado como ausente.',
      confirm: 'Marcar ausente',
      reason: undefined,
    },
  };
  const texts = pending && pending.type !== 'reprogramar' ? dialogTexts[pending.type] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Hoy, semana o solicitudes por confirmar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Ver" className="flex gap-2">
          {(
            [
              ['hoy', 'Hoy'],
              ['semana', 'Semana'],
              ['pendientes', 'Por confirmar'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={vista === value}
              onClick={() => setVista(value)}
              className={`rounded-full px-4 py-2 font-inter text-sm font-medium transition-colors ${
                vista === value ? 'bg-capilar-peach/75 text-black' : 'bg-white text-capilar-grey hover:text-capilar-violet'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {vista === 'hoy' && (
          <span className="font-inter text-sm font-semibold text-black first-letter:uppercase">{formatFechaLarga(hoy)}</span>
        )}

        {vista === 'semana' && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonday((prev) => addDays(prev, -7))}
              aria-label="Semana anterior"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-lg text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet"
            >
              ‹
            </button>
            <span className="min-w-48 text-center font-inter text-sm font-semibold text-black">{formatWeek(monday)}</span>
            <button
              type="button"
              onClick={() => setMonday((prev) => addDays(prev, 7))}
              aria-label="Semana siguiente"
              className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-300 bg-white text-lg text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet"
            >
              ›
            </button>
            <button
              type="button"
              onClick={() => setMonday(startOfWeek(new Date()))}
              className="rounded-lg border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet"
            >
              Esta semana
            </button>
          </div>
        )}
      </div>

      {turnos.error ? (
        <Alert variant="error" title="No se pudo cargar la agenda">
          {turnos.error}
        </Alert>
      ) : turnos.isLoading ? (
        <Loader label="Cargando turnos..." className="py-12" />
      ) : byDay.size === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">
          {vista === 'hoy' ? 'No tenés turnos hoy.' : vista === 'semana' ? 'No tenés turnos esta semana.' : 'No tenés solicitudes por confirmar.'}
        </p>
      ) : vista === 'hoy' ? (
        <TodayView turnos={turnos.data ?? []} actionsFor={actionsFor} fichaActionFor={fichaActionFor} badgeFor={badgeFor} />
      ) : (
        [...byDay].map(([fecha, delDia]) => (
          <div key={fecha} className="flex flex-col gap-3">
            <h3 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">{formatFechaLarga(fecha)}</h3>
            {delDia.map((turno) => (
              <TurnoCard
                key={turno.id}
                turno={turno}
                actions={actionsFor(turno)}
                detalleAction={fichaActionFor(turno)}
                badge={badgeFor(turno)}
              />
            ))}
          </div>
        ))
      )}

      {texts && pending && (
        <ConfirmDialog
          isOpen
          onClose={closePending}
          title={texts.title}
          confirmLabel={texts.confirm}
          onConfirm={confirmDialog}
          isLoading={busyId !== null}
          error={actionError}
          reason={texts.reason}
        >
          <p>{texts.text}</p>
          <p className="mt-2 font-semibold text-black">
            {pending.turno.cliente.nombre} {pending.turno.cliente.apellido} · {formatFechaLarga(pending.turno.fecha)}, {pending.turno.horaInicio}
          </p>
          {pending.type === 'completar' && (
            <p className="mt-2">
              {sinFicha(pending.turno)
                ? 'Ojo: todavía no cargaste la ficha técnica y, una vez completado, ya no se puede cargar.'
                : 'La ficha técnica se cierra y la clienta ve tus indicaciones y las fotos en su historial.'}
            </p>
          )}
        </ConfirmDialog>
      )}

      <Modal isOpen={pending?.type === 'reprogramar'} onClose={closePending} ariaLabel="Reprogramar turno" className="max-w-3xl!">
        {pending?.type === 'reprogramar' && (
          <RescheduleForm
            token={token}
            legajo={legajo}
            turno={pending.turno}
            onCancel={closePending}
            isLoading={busyId !== null}
            error={actionError}
            onSubmit={(slot) =>
              run(
                pending.turno,
                () => rescheduleTurnoRequest(token, pending.turno.id, slot.fecha, slot.hora),
                'Nuevo horario enviado',
                'El turno queda esperando a que el cliente lo acepte.',
              )
            }
          />
        )}
      </Modal>

      {ficha && (
        <FichaModal
          token={token}
          legajo={legajo}
          turno={ficha.turno}
          detalle={ficha.detalle}
          onClose={() => setFicha(null)}
          onFichaChange={(fichaId) => setFichaId(ficha.turno.id, ficha.detalle.id, fichaId)}
        />
      )}

      {repetir && (
        <SerieModal
          token={token}
          legajo={legajo}
          turno={repetir}
          onClose={() => setRepetir(null)}
          onCreated={(serie) => {
            setRepetir(null);
            // La serie trae turnos nuevos: se vuelven a pedir los turnos y las series
            turnos.reload();
            series.reload();
            const creados = serie.fechas.filter((f) => f.turnoId !== null).length;
            toast.success('Serie creada', {
              description: `Reservamos ${creados} ${creados === 1 ? 'turno' : 'turnos'} y le avisamos al cliente por mail.`,
            });
          }}
        />
      )}
    </div>
  );
};

interface TodayViewProps {
  turnos: Turno[];
  actionsFor: (turno: Turno) => ReactNode;
  fichaActionFor: (turno: Turno) => (detalle: TurnoDetalle) => ReactNode;
  badgeFor: (turno: Turno) => ReactNode;
}

// Turnos de hoy: arriba un resumen con cuántos hay de cada grupo y debajo cada grupo por hora
const TodayView = ({ turnos, actionsFor, fichaActionFor, badgeFor }: TodayViewProps) => {
  const grupos = gruposHoy
    .map((grupo) => ({ ...grupo, turnos: turnos.filter(grupo.incluye) }))
    .filter((grupo) => grupo.turnos.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label="Resumen de hoy" className="flex flex-wrap gap-2">
        {grupos.map((grupo) => (
          <li
            key={grupo.titulo}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 font-inter text-xs text-black shadow-sm"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${grupo.dot}`} />
            {grupo.titulo}
            <span className="font-semibold">{grupo.turnos.length}</span>
          </li>
        ))}
      </ul>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${grupo.dot}`} />
            {grupo.titulo}
          </h3>
          {grupo.turnos.map((turno) => (
            <TurnoCard
              key={turno.id}
              turno={turno}
              actions={actionsFor(turno)}
              detalleAction={fichaActionFor(turno)}
              badge={badgeFor(turno)}
            />
          ))}
        </div>
      ))}
    </div>
  );
};

interface RescheduleFormProps {
  token: string;
  legajo: number;
  turno: Turno;
  onSubmit: (slot: Slot) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

// Elegir el nuevo día y horario (mismos servicios y profesionales). El cliente tiene que aceptarlo.
const RescheduleForm = ({ token, legajo, turno, onSubmit, onCancel, isLoading, error }: RescheduleFormProps) => {
  const [slot, setSlot] = useState<Slot>({ fecha: '', hora: '' });
  const availability = useFetch(`disponibilidad-${legajo}`, () => getUpcomingWorkDatesRequest(token, legajo));
  const items = turno.detalles.map((detalle) => ({ servicioId: detalle.servicioId, legajo: detalle.legajo }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Reprogramar turno</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {turno.cliente.nombre} {turno.cliente.apellido} · hoy: {formatFechaLarga(turno.fecha)}, {turno.horaInicio}. Elegí el nuevo horario: el
          cliente lo tiene que aceptar.
        </p>
      </div>

      {availability.isLoading ? (
        <Loader size="sm" className="py-4" />
      ) : (
        <SlotPicker
          token={token}
          items={items}
          options={{ turnoId: turno.id }}
          workDates={availability.data ?? undefined}
          value={slot}
          onChange={setSlot}
        />
      )}

      {error && (
        <p role="alert" className="text-center font-inter text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
          Volver
        </Button>
        <Button
          onClick={() => onSubmit(slot)}
          disabled={isLoading || !slot.hora}
          className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Enviando...' : 'Proponer horario'}
        </Button>
      </div>
    </div>
  );
};
