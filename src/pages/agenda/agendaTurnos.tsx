import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getUpcomingWorkDatesRequest } from '../../api/professionals';
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
  minutosHastaInicio,
  rejectTurnoRequest,
  rescheduleTurnoRequest,
  startOfWeek,
  toIsoDate,
} from '../../api/turnos';
import type { Turno } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { TurnoAction, TurnoCard } from '../../components/turnoCard/turnoCard';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

type Vista = 'semana' | 'pendientes';

// Acción que necesita confirmación (con motivo) o elegir un horario nuevo
type Pending = { type: 'rechazar' | 'cancelar' | 'completar' | 'reprogramar'; turno: Turno };

interface AgendaTurnosProps {
  token: string;
  legajo: number;
}

// Solicitudes pendientes de acá a 60 días (el máximo para reservar). La agenda se pide de a 31 días: dos tramos.
const getPendingRequest = async (token: string) => {
  const today = new Date();
  const ranges = [0, MAX_DIAS_AGENDA].map((offset) => [
    toIsoDate(addDays(today, offset)),
    toIsoDate(addDays(today, Math.min(offset + MAX_DIAS_AGENDA - 1, MAX_DIAS_ANTICIPACION))),
  ]);
  const parts = await Promise.all(ranges.map(([desde, hasta]) => getAgendaRequest(token, desde, hasta)));
  return parts.flat().filter((turno) => turno.estado === 'PENDIENTE');
};

// Pestaña Turnos de la agenda: la semana día por día, o las solicitudes que esperan respuesta.
// Pendiente: confirmar o rechazar. Confirmado: cancelar o, desde que empieza, completar. Los activos se pueden reprogramar.
export const AgendaTurnos = ({ token, legajo }: AgendaTurnosProps) => {
  const [vista, setVista] = useState<Vista>('semana');
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const desde = toIsoDate(monday);
  const hasta = toIsoDate(addDays(monday, 6));

  const turnos = useFetch(vista === 'semana' ? `agenda-${desde}-${hasta}` : 'pendientes', () =>
    vista === 'semana' ? getAgendaRequest(token, desde, hasta) : getPendingRequest(token),
  );

  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  const replace = (updated: Turno) => turnos.setData((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

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
  };
  const texts = pending && pending.type !== 'reprogramar' ? dialogTexts[pending.type] : null;

  return (
    <div className="flex flex-col gap-6">
      {/* Semana o solicitudes por confirmar */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div role="tablist" aria-label="Ver" className="flex gap-2">
          {(
            [
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
              Hoy
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
          {vista === 'semana' ? 'No tenés turnos esta semana.' : 'No tenés solicitudes por confirmar.'}
        </p>
      ) : (
        [...byDay].map(([fecha, delDia]) => (
          <div key={fecha} className="flex flex-col gap-3">
            <h3 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">{formatFechaLarga(fecha)}</h3>
            {delDia.map((turno) => (
              <TurnoCard key={turno.id} turno={turno} actions={actionsFor(turno)} />
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
        <Button variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-3 uppercase">
          Volver
        </Button>
        <Button
          onClick={() => onSubmit(slot)}
          disabled={isLoading || !slot.hora}
          className="flex-1 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Enviando...' : 'Proponer horario'}
        </Button>
      </div>
    </div>
  );
};
