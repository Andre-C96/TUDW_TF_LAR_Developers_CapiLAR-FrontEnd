import { useState } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  createFichaRequest,
  deleteFichaPhotoRequest,
  deleteFichaRequest,
  getClientFichasRequest,
  getDiagnosticoRequest,
  getFichaRequest,
  puedeCargarFicha,
  updateFichaRequest,
  uploadFichaPhotoRequest,
} from '../../api/fichas';
import type { Ficha, FichaData, FotoFicha, MomentoFoto, SugerenciaDiagnostico } from '../../api/fichas';
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

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

type Pestania = 'ficha' | 'fotos' | 'historial';

// Los 5 campos del diagnóstico que trajo la IA; los que no pudo ver quedan como están guardados
const camposSugeridos = ({ porosidad, elasticidad, porcentajeCanas, tipoDePelo, volumenDePelo }: SugerenciaDiagnostico) =>
  Object.fromEntries(
    Object.entries({ porosidad, elasticidad, porcentajeCanas, tipoDePelo, volumenDePelo }).filter(([, valor]) => valor !== undefined),
  ) as Partial<Ficha>;

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
// y la edita hasta que lo completa; después (o si es de otro profesional) queda de solo lectura.
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

  // Sugerencia de la IA (TP3 · API 3): precarga el formulario sin guardar. Cada cambio de `version`
  // reinicia el FichaForm, que toma los valores iniciales de la ficha que recibe
  const [sugerencia, setSugerencia] = useState<SugerenciaDiagnostico | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [version, setVersion] = useState(0);

  const esSuyo = detalle.legajo === legajo;
  const editable = esSuyo && (ficha ? !ficha.cerradaEn : puedeCargarFicha(turno, detalle));
  const tieneFotoAntes = !!ficha?.fotos.some((foto) => foto.tipo === 'ANTES');

  const close = () => {
    if (!saving) onClose();
  };

  const save = async (data: FichaData) => {
    setSaving(true);
    setFormError('');
    try {
      if (ficha) {
        setLocal(await updateFichaRequest(token, ficha.id, data));
        // Lo sugerido ya quedó guardado (o corregido por la profesional)
        setSugerencia(null);
        toast.success('Ficha guardada');
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

  // La IA analiza la última foto de ANTES; el back no guarda nada
  const sugerir = async () => {
    if (!ficha) return;
    setSugiriendo(true);
    try {
      setSugerencia(await getDiagnosticoRequest(token, ficha.id));
      setVersion((v) => v + 1);
    } catch (err) {
      toast.error('No se pudo pedir la sugerencia', { description: errorMessage(err) });
    } finally {
      setSugiriendo(false);
    }
  };

  // Vuelve el formulario a los valores guardados
  const descartarSugerencia = () => {
    setSugerencia(null);
    setVersion((v) => v + 1);
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
          {turno.cliente.alergia && (
            <span className="self-start rounded-md bg-amber-50 px-2 py-1 font-inter text-xs text-amber-800">
              Alergias: {turno.cliente.alergia}
            </span>
          )}
        </div>

        <div role="tablist" aria-label="Secciones de la ficha" className="flex flex-wrap gap-2">
          {pestanias.map(([value, label]) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={pestania === value}
              onClick={() => {
                setPestania(value);
                if (value === 'historial') setVerHistorial(true);
              }}
              className={`rounded-full px-4 py-2 font-inter text-sm font-medium transition-colors ${
                pestania === value ? 'bg-capilar-peach/75 text-black' : 'bg-gray-50 text-capilar-grey hover:text-capilar-violet'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

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
            <div className="flex flex-col gap-4">
              {anteriores.map((anterior) => (
                <FichaTecnica key={anterior.id} token={token} ficha={anterior} />
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
          <div className="flex flex-col gap-4">
            {ficha &&
              (sugerencia ? (
                <Alert
                  variant="info"
                  title={
                    <span className="flex flex-wrap items-center gap-2">
                      Sugerencia de IA: revisala antes de guardar.
                      {sugerencia.simulado && (
                        <span className="rounded-md bg-white px-2 py-0.5 text-xs font-medium">Modo prueba</span>
                      )}
                    </span>
                  }
                >
                  {sugerencia.observaciones && <p>{sugerencia.observaciones}</p>}
                  <button
                    type="button"
                    onClick={descartarSugerencia}
                    disabled={saving}
                    className="mt-2 font-medium underline underline-offset-2 hover:opacity-80 disabled:opacity-60"
                  >
                    Descartar sugerencia
                  </button>
                </Alert>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button
                    variant="secundario"
                    onClick={sugerir}
                    disabled={!tieneFotoAntes || sugiriendo || saving}
                    className={`text-sm ${tieneFotoAntes ? '' : 'opacity-50'}`}
                  >
                    {sugiriendo ? 'Analizando la foto...' : '✨ Sugerir con IA'}
                  </Button>
                  <p className="font-inter text-xs text-capilar-grey">
                    {tieneFotoAntes
                      ? 'Precarga el diagnóstico con la última foto de antes. Lo revisás y lo guardás vos.'
                      : 'Subí una foto de antes en la pestaña Fotos.'}
                  </p>
                </div>
              ))}
            <FichaForm
              key={`${ficha?.id ?? 'nueva'}-${version}`}
              ficha={ficha && sugerencia ? { ...ficha, ...camposSugeridos(sugerencia) } : ficha}
              onSubmit={save}
              onCancel={close}
              onDelete={ficha ? () => setConfirmDelete(true) : undefined}
              isLoading={saving || sugiriendo}
              error={formError}
            />
          </div>
        ) : ficha ? (
          <div className="flex flex-col gap-6">
            <p className="rounded-md bg-gray-50 px-3 py-2 font-inter text-xs text-capilar-grey">
              {ficha.cerradaEn
                ? 'La ficha se cerró al completar el turno: ya no se puede editar.'
                : `La carga ${ficha.profesional}: la ves en modo lectura.`}
            </p>
            <FichaDatos ficha={ficha} />
          </div>
        ) : (
          <p className="py-8 text-center font-inter text-sm text-capilar-grey">Este servicio no tiene ficha.</p>
        )}
      </div>
    </Modal>
  );
};
