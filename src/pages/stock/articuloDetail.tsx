import { useRef, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DEPOSITOS,
  DOS_DECIMALES,
  ESTADOS_VENCIMIENTO,
  TIPOS_DE_MOVIMIENTO,
  TIPOS_DE_PRODUCTO,
  USOS,
  cambiosDeArticulo,
  createMovimientoRequest,
  estadoVencimiento,
  finishEnvaseRequest,
  formatCantidad,
  formatEnvases,
  formatMarca,
  getArticuloRequest,
  getMarcasRequest,
  getMovimientosRequest,
  limitarDecimal,
  openEnvaseRequest,
  parseDecimal,
  updateArticuloRequest,
  updateEnvaseRequest,
} from '../../api/articulos';
import type { Articulo, ArticuloData, Movimiento, MovimientoData } from '../../api/articulos';
import { ApiError } from '../../api/client';
import type { Pagina } from '../../api/client';
import { UNIDADES } from '../../api/fichas';
import { fromIsoDate } from '../../api/turnos';
import { formatPrice } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { ArticuloForm } from '../../components/articuloForm/articuloForm';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { IconButton } from '../../components/iconButton/iconButton';
import { List, ListItem } from '../../components/list/list';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { Pagination } from '../../components/pagination/pagination';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { MovimientoModal } from './movimientoModal';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

const POR_PAGINA = 50;

const labelClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';
const cardClass = 'flex flex-col gap-4 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md';
const linkButtonClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-violet hover:underline disabled:opacity-50';

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className={labelClass}>{label}</dt>
    <dd className="font-inter text-sm text-black">{children || <span className="text-capilar-grey">—</span>}</dd>
  </div>
);

// "7/11/2026, 18:30"
const formatFechaHora = (iso: string) =>
  new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });

// El QR del artículo, con el código en texto y para imprimir como etiqueta
const ArticuloQr = ({ articulo }: { articulo: Articulo }) => {
  const qrRef = useRef<HTMLDivElement>(null);

  // Ventana aparte con solo la etiqueta. Se arma con el DOM para que el nombre del artículo quede como texto
  const imprimir = () => {
    const svg = qrRef.current?.querySelector('svg');
    const ventana = window.open('', '_blank', 'width=420,height=520');
    if (!svg || !ventana) {
      toast.error('No se pudo abrir la etiqueta', { description: 'Revisá que el navegador no esté bloqueando la ventana.' });
      return;
    }
    const doc = ventana.document;
    doc.title = articulo.nombre;
    doc.body.style.cssText = 'font-family:sans-serif;text-align:center;padding:24px';
    const nombre = doc.createElement('p');
    nombre.textContent = articulo.nombre;
    nombre.style.fontWeight = 'bold';
    const codigo = doc.createElement('p');
    codigo.textContent = articulo.qr;
    doc.body.append(doc.importNode(svg, true), nombre, codigo);
    ventana.print();
  };

  return (
    <div className={`${cardClass} items-center text-center`}>
      <h2 className={`${labelClass} self-start`}>Código QR</h2>
      <div ref={qrRef}>
        <QRCodeSVG value={articulo.qr} size={148} marginSize={1} title={`QR de ${articulo.nombre}`} />
      </div>
      <p className="font-inter text-sm font-semibold text-black">{articulo.qr}</p>
      <button type="button" onClick={imprimir} className={linkButtonClass}>
        Imprimir etiqueta
      </button>
    </div>
  );
};

interface EnvaseCardProps {
  articulo: Articulo;
  token: string;
  onChange: (articulo: Articulo) => void;
}

