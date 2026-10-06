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
  minutosHastaInicio,
  yaTermino,
} from '../../api/turnos';
import type { Turno } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { TurnoAction, TurnoCard } from '../../components/turnoCard/turnoCard';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Todos los turnos del cliente con su estado: primero los próximos (del más cercano en adelante), para cancelarlos
// o aceptar un cambio de horario, y después los anteriores (del más nuevo al más viejo).
// (/historial queda para las fichas técnicas)
export const MyTurnos = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const turnos = useFetch(token ? 'mis-turnos' : null, () => getMyTurnosRequest(token!));

  const [canceling, setCanceling] = useState<Turno | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  if (!token) return null;

  const replace = (updated: Turno) => turnos.setData((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  // El back los manda del más nuevo al más viejo: los próximos se dan vuelta para ver primero el más cercano
  const all = turnos.data ?? [];
  const isPast = (t: Turno) => t.estado === 'COMPLETADO' || yaTermino(t);
  const upcoming = all.filter((t) => !isPast(t)).reverse();
  const past = all.filter(isPast);

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
            className="shrink-0 self-start px-6 py-3 text-white! font-bold! uppercase tracking-wider md:self-auto"
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
                <TurnoCard key={turno.id} turno={turno} paraCliente actions={actionsFor(turno)} note={noteFor(turno)} />
              ))
            )}
          </div>

          {past.length > 0 && (
            <div className="flex flex-col gap-4">
              <h2 className="font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">Anteriores</h2>
              {past.map((turno) => (
                <TurnoCard key={turno.id} turno={turno} paraCliente />
              ))}
            </div>
          )}
        </>
      )}

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
