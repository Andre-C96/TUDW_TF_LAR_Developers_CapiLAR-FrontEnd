import { useState } from 'react';
import { toast } from 'sonner';
import { formatAlergias } from '../../api/alergias';
import { getArticulosSalonRequest } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { datosParaGuardar } from '../../api/fichaCambios';
import {
  createFichaRequest,
  deleteFichaPhotoRequest,
  deleteFichaRequest,
  getClientFichasRequest,
  getFichaRequest,
  puedeCargarFicha,
  updateFichaRequest,
  uploadFichaPhotoRequest,
} from '../../api/fichas';
import type { Ficha, FichaData, FotoFicha, MomentoFoto } from '../../api/fichas';
import { formatFechaLarga } from '../../api/turnos';
import type { Turno, TurnoDetalle } from '../../api/turnos';
import { validateFoto } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { FichaForm } from '../../components/fichaForm/fichaForm';
import { FichaDatos, FichaGaleria, FichaTecnica } from '../../components/fichaTecnica/fichaTecnica';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { avisarSinStock } from './fichaAvisos';
import { FichaEditModal } from './fichaEditModal';
import { FichaTabs } from './fichaTabs';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

type Pestania = 'ficha' | 'fotos' | 'historial';

interface FichaModalProps {
  token: string;
  // El profesional logueado: solo edita la ficha de sus servicios
  legajo: number;
  turno: Turno;
  detalle: TurnoDetalle;
  onClose: () => void;
  // Se creó (id) o se quitó (null) la ficha: la agenda actualiza el turno
  onFichaChange: (fichaId: number | null) => void;
}