// El envase abierto: cuánto queda, actualizarlo (por ejemplo al pesarlo), abrir uno nuevo y terminarlo
const EnvaseCard = ({ articulo, token, onChange }: EnvaseCardProps) => {
  const envase = articulo.envaseEnUso;
  const contenido = Number(articulo.pesoInicial);
  const unidad = UNIDADES[articulo.tipoPeso];
  const dadoDeBaja = articulo.fechaBaja !== null;

  const [editando, setEditando] = useState(false);
  const [peso, setPeso] = useState('');
  const [pesoError, setPesoError] = useState('');
  const [confirmar, setConfirmar] = useState<'abrir' | 'terminar' | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const abrir = async () => {
    setBusy(true);
    setError('');
    try {
      onChange(await openEnvaseRequest(token, articulo.id));
      setConfirmar(null);
      setEditando(false);
      toast.success('Envase abierto', { description: `Quedó lleno: ${formatCantidad(contenido)} ${unidad}.` });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const terminar = async () => {
    setBusy(true);
    setError('');
    try {
      await finishEnvaseRequest(token, articulo.id);
      onChange({ ...articulo, envaseEnUso: null });
      setConfirmar(null);
      setEditando(false);
      toast.success('Envase terminado');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const guardarPeso = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!DOS_DECIMALES.test(peso.trim())) {
      setPesoError('Ingresá un número, con hasta 2 decimales');
      return;
    }
    if (parseDecimal(peso) > contenido) {
      setPesoError(`El envase trae ${formatCantidad(contenido)} ${unidad}: no puede quedar más que eso`);
      return;
    }
    setBusy(true);
    setPesoError('');
    try {
      onChange(await updateEnvaseRequest(token, articulo.id, parseDecimal(peso)));
      setEditando(false);
      toast.success('Envase actualizado');
    } catch (err) {
      setPesoError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const queda = envase ? Number(envase.pesoActual) : 0;
  const porcentaje = contenido > 0 ? Math.min(100, Math.round((queda / contenido) * 100)) : 0;

  return (
    <div className={cardClass}>
      <h2 className={labelClass}>Envase abierto</h2>
      {envase ? (
        <>
          <p className="font-inter text-sm text-black">
            Quedan <span className="text-lg font-semibold">{formatCantidad(queda)} {unidad}</span> de {formatCantidad(contenido)} {unidad}
          </p>
          <div
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Lo que queda en el envase"
            className="h-2 overflow-hidden rounded-full bg-gray-100"
          >
            <div className="h-full bg-capilar-gradient" style={{ width: `${porcentaje}%` }} />
          </div>
          {editando ? (
            <form onSubmit={guardarPeso} noValidate className="flex flex-col gap-2">
              <label className={labelClass}>
                Cuánto queda ({unidad})
                <input
                  autoFocus
                  inputMode="decimal"
                  value={peso}
                  onChange={(event) => setPeso(limitarDecimal(event.target.value, 2))}
                  aria-invalid={pesoError ? true : undefined}
                  className={`mt-1 w-full rounded-lg border px-3 py-2 font-inter text-sm font-normal normal-case tracking-normal text-black outline-none focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
                    pesoError ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </label>
              {pesoError && <p className="font-inter text-xs text-red-500">{pesoError}</p>}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="grey" onClick={() => setEditando(false)} disabled={busy} className="px-4 py-1.5 text-xs uppercase">
                  Cancelar
                </Button>
                <Button type="submit" disabled={busy} className="px-4 py-1.5 text-xs text-white! font-bold! uppercase disabled:opacity-60">
                  {busy ? 'Guardando...' : 'Guardar'}
                </Button>
              </div>
            </form>
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {!dadoDeBaja && (
                <>
                  <button
                    type="button"
                    onClick={() => {
                      setPeso(String(queda));
                      setPesoError('');
                      setEditando(true);
                    }}
                    className={linkButtonClass}
                  >
                    Actualizar
                  </button>
                  <button type="button" onClick={() => setConfirmar('abrir')} className={linkButtonClass}>
                    Abrir otro
                  </button>
                </>
              )}
              <button type="button" onClick={() => setConfirmar('terminar')} className={linkButtonClass}>
                Terminar
              </button>
            </div>
          )}
        </>
      ) : (
        <>
          <p className="font-inter text-sm text-capilar-grey">No hay un envase abierto.</p>
          {!dadoDeBaja && (
            <button type="button" onClick={abrir} disabled={busy} className={`${linkButtonClass} self-start`}>
              {busy ? 'Abriendo...' : 'Abrir envase'}
            </button>
          )}
          {error && !confirmar && <p className="font-inter text-xs text-red-500">{error}</p>}
        </>
      )}
      <p className="font-inter text-xs text-capilar-grey">Abrir o terminar un envase no cambia el stock.</p>

      <ConfirmDialog
        isOpen={confirmar !== null}
        onClose={() => setConfirmar(null)}
        title={confirmar === 'abrir' ? 'Abrir otro envase' : 'Terminar el envase'}
        confirmLabel={confirmar === 'abrir' ? 'Abrir' : 'Terminar'}
        onConfirm={confirmar === 'abrir' ? abrir : terminar}
        isLoading={busy}
        error={error}
      >
        {confirmar === 'abrir'
          ? `Reemplaza al que está abierto, que todavía tiene ${formatCantidad(queda)} ${unidad}. El nuevo queda lleno.`
          : `El artículo queda sin envase abierto, aunque todavía tenga ${formatCantidad(queda)} ${unidad}.`}
      </ConfirmDialog>
    </div>
  );
};

// Detalle de un artículo: cuánto hay, el envase abierto, el QR y el historial de movimientos
export const ArticuloDetail = () => {
  const { id: idParam } = useParams();
  const id = Number(idParam);
  const { token, user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';

  const articulo = useFetch(token ? `articulo-${id}` : null, () => getArticuloRequest(token!, id));
  const [pagina, setPagina] = useState(1);
  const movimientos = useFetch<Pagina<Movimiento>>(token ? `movimientos-${id}-${pagina}` : null, () => getMovimientosRequest(token!, id, pagina));

  const [modal, setModal] = useState<'movimiento' | 'editar' | null>(null);
  const marcas = useFetch(token && modal === 'editar' ? 'marcas' : null, () => getMarcasRequest(token!));
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const closeModal = () => {
    if (isSaving) return;
    setModal(null);
    setSaveError('');
  };

  const registrar = async (data: MovimientoData) => {
    setIsSaving(true);
    setSaveError('');
    try {
      const { articulo: actualizado, stockNegativo } = await createMovimientoRequest(token!, id, data);
      articulo.setData(() => actualizado);
      setModal(null);
      // El historial va del más nuevo al más viejo: se vuelve a la primera página para verlo
      if (pagina === 1) movimientos.reload();
      else setPagina(1);
      if (stockNegativo) {
        toast.warning('El stock quedó en negativo', { description: `${actualizado.nombre}: ${formatEnvases(actualizado.stock)}.` });
      } else {
        toast.success('Movimiento registrado', { description: `Ahora hay ${formatEnvases(actualizado.stock)}.` });
      }
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const editar = async (data: ArticuloData) => {
    const actual = articulo.data;
    if (!actual) return;

    // Sin cambios, se cierra sin llamar al back
    const changes = cambiosDeArticulo(data, actual);
    if (Object.keys(changes).length === 0) {
      setModal(null);
      return;
    }

    setIsSaving(true);
    setSaveError('');
    try {
      const actualizado = await updateArticuloRequest(token!, id, changes);
      articulo.setData(() => actualizado);
      setModal(null);
      toast.success('Artículo actualizado', { description: `Se guardaron los cambios de ${actualizado.nombre}.` });
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const data = articulo.data;
  const nombre = data?.nombre ?? 'Artículo';
  const negativo = data ? Number(data.stock) < 0 : false;
  const vencimiento = data ? estadoVencimiento(data) : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Stock', to: '/panel/stock' }, { label: nombre }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>{nombre}</Title>
            {data && (
              <p className="font-inter text-capilar-grey">
                {formatMarca(data.marca)} · {TIPOS_DE_PRODUCTO[data.tipoProducto]}
              </p>
            )}
          </div>
          {data && data.fechaBaja === null && (
            <div className="flex shrink-0 items-center gap-3 self-start md:self-auto">
              {isAdmin && <IconButton icon="editar" onClick={() => setModal('editar')} aria-label={`Editar ${nombre}`} />}
              <Button onClick={() => setModal('movimiento')} className="px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider">
                Registrar movimiento
              </Button>
            </div>
          )}
        </div>
      </div>

      {articulo.error ? (
        <Alert variant="error" title="No se pudo cargar el artículo">
          {articulo.error}
        </Alert>
      ) : articulo.isLoading || !data ? (
        <Loader label="Cargando artículo..." className="py-12" />
      ) : (
        <>
          {data.fechaBaja !== null && (
            <Alert variant="advertencia" title="Este artículo está dado de baja">
              Se conserva para las fichas y los movimientos, pero no se puede mover su stock ni usarlo en fichas nuevas.
            </Alert>
          )}

          <div className="grid gap-6 md:grid-cols-3">
            <div className={cardClass}>
              <h2 className={labelClass}>Stock</h2>
              <p className={`font-inter text-3xl font-semibold ${negativo ? 'text-red-500' : data.bajoStock ? 'text-amber-700' : 'text-black'}`}>
                {formatEnvases(data.stock)}
              </p>
              <p className="font-inter text-sm text-capilar-grey">
                Mínimo: {formatEnvases(data.stockMinAlert)}
                {data.bajoStock && <span className="font-semibold text-amber-700"> · Poco stock</span>}
              </p>
            </div>
            <EnvaseCard articulo={data} token={token!} onChange={(actualizado) => articulo.setData(() => actualizado)} />
            <ArticuloQr articulo={data} />
          </div>

          <div className={cardClass}>
            <h2 className={labelClass}>Datos</h2>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-4">
              <Dato label="Uso">{USOS[data.uso]}</Dato>
              <Dato label="Dónde se guarda">{DEPOSITOS[data.tipoDeposito]}</Dato>
              <Dato label="Tono o volumen">{data.tonalidad}</Dato>
              <Dato label="Código">{data.codigo}</Dato>
              <Dato label="Contenido del envase">
                {formatCantidad(data.pesoInicial)} {UNIDADES[data.tipoPeso]}
              </Dato>
              <Dato label="Precio de costo">{formatPrice(data.precioCosto)}</Dato>
              <Dato label="Precio de venta">{data.precioVenta && formatPrice(data.precioVenta)}</Dato>
              <Dato label="Vencimiento">
                {data.fechaVencimiento && (
                  <span className={vencimiento === 'VENCIDO' ? 'font-semibold text-red-500' : vencimiento ? 'font-semibold text-amber-700' : ''}>
                    {fromIsoDate(data.fechaVencimiento).toLocaleDateString('es-AR')}
                    {vencimiento && ` · ${ESTADOS_VENCIMIENTO[vencimiento]}`}
                  </span>
                )}
              </Dato>
            </dl>
          </div>

          <div className="flex flex-col gap-4">
            <Title as="h2">Movimientos</Title>
            {movimientos.error ? (
              <Alert variant="error" title="No se pudo cargar el historial">
                {movimientos.error}
              </Alert>
            ) : movimientos.isLoading || !movimientos.data ? (
              <Loader label="Cargando movimientos..." className="py-8" />
            ) : (
              <>
                <List
                  items={movimientos.data.items}
                  getKey={(movimiento) => movimiento.id}
                  emptyMessage="Este artículo todavía no tiene movimientos."
                  renderItem={(movimiento) => {
                    const cantidad = Number(movimiento.cantidad);
                    const detalle = [
                      formatFechaHora(movimiento.fecha),
                      `${movimiento.usuario.nombre} ${movimiento.usuario.apellido}`,
                      movimiento.numComprobante && `Comprobante ${movimiento.numComprobante}`,
                      movimiento.estado === 'ANULADO' && 'Anulado',
                    ]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <ListItem
                        title={movimiento.motivo ? `${TIPOS_DE_MOVIMIENTO[movimiento.tipo]} · ${movimiento.motivo}` : TIPOS_DE_MOVIMIENTO[movimiento.tipo]}
                        description={detalle}
                        trailing={
                          <span className={`font-inter text-sm font-semibold ${cantidad < 0 ? 'text-red-500' : 'text-capilar-violet'}`}>
                            {cantidad > 0 && '+'}
                            {formatEnvases(cantidad)}
                          </span>
                        }
                      />
                    );
                  }}
                />
                <Pagination pagina={pagina} total={movimientos.data.total} porPagina={POR_PAGINA} onChange={setPagina} />
              </>
            )}
          </div>
        </>
      )}

      {modal === 'movimiento' && data && (
        <MovimientoModal articulo={data} onSubmit={registrar} onClose={closeModal} isLoading={isSaving} error={saveError} />
      )}

      <Modal isOpen={modal === 'editar'} onClose={closeModal} ariaLabel="Editar artículo" className="max-w-2xl!">
        {modal === 'editar' &&
          data &&
          (marcas.data ? (
            <ArticuloForm articulo={data} marcas={marcas.data} onSubmit={editar} onCancel={closeModal} isLoading={isSaving} error={saveError} />
          ) : (
            <Loader label="Cargando..." className="py-12" />
          ))}
      </Modal>
    </section>
  );
};
