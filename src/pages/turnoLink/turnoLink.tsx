import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ApiError } from '../../api/client';
import {
  HORAS_CANCELACION_CLIENTE,
  cancelTurnoByLinkRequest,
  confirmAttendanceByLinkRequest,
  getTurnoByLinkRequest,
} from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { TurnoCard } from '../../components/turnoCard/turnoCard';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

interface TurnoLinkProps {
  // Botón del recordatorio que abrió la página
  accion: 'confirmar' | 'cancelar';
}

// Destino de los botones del recordatorio de 24 h: /turno/confirmar?token= y /turno/cancelar?token=.
// Públicas (el token del mail identifica el turno): muestran el turno y confirman la asistencia o lo cancelan.
// Cancelar se oculta si faltan menos de 12 h (puedeCancelar: false).
export const TurnoLink = ({ accion }: TurnoLinkProps) => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const turno = useFetch(token ? `turno-enlace-${token}` : null, () => getTurnoByLinkRequest(token!));

  const [done, setDone] = useState<'confirmado' | 'cancelado' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionError, setActionError] = useState('');
  const [isCancelOpen, setIsCancelOpen] = useState(false);

  const confirm = async () => {
    if (!token) return;
    setIsSaving(true);
    setActionError('');
    try {
      const updated = await confirmAttendanceByLinkRequest(token);
      turno.setData((prev) => ({ ...prev, ...updated }));
      setDone('confirmado');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const cancel = async (motivo: string) => {
    if (!token) return;
    setIsSaving(true);
    setActionError('');
    try {
      const updated = await cancelTurnoByLinkRequest(token, motivo || undefined);
      turno.setData((prev) => ({ ...prev, ...updated }));
      setIsCancelOpen(false);
      setDone('cancelado');
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const data = turno.data;
  const yaConfirmado = !!data?.asistenciaConfirmadaEn;

  return (
    <div className="flex w-full max-w-2xl flex-col gap-6 rounded-[6px] bg-white p-6 shadow-md md:p-8">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{accion === 'confirmar' ? 'Confirmar asistencia' : 'Cancelar turno'}</Title>
        {!done && data && (
          <p className="font-inter text-sm text-capilar-grey">
            {accion === 'confirmar'
              ? 'Avisale a tu profesional que vas a ir.'
              : 'Si no podés ir, cancelalo así el horario queda libre para otra persona.'}
          </p>
        )}
      </div>

      {!token ? (
        <Alert variant="error" title="Enlace no válido">
          Abrí el enlace completo del correo o revisá tus turnos en la app.
        </Alert>
      ) : turno.error ? (
        <Alert variant="error" title="No pudimos abrir el turno">
          {turno.error}
        </Alert>
      ) : !data ? (
        <Loader label="Buscando tu turno..." className="py-6" />
      ) : (
        <>
          <TurnoCard turno={data} paraCliente />

          {done === 'confirmado' && (
            <Alert variant="exito" title="¡Gracias por avisar!">
              Tu profesional ya sabe que vas. Te esperamos.
            </Alert>
          )}
          {done === 'cancelado' && (
            <Alert variant="info" title="Turno cancelado">
              El horario quedó libre. ¡Te esperamos en otra ocasión!
            </Alert>
          )}

          {!done && actionError && !isCancelOpen && (
            <p role="alert" className="text-center font-inter text-sm text-red-500">
              {actionError}
            </p>
          )}

          {!done && accion === 'confirmar' && (
            <div className="flex flex-col items-center gap-3">
              {yaConfirmado ? (
                <p className="font-inter text-sm text-capilar-grey">Ya nos avisaste que vas. ¡Te esperamos!</p>
              ) : (
                <Button
                  onClick={confirm}
                  disabled={isSaving}
                  className="w-full py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto sm:px-10"
                >
                  {isSaving ? 'Confirmando...' : 'Voy a ir'}
                </Button>
              )}
              {data.puedeCancelar && (
                <Link
                  to={`/turno/cancelar?${new URLSearchParams({ token })}`}
                  className="font-inter text-sm font-semibold text-capilar-violet hover:underline"
                >
                  ¿No podés ir? Cancelar turno
                </Link>
              )}
            </div>
          )}

          {!done && accion === 'cancelar' && (
            <div className="flex flex-col items-center gap-3">
              {data.puedeCancelar ? (
                <Button
                  onClick={() => setIsCancelOpen(true)}
                  className="w-full py-3 text-white! font-bold! uppercase tracking-wider sm:w-auto sm:px-10"
                >
                  Cancelar turno
                </Button>
              ) : (
                <Alert variant="advertencia" title="Ya no se puede cancelar desde acá">
                  Faltan menos de {HORAS_CANCELACION_CLIENTE} horas para tu turno: para cancelarlo, comunicate con el salón.
                </Alert>
              )}
              {!yaConfirmado && (
                <Link
                  to={`/turno/confirmar?${new URLSearchParams({ token })}`}
                  className="font-inter text-sm font-semibold text-capilar-violet hover:underline"
                >
                  Prefiero confirmar que voy
                </Link>
              )}
            </div>
          )}
        </>
      )}

      <ConfirmDialog
        isOpen={isCancelOpen}
        onClose={() => {
          setIsCancelOpen(false);
          setActionError('');
        }}
        title="Cancelar turno"
        confirmLabel="Cancelar turno"
        onConfirm={cancel}
        isLoading={isSaving}
        error={actionError}
        reason={{ label: 'Motivo', placeholder: 'Ej.: me surgió un imprevisto', hint: 'Se lo contamos a tu profesional.' }}
      >
        ¿Seguro que querés cancelar tu turno? El horario va a quedar libre para otra persona.
      </ConfirmDialog>
    </div>
  );
};
