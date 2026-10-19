import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  HORAS_CANCELACION_CLIENTE,
  acceptRescheduleRequest,
  cancelTurnoRequest,
  clientePuedeCancelar,
  getMyTurnosRequest,
  createTurnoRequest,
  formatFechaLarga,
  minutosHastaInicio,
  toIsoDate,
  yaTermino,
} from '../../api/turnos';
import type { Turno } from '../../api/turnos';
import { FRECUENCIAS, getSeriesRequest, seriesPorTurno } from '../../api/series';
import type { Serie } from '../../api/series';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SerieCard } from '../../components/serieCard/serieCard';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { SerieBadge, TurnoAction, TurnoCard } from '../../components/turnoCard/turnoCard';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Todos los turnos del cliente con su estado: primero los próximos (del más cercano en adelante), para cancelarlos
// o aceptar un cambio de horario, y después los anteriores (del más nuevo al más viejo). Los cancelados y rechazados,
// al final y ocultos detrás de "Ver cancelados".
// La asistencia se confirma solo desde el link opcional del recordatorio (la card muestra si ya avisó).
// (/historial queda para las fichas técnicas)
export const MyTurnos = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const turnos = useFetch(token ? 'mis-turnos' : null, () => getMyTurnosRequest(token!));

  const [canceling, setCanceling] = useState<Turno | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  // Series que armó su profesional (solo para ver) y la fecha ocupada en la que elige otro horario
  const series = useFetch(token ? 'mis-series' : null, () => getSeriesRequest(token!));
  const [eligiendo, setEligiendo] = useState<{ serie: Serie; fecha: string } | null>(null);
  const [verCancelados, setVerCancelados] = useState(false);

  if (!token) return null;

  // Los turnos no traen su serie: se cruzan con las series de la clienta
  const seriePorTurno = seriesPorTurno(series.data ?? []);
  const badgeFor = (turno: Turno) => {
    const serie = seriePorTurno.get(turno.id);
    return serie ? <SerieBadge>{FRECUENCIAS[serie.frecuencia].label}</SerieBadge> : undefined;
  };
  // Las dadas de baja ya no le sirven: quedan sus turnos en la lista
  const seriesVigentes = (series.data ?? []).filter((s) => s.estado !== 'BAJA');
  const hoy = toIsoDate(new Date());

  // Fecha ocupada de una serie activa que todavía no pasó: puede elegir otro horario de ese día
  const fechaActionFor = (serie: Serie) => (fecha: string, turno: unknown) =>
    serie.estado === 'ACTIVA' && !turno && fecha >= hoy ? (
      <TurnoAction variant="positiva" onClick={() => setEligiendo({ serie, fecha })}>
        Elegir horario
      </TurnoAction>
    ) : null;

  const replace = (updated: Turno) => turnos.setData((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  // El back los manda del más nuevo al más viejo: los próximos se dan vuelta para ver primero el más cercano
  const all = turnos.data ?? [];
  // Cancelados y rechazados van aparte y ocultos: los que canceló ella no le sirven, pero si canceló el salón
  // puede querer ver el motivo (el back no dice quién canceló)
  const isClosed = (t: Turno) => t.estado === 'CANCELADO' || t.estado === 'RECHAZADO';
  const activos = all.filter((t) => !isClosed(t));
  const cancelados = all.filter(isClosed);
  const isPast = (t: Turno) => t.estado === 'COMPLETADO' || yaTermino(t);
  const upcoming = activos.filter((t) => !isPast(t)).reverse();
  const past = activos.filter(isPast);

  const acceptReschedule = async (turno: Turno) => {
    setBusyId(turno.id);
    try {
      replace(await acceptRescheduleRequest(token, turno.id));
      toast.success('¡Turno confirmado!', { description: 'Aceptaste el nuevo horario. Te esperamos.' });
    } catch (err) {
      toast.error('No se pudo aceptar el horario', { description: err instanceof ApiError ? err.message : unexpectedError });
    } finally {
      setBusyId(null);
    }
  };

  const confirmCancel = async (motivo: string) => {
    if (!canceling) return;
    setBusyId(canceling.id);
    setActionError('');
    try {
      replace(await cancelTurnoRequest(token, canceling.id, motivo || undefined));
      setCanceling(null);
      toast('Turno cancelado', { description: 'El horario quedó libre. ¡Te esperamos en otra ocasión!' });
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setBusyId(null);
    }
  };

  const actionsFor = (turno: Turno) => {
    const canCancel = clientePuedeCancelar(turno);
    if (turno.estado !== 'REPROGRAMADO' && !canCancel) return undefined;
    return (
      <>
        {turno.estado === 'REPROGRAMADO' && (
          <TurnoAction variant="positiva" disabled={busyId === turno.id} onClick={() => acceptReschedule(turno)}>
            Aceptar horario
          </TurnoAction>
        )}
        {canCancel && (
          <TurnoAction variant="peligro" disabled={busyId === turno.id} onClick={() => setCanceling(turno)}>
            Cancelar
          </TurnoAction>
        )}
      </>
    );
  };

  const noteFor = (turno: Turno) => {
    if (isPast(turno)) return undefined;
    if (turno.estado === 'REPROGRAMADO') {
      return 'El salón te propone este nuevo horario. Si no te queda cómodo, cancelalo y pedí otro.';
    }
    if (turno.estado === 'CONFIRMADO' && !clientePuedeCancelar(turno) && minutosHastaInicio(turno) > 0) {
      return `Faltan menos de ${HORAS_CANCELACION_CLIENTE} horas: para cancelarlo, comunicate con el salón.`;
    }
    if (turno.estado === 'PENDIENTE') {
      return 'Es un servicio que tu profesional evalúa antes de confirmar. Te avisamos por correo.';
    }
    if (turno.estado === 'RECHAZADO') return 'No pudimos atenderte en ese horario. Reservá otro que te quede cómodo.';
    return undefined;
  };

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Mis turnos' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Mis turnos</Title>
            <p className="font-inter text-capilar-grey">Tus turnos y en qué estado está cada uno.</p>
          </div>
          <Button
            onClick={() => navigate('/reservar')}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Reservar turno
          </Button>
        </div>
      </div>

      {turnos.error ? (
        <Alert variant="error" title="No se pudieron cargar tus turnos">
          {turnos.error}
        </Alert>
      ) : turnos.isLoading ? (
        <Loader label="Cargando turnos..." className="py-12" />
      ) : all.length === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">Todavía no tenés turnos. ¡Reservá el tuyo!</p>
      ) : (
        <>
          <div className="flex flex-col gap-4">
            <h2 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">Próximos</h2>
            {upcoming.length === 0 ? (
              <p className="font-inter text-sm text-capilar-grey">No tenés turnos próximos.</p>
            ) : (
              upcoming.map((turno) => (
                <TurnoCard
                  key={turno.id}
                  turno={turno}
                  paraCliente
                  actions={actionsFor(turno)}
                  note={noteFor(turno)}
                  badge={badgeFor(turno)}
                />
              ))
            )}
          </div>

          {seriesVigentes.length > 0 && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                <h2 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">Turnos que se repiten</h2>
                <p className="font-inter text-sm text-capilar-grey">
                  Los arma tu profesional. Si una fecha estaba ocupada a tu horario, podés elegir otro horario de ese día.
                </p>
              </div>
              {seriesVigentes.map((serie) => (
                <SerieCard key={serie.id} serie={serie} paraCliente fechaAction={fechaActionFor(serie)} />
              ))}
            </div>
          )}

          {past.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">Anteriores</h2>
              {past.map((turno) => (
                <TurnoCard key={turno.id} turno={turno} paraCliente badge={badgeFor(turno)} />
              ))}
            </div>
          )}

          {cancelados.length > 0 && (
            <div className="flex flex-col gap-4">
              <button
                type="button"
                onClick={() => setVerCancelados(!verCancelados)}
                aria-expanded={verCancelados}
                className="self-start font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-capilar-violet"
              >
                {verCancelados ? 'Ocultar cancelados' : `Ver cancelados (${cancelados.length})`}
              </button>
              {verCancelados &&
                cancelados.map((turno) => (
                  <TurnoCard key={turno.id} turno={turno} paraCliente badge={badgeFor(turno)} note={noteFor(turno)} />
                ))}
            </div>
          )}
        </>
      )}

      <Modal isOpen={eligiendo !== null} onClose={() => setEligiendo(null)} ariaLabel="Elegir otro horario" className="max-w-3xl!">
        {eligiendo && (
          <SerieDateForm
            token={token}
            serie={eligiendo.serie}
            fecha={eligiendo.fecha}
            onCancel={() => setEligiendo(null)}
            onBooked={() => {
              setEligiendo(null);
              turnos.reload();
              series.reload();
              toast.success('¡Turno confirmado!', { description: 'Quedó dentro de tu serie. Te esperamos.' });
            }}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={canceling !== null}
        onClose={() => {
          setCanceling(null);
          setActionError('');
        }}
        title="Cancelar turno"
        confirmLabel="Cancelar turno"
        onConfirm={confirmCancel}
        isLoading={busyId !== null}
        error={actionError}
        reason={{ label: 'Motivo', placeholder: 'Ej.: me surgió un imprevisto', hint: 'Se lo contamos a tu profesional.' }}
      >
        ¿Seguro que querés cancelar tu turno? El horario va a quedar libre para otra persona.
      </ConfirmDialog>
    </section>
  );
};

