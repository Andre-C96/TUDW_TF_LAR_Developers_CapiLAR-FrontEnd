import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { formatAlergias } from '../../api/alergias';
import { getArticulosSalonRequest } from '../../api/articulos';
import type { Articulo } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { datosParaGuardar } from '../../api/fichaCambios';
import {
  analisisComoTexto,
  createFichaRequest,
  deleteFichaPhotoRequest,
  deleteFichaRequest,
  getClientFichasRequest,
  getFichaRequest,
  getUltimoDiagnosticoRequest,
  puedeCargarFicha,
  sugerirFichaRequest,
  tieneDiagnostico,
  updateFichaRequest,
  uploadFichaPhotoRequest,
} from '../../api/fichas';
import type { Ficha, FichaData, FotoFicha, MomentoFoto, SugerenciaIA } from '../../api/fichas';
import { formatFechaLarga, fromIsoDate } from '../../api/turnos';
import type { Turno, TurnoDetalle } from '../../api/turnos';
import { validateFoto } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { FichaForm } from '../../components/fichaForm/fichaForm';
import type { FichaBorrador, FichaFormHandle } from '../../components/fichaForm/fichaForm';
import { FichaDatos, FichaGaleria, FichaTecnica } from '../../components/fichaTecnica/fichaTecnica';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SugerenciaIACard } from '../../components/sugerenciaIA/sugerenciaIA';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { avisarSinStock } from './fichaAvisos';
import { FichaEditModal } from './fichaEditModal';
import { Tabs } from '../../components/tabs/tabs';
import { NuevoArticuloModal } from './nuevoArticuloModal';

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
  // Artículo que se está creando desde un producto de la fórmula, encima de este modal
  const [nuevoArticulo, setNuevoArticulo] = useState<{ nombre: string; elegir: (articulo: Articulo) => void } | null>(null);

  const esSuyo = detalle.legajo === legajo;
  const editable = esSuyo && (ficha ? true : puedeCargarFicha(turno, detalle));
  // Los productos de las fórmulas se eligen del stock
  const articulos = useFetch(editable ? 'articulos-salon' : null, () => getArticulosSalonRequest(token));

  // Ficha nueva: arranca con el diagnóstico de la última ficha cerrada de la clienta (sin IA, al instante).
  // Si falla, arranca vacía
  const ultimo = useFetch(inicialId === null && esSuyo && puedeCargarFicha(turno, detalle) ? `ultimo-diagnostico-${turno.cliente.id}` : null, () =>
    getUltimoDiagnosticoRequest(token, turno.cliente.id),
  );
  const [anteriorDescartado, setAnteriorDescartado] = useState(false);
  const anterior = !anteriorDescartado && ultimo.data && tieneDiagnostico(ultimo.data) ? ultimo.data : null;

  // F14/F15: el formulario guarda su estado adentro; la IA lo lee y lo completa con este ref
  const formRef = useRef<FichaFormHandle>(null);
  // La última sugerencia y el formulario de antes de aplicarla (para descartarla; null después de guardar)
  const [sugerencia, setSugerencia] = useState<SugerenciaIA | null>(null);
  const [formulasSugeridas, setFormulasSugeridas] = useState(0);
  const [antesDeSugerencia, setAntesDeSugerencia] = useState<FichaBorrador | null>(null);
  const [sugiriendo, setSugiriendo] = useState(false);
  const [iaError, setIaError] = useState('');
  // Sugerencia con fórmulas que espera la respuesta: ¿reemplazan a las ya cargadas?
  const [preguntaFormulas, setPreguntaFormulas] = useState<SugerenciaIA | null>(null);
  // F15: las alertas se muestran otra vez al guardar, una sola vez por sugerencia
  const [alertasVistas, setAlertasVistas] = useState(false);
  const [guardarConAlertas, setGuardarConAlertas] = useState<FichaData | null>(null);

  // Con otro modal abierto encima, Escape solo cierra ese
  const close = () => {
    if (!saving && !editando && !nuevoArticulo && !preguntaFormulas && !guardarConAlertas) onClose();
  };

  const guardar = async (data: FichaData): Promise<Ficha | null> => {
    setSaving(true);
    setFormError('');
    try {
      let guardada: Ficha;
      if (ficha) {
        const { sinStock, ...actualizada } = await updateFichaRequest(token, ficha.id, datosParaGuardar(ficha, data));
        guardada = actualizada;
        toast.success('Ficha guardada');
        avisarSinStock(sinStock);
      } else {
        guardada = await createFichaRequest(token, turno.id, detalle.id, data);
        onFichaChange(guardada.id);
        toast.success('Ficha guardada', { description: 'Ya podés sumar las fotos de antes y después.' });
      }
      setLocal(guardada);
      // Lo sugerido ya quedó guardado: no hay a qué volver
      setAntesDeSugerencia(null);
      return guardada;
    } catch (err) {
      setFormError(errorMessage(err));
      return null;
    } finally {
      setSaving(false);
    }
  };

  // F15: si la IA marcó alertas, se muestran otra vez antes de guardar (advertencia antes de confirmar la ficha)
  const save = (data: FichaData) => {
    if ((sugerencia?.analisis.alertas.length ?? 0) > 0 && !alertasVistas) setGuardarConAlertas(data);
    else guardar(data);
  };

  const confirmarAlertas = () => {
    if (!guardarConAlertas) return;
    setAlertasVistas(true);
    guardar(guardarConAlertas).then(() => setGuardarConAlertas(null));
  };

  // Precarga lo sugerido sin guardar: los campos de diagnóstico que vinieron y, si se pide, las fórmulas
  const aplicarSugerencia = (nueva: SugerenciaIA, reemplazarFormulas: boolean) => {
    const form = formRef.current;
    if (!form) return;
    // Con una sugerencia anterior sin guardar, "Descartar" vuelve a lo de antes de la primera
    setAntesDeSugerencia((prev) => prev ?? form.getBorrador());
    form.aplicarSugerencia(nueva, reemplazarFormulas);
    setSugerencia(nueva);
    setFormulasSugeridas(reemplazarFormulas ? nueva.formulas.length : 0);
    setAlertasVistas(false);
    // El aviso de la ficha anterior ya no corresponde: el diagnóstico ahora es el de la IA
    setAnteriorDescartado(true);
  };

  // La IA trabaja con la ficha guardada: si todavía no existe, primero se guarda con lo cargado (como con las fotos)
  const sugerir = async () => {
    setIaError('');
    let objetivo = ficha;
    if (!objetivo) {
      const data = formRef.current?.getData();
      if (!data) {
        setIaError('Para pedir la sugerencia se guarda la ficha: revisá los datos marcados.');
        return;
      }
      objetivo = await guardar(data);
      if (!objetivo) {
        setIaError('Para pedir la sugerencia se guarda la ficha: revisá el error de abajo.');
        return;
      }
    }
    setSugiriendo(true);
    try {
      const nueva = await sugerirFichaRequest(token, objetivo.id);
      if (nueva.formulas.length > 0 && formRef.current?.tieneFormulas()) setPreguntaFormulas(nueva);
      else aplicarSugerencia(nueva, nueva.formulas.length > 0);
    } catch (err) {
      setIaError(errorMessage(err));
    } finally {
      setSugiriendo(false);
    }
  };

  const responderFormulas = (reemplazar: boolean) => {
    if (preguntaFormulas) aplicarSugerencia(preguntaFormulas, reemplazar);
    setPreguntaFormulas(null);
  };

  const descartarSugerencia = () => {
    if (antesDeSugerencia) formRef.current?.restaurar(antesDeSugerencia);
    setAntesDeSugerencia(null);
    setSugerencia(null);
    setFormulasSugeridas(0);
  };

  // El análisis no se guarda en ningún lado: copiado a las observaciones internas, queda en la ficha
  const copiarAnalisis = () => {
    if (!sugerencia) return;
    if (formRef.current?.agregarObservaciones(analisisComoTexto(sugerencia))) {
      toast.success('Análisis copiado', { description: 'Quedó en "Observaciones internas" y se guarda con la ficha.' });
    } else {
      toast('El análisis ya está en las observaciones internas');
    }
  };

  // Vuelve a dejar vacío el diagnóstico precargado de la ficha anterior
  const limpiarAnterior = () => {
    formRef.current?.limpiarDiagnostico();
    setAnteriorDescartado(true);
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
  // La ficha nueva espera al diagnóstico anterior: el formulario toma sus valores iniciales una sola vez
  const cargando = (inicialId !== null && local === undefined && fetched.isLoading) || (local === undefined && ultimo.isLoading);
  // La IA solo trabaja con la ficha abierta (el back da 400 si ya está cerrada)
  const conIA = editable && !ficha?.cerradaEn;

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

          <Tabs
            ariaLabel="Secciones de la ficha"
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
                servicio={ficha.servicio}
                fecha={ficha.fecha}
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
            <div className="flex flex-col gap-8">
              {conIA && (
                <section className="flex flex-col gap-3 rounded-[6px] border border-gray-200 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <h3 className="font-inter text-sm font-semibold uppercase tracking-widest text-black">Asistente de IA</h3>
                    {/* Chico y a la derecha: borde degradado de 2px y letra negra */}
                    <div className="rounded-[4px] bg-capilar-gradient p-[2px] shadow-sm transition-transform active:scale-95">
                      <button
                        type="button"
                        onClick={sugerir}
                        disabled={sugiriendo || saving}
                        className="rounded-[2px] bg-white px-3 py-1.5 font-inter text-xs font-semibold uppercase tracking-wider text-black transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {sugiriendo ? 'Analizando...' : sugerencia ? 'Volver a sugerir' : 'Sugerir con IA'}
                      </button>
                    </div>
                  </div>
                  <p className="font-inter text-sm text-capilar-grey">
                    Mira las últimas fichas de la clienta, sus alergias, el stock y la foto de antes si la subiste. Sugiere el diagnóstico y la
                    fórmula, y avisa si hay algo a tener en cuenta antes de trabajar.
                    {!ficha && ' Para pedirla, primero se guarda la ficha con lo cargado.'}
                  </p>
                  {sugiriendo && <p className="font-inter text-xs text-capilar-grey">Analizando el historial de la clienta... puede tardar unos segundos.</p>}
                  {iaError && (
                    <p role="alert" className="font-inter text-sm text-red-500">
                      {iaError}
                    </p>
                  )}
                  {sugerencia && (
                    <SugerenciaIACard
                      sugerencia={sugerencia}
                      formulasPrecargadas={formulasSugeridas}
                      onDescartar={antesDeSugerencia ? descartarSugerencia : undefined}
                      onCopiar={copiarAnalisis}
                    />
                  )}
                </section>
              )}
              {/* Sin key por ficha: al guardar una nueva sigue el mismo formulario (la IA la guarda antes de sugerir) */}
              <FichaForm
                ref={formRef}
                ficha={ficha}
                diagnosticoInicial={anterior}
                avisoDiagnostico={
                  anterior && (
                    <p className="rounded-md bg-gray-50 px-3 py-2 font-inter text-xs text-capilar-grey">
                      Precargado de la ficha del {fromIsoDate(anterior.fecha).toLocaleDateString('es-AR')} ({anterior.servicio}). Revisalo: el pelo
                      pudo cambiar.{' '}
                      <button type="button" onClick={limpiarAnterior} className="font-semibold text-capilar-violet-text hover:underline">
                        Empezar de cero
                      </button>
                    </p>
                  )
                }
                articulos={articulos.data ?? []}
                articulosError={articulos.error}
                onCrearArticulo={(nombre, elegir) => setNuevoArticulo({ nombre, elegir })}
                onSubmit={save}
                onCancel={close}
                onDelete={ficha && !ficha.cerradaEn ? () => setConfirmDelete(true) : undefined}
                isLoading={saving || sugiriendo}
                error={formError}
              />
            </div>
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
      <ConfirmDialog
        isOpen={preguntaFormulas !== null}
        onClose={() => responderFormulas(false)}
        title="Fórmulas sugeridas"
        confirmLabel="Reemplazar"
        cancelLabel="Mantener las mías"
        onConfirm={() => responderFormulas(true)}
      >
        La IA sugiere {preguntaFormulas?.formulas.length === 1 ? 'una fórmula' : `${preguntaFormulas?.formulas.length} fórmulas`} con productos del
        stock. ¿Querés reemplazar las que ya cargaste?
      </ConfirmDialog>
      <ConfirmDialog
        isOpen={guardarConAlertas !== null}
        onClose={() => setGuardarConAlertas(null)}
        title="Revisá las alertas de la IA"
        confirmLabel="Ya las revisé"
        cancelLabel="Volver a la ficha"
        onConfirm={confirmarAlertas}
        isLoading={saving}
      >
        <ul className="flex list-disc flex-col gap-2 pl-4 text-left text-black">
          {sugerencia?.analisis.alertas.map((alerta, index) => (
            <li key={index}>{alerta}</li>
          ))}
        </ul>
      </ConfirmDialog>
      {editando && (
        <FichaEditModal
          token={token}
          ficha={editando}
          onClose={() => setEditando(null)}
          onSaved={(actualizada) => historial.setData((prev) => prev.map((f) => (f.id === actualizada.id ? actualizada : f)))}
        />
      )}
      {nuevoArticulo && (
        <NuevoArticuloModal
          token={token}
          nombreInicial={nuevoArticulo.nombre}
          articulos={articulos.data ?? []}
          onCreado={(articulo) => articulos.setData((prev) => [...prev, articulo])}
          onElegir={nuevoArticulo.elegir}
          onClose={() => setNuevoArticulo(null)}
        />
      )}
    </>
  );
};