// Ficha técnica de un servicio del turno. El profesional de ese servicio la carga mientras el turno está CONFIRMADO
// y la puede seguir editando después de completarlo; si es de otro profesional, queda de solo lectura.
// Las fotos se suben una vez guardada la ficha. El historial muestra las fichas anteriores de la clienta.
export const FichaModal = ({ token, legajo, turno, detalle, onClose, onFichaChange }: FichaModalProps) => {
  const [pestania, setPestania] = useState<Pestania>('ficha');
  // La ficha que había al abrir; lo que se guarda después queda en `local` (undefined: usar la pedida)
  const [inicialId] = useState(detalle.fichaId ?? null);
  const fetched = useFetch(inicialId ? `ficha-${inicialId}` : null, () => getFichaRequest(token, inicialId!));
  const [local, setLocal] = useState<Ficha | null | undefined>(undefined);
  const ficha = local !== undefined ? local : fetched.data;

  // El historial se pide la primera vez que se abre su pestaña
  const [verHistorial, setVerHistorial] = useState(false);
  const historial = useFetch(verHistorial ? `fichas-cliente-${turno.cliente.id}` : null, () =>
    getClientFichasRequest(token, turno.cliente.id),
  );

  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [confirmDelete, setConfirmDelete] = useState(false);
  // Ficha del historial que se está editando, encima de este modal
  const [editando, setEditando] = useState<Ficha | null>(null);

  const esSuyo = detalle.legajo === legajo;
  const editable = esSuyo && (ficha ? true : puedeCargarFicha(turno, detalle));
  // Los productos de las fórmulas se eligen del stock
  const articulos = useFetch(editable ? 'articulos-salon' : null, () => getArticulosSalonRequest(token));

  // Con la edición abierta encima, Escape solo cierra esa
  const close = () => {
    if (!saving && !editando) onClose();
  };

  const save = async (data: FichaData) => {
    setSaving(true);
    setFormError('');
    try {
      if (ficha) {
        const { sinStock, ...actualizada } = await updateFichaRequest(token, ficha.id, datosParaGuardar(ficha, data));
        setLocal(actualizada);
        toast.success('Ficha guardada');
        avisarSinStock(sinStock);
      } else {
        const nueva = await createFichaRequest(token, turno.id, detalle.id, data);
        setLocal(nueva);
        onFichaChange(nueva.id);
        toast.success('Ficha guardada', { description: 'Ya podés sumar las fotos de antes y después.' });
      }
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!ficha) return;
    setSaving(true);
    try {
      await deleteFichaRequest(token, ficha.id);
      setLocal(null);
      setConfirmDelete(false);
      onFichaChange(null);
      toast('Ficha quitada');
    } catch (err) {
      toast.error('No se pudo quitar la ficha', { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  // Fotos: cada cambio devuelve la ficha actualizada
  const changePhotos = async (request: () => Promise<Ficha>, fallo: string) => {
    setSaving(true);
    try {
      setLocal(await request());
    } catch (err) {
      toast.error(fallo, { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = (tipo: MomentoFoto, file: File) => {
    const invalid = validateFoto(file);
    if (invalid) {
      toast.error('No se pudo subir la foto', { description: invalid });
      return;
    }
    if (ficha) changePhotos(() => uploadFichaPhotoRequest(token, ficha.id, tipo, file), 'No se pudo subir la foto');
  };

  const removePhoto = (foto: FotoFicha) => {
    if (ficha) changePhotos(() => deleteFichaPhotoRequest(token, ficha.id, foto.id), 'No se pudo quitar la foto');
  };

  const anteriores = (historial.data ?? []).filter((f) => f.id !== ficha?.id);
  const cargando = inicialId !== null && local === undefined && fetched.isLoading;

  const pestanias: [Pestania, string][] = [
    ['ficha', 'Ficha'],
    ['fotos', ficha ? `Fotos (${ficha.fotos.length})` : 'Fotos'],
    ['historial', 'Historial de la clienta'],
  ];

  return (
    <>
      <Modal isOpen onClose={close} ariaLabel="Ficha técnica" className="max-w-3xl!">
        <div className="flex flex-col gap-6">
          <div className="flex flex-col gap-2 pr-6">
            <Title as="h2">Ficha técnica</Title>
            <p className="font-inter text-sm text-capilar-grey">
              <span className="font-semibold text-black">
                {turno.cliente.nombre} {turno.cliente.apellido}
              </span>{' '}
              · {detalle.servicio} · <span className="first-letter:uppercase">{formatFechaLarga(turno.fecha)}</span>, {detalle.horaInicio}
            </p>
            {formatAlergias(turno.cliente) && (
              <span className="self-start rounded-md bg-amber-50 px-2 py-1 font-inter text-xs text-amber-800">
                Alergias: {formatAlergias(turno.cliente)}
              </span>
            )}
          </div>

          <FichaTabs
            tabs={pestanias}
            value={pestania}
            onChange={(value) => {
              setPestania(value);
              if (value === 'historial') setVerHistorial(true);
            }}
          />

          {pestania === 'historial' ? (
            historial.error ? (
              <Alert variant="error" title="No se pudo cargar el historial">
                {historial.error}
              </Alert>
            ) : historial.isLoading ? (
              <Loader label="Cargando historial..." className="py-8" />
            ) : anteriores.length === 0 ? (
              <p className="py-8 text-center font-inter text-sm text-capilar-grey">Es la primera ficha de esta clienta.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {anteriores.map((anterior) => (
                  <FichaTecnica key={anterior.id} token={token} ficha={anterior} onEditar={anterior.legajo === legajo ? () => setEditando(anterior) : undefined} />
                ))}
              </div>
            )
          ) : fetched.error && local === undefined ? (
            <Alert variant="error" title="No se pudo cargar la ficha">
              {fetched.error}
            </Alert>
          ) : cargando ? (
            <Loader label="Cargando ficha..." className="py-8" />
          ) : pestania === 'fotos' ? (
            ficha ? (
              <FichaGaleria
                token={token}
                fichaId={ficha.id}
                fotos={ficha.fotos}
                onAdd={editable ? addPhoto : undefined}
                onRemove={editable ? removePhoto : undefined}
                busy={saving}
              />
            ) : (
              <p className="py-8 text-center font-inter text-sm text-capilar-grey">
                {editable ? 'Guardá la ficha para sumar las fotos de antes y después.' : 'Este servicio no tiene ficha.'}
              </p>
            )
          ) : confirmDelete ? (
            <div className="flex flex-col gap-4 rounded-[6px] border border-red-200 bg-red-50 p-5 font-inter text-sm">
              <p className="text-black">¿Quitar esta ficha? Se pierden los datos, las fórmulas y las fotos que cargaste.</p>
              <div className="flex justify-end gap-3">
                <Button variant="grey" onClick={() => setConfirmDelete(false)} disabled={saving} className="px-5 py-2 text-xs uppercase">
                  Volver
                </Button>
                <button
                  type="button"
                  onClick={remove}
                  disabled={saving}
                  className="rounded-lg bg-red-500 px-5 py-2 font-inter text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-red-600 disabled:opacity-60"
                >
                  {saving ? 'Quitando...' : 'Quitar ficha'}
                </button>
              </div>
            </div>
          ) : editable ? (
            <FichaForm
              key={ficha?.id ?? 'nueva'}
              ficha={ficha}
              articulos={articulos.data ?? []}
              articulosError={articulos.error}
              onSubmit={save}
              onCancel={close}
              onDelete={ficha && !ficha.cerradaEn ? () => setConfirmDelete(true) : undefined}
              isLoading={saving}
              error={formError}
            />
          ) : ficha ? (
            <div className="flex flex-col gap-6">
              <p className="rounded-md bg-gray-50 px-3 py-2 font-inter text-xs text-capilar-grey">La cargó {ficha.profesional}: la ves en modo lectura.</p>
              <FichaDatos ficha={ficha} />
            </div>
          ) : (
            <p className="py-8 text-center font-inter text-sm text-capilar-grey">Este servicio no tiene ficha.</p>
          )}
        </div>
      </Modal>
      {editando && (
        <FichaEditModal
          token={token}
          ficha={editando}
          onClose={() => setEditando(null)}
          onSaved={(actualizada) => historial.setData((prev) => prev.map((f) => (f.id === actualizada.id ? actualizada : f)))}
        />
      )}
    </>
  );
};