interface SerieDateFormProps {
  token: string;
  serie: Serie;
  // Fecha de la serie que estaba ocupada a su horario
  fecha: string;
  onCancel: () => void;
  onBooked: () => void;
}

// Elegir otro horario libre en una fecha ocupada de la serie: mismo servicio y profesional, queda confirmado
const SerieDateForm = ({ token, serie, fecha, onCancel, onBooked }: SerieDateFormProps) => {
  const [slot, setSlot] = useState<Slot>({ fecha, hora: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const items = [{ servicioId: serie.servicioId, legajo: serie.legajo }];

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await createTurnoRequest(token, { fecha, horaInicio: slot.hora, items, serieId: serie.id });
      onBooked();
    } catch (err) {
      setError(err instanceof ApiError ? err.message : unexpectedError);
      setSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Elegir otro horario</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {serie.servicio} con {serie.profesional} · <span className="first-letter:uppercase">{formatFechaLarga(fecha)}</span>. A tu horario de
          siempre ({serie.horaInicio}) estaba ocupado: elegí otro de ese día.
        </p>
      </div>

      {/* Solo se puede elegir la fecha de la serie */}
      <SlotPicker token={token} items={items} workDates={[fecha]} value={slot} onChange={(next) => setSlot({ fecha, hora: next.hora })} />

      {error && (
        <p role="alert" className="text-center font-inter text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="grey" onClick={onCancel} disabled={saving} className="flex-1 py-2 text-sm uppercase">
          Volver
        </Button>
        <Button
          onClick={save}
          disabled={saving || !slot.hora}
          className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'Reservando...' : 'Confirmar turno'}
        </Button>
      </div>
    </div>
  );
};
