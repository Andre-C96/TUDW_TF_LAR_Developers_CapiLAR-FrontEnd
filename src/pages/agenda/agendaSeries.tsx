import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { describeSerie, endSerieRequest, getSeriesRequest, reactivateSerieRequest, suspendSerieRequest } from '../../api/series';
import type { Serie } from '../../api/series';
import { Alert } from '../../components/alert/alert';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { SerieCard } from '../../components/serieCard/serieCard';
import { TurnoAction } from '../../components/turnoCard/turnoCard';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

type Pending = { type: 'suspender' | 'baja'; serie: Serie };

const dialogTexts = {
  suspender: {
    title: 'Suspender serie',
    text: 'Se cancelan los turnos de la serie que todavía no empezaron y le avisamos al cliente. Después la podés reactivar.',
    confirm: 'Suspender',
  },
  baja: {
    title: 'Dar de baja la serie',
    text: 'Se cancelan los turnos de la serie que todavía no empezaron y le avisamos al cliente. No se puede deshacer.',
    confirm: 'Dar de baja',
  },
};

// Pestaña Series de la agenda: las series que gestiona el profesional (se crean con "Repetir" en un turno confirmado).
// Solo activas y suspendidas: al dar de baja una serie, sale de la lista.
export const AgendaSeries = ({ token }: { token: string }) => {
  const series = useFetch('series', () => getSeriesRequest(token));
  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');

  // Una serie dada de baja sale de la lista
  const replace = (updated: Serie) =>
    series.setData((prev) => prev.map((s) => (s.id === updated.id ? updated : s)).filter((s) => s.estado !== 'BAJA'));

  const run = async (serie: Serie, request: () => Promise<Serie>, success: string, description: string) => {
    setBusyId(serie.id);
    setActionError('');
    try {
      replace(await request());
      setPending(null);
      toast.success(success, { description });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : unexpectedError;
      if (pending) setActionError(message);
      else toast.error('No se pudo actualizar la serie', { description: message });
    } finally {
      setBusyId(null);
    }
  };

  const confirm = (motivo: string) => {
    if (!pending) return;
    const { serie, type } = pending;
    if (type === 'suspender') {
      return run(serie, () => suspendSerieRequest(token, serie.id, motivo || undefined), 'Serie suspendida', 'Cancelamos los próximos turnos y le avisamos al cliente.');
    }
    return run(serie, () => endSerieRequest(token, serie.id, motivo || undefined), 'Serie dada de baja', 'Cancelamos los próximos turnos y le avisamos al cliente.');
  };

  const actionsFor = (serie: Serie) => {
    if (serie.estado === 'BAJA') return undefined;
    const busy = busyId === serie.id;
    return (
      <>
        {serie.estado === 'ACTIVA' ? (
          <TurnoAction disabled={busy} onClick={() => setPending({ type: 'suspender', serie })}>
            Suspender
          </TurnoAction>
        ) : (
          <TurnoAction
            variant="positiva"
            disabled={busy}
            onClick={() =>
              run(serie, () => reactivateSerieRequest(token, serie.id), 'Serie reactivada', 'Volvimos a reservar las próximas fechas y le avisamos al cliente.')
            }
          >
            Reactivar
          </TurnoAction>
        )}
        <TurnoAction variant="peligro" disabled={busy} onClick={() => setPending({ type: 'baja', serie })}>
          Dar de baja
        </TurnoAction>
      </>
    );
  };

  // De la más nueva a la más vieja; las dadas de baja no se muestran (sus turnos siguen en la agenda)
  const ordenadas = (series.data ?? []).filter((s) => s.estado !== 'BAJA');
  const texts = pending ? dialogTexts[pending.type] : null;

  return (
    <div className="flex flex-col gap-6">
      <p className="font-inter text-sm text-capilar-grey">
        Para crear una serie, tocá <span className="font-semibold">Repetir</span> en un turno confirmado de la pestaña Turnos.
      </p>

      {series.error ? (
        <Alert variant="error" title="No se pudieron cargar las series">
          {series.error}
        </Alert>
      ) : series.isLoading ? (
        <Loader label="Cargando series..." className="py-12" />
      ) : ordenadas.length === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">Todavía no tenés turnos que se repitan.</p>
      ) : (
        ordenadas.map((serie) => <SerieCard key={serie.id} serie={serie} actions={actionsFor(serie)} />)
      )}

      {texts && pending && (
        <ConfirmDialog
          isOpen
          onClose={() => {
            setPending(null);
            setActionError('');
          }}
          title={texts.title}
          confirmLabel={texts.confirm}
          onConfirm={confirm}
          isLoading={busyId !== null}
          error={actionError}
          reason={{ label: 'Motivo', placeholder: 'Ej.: me voy de vacaciones', hint: 'Opcional. Se lo enviamos al cliente en el aviso.', maxLength: 500 }}
        >
          <p>{texts.text}</p>
          <p className="mt-2 font-semibold text-black">
            {pending.serie.cliente.nombre} {pending.serie.cliente.apellido} · {pending.serie.servicio}, {describeSerie(pending.serie)}
          </p>
        </ConfirmDialog>
      )}
    </div>
  );
};
