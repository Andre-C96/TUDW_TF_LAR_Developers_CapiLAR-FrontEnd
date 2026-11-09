import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ESTADOS_VENCIMIENTO,
  TIPOS_DE_PRODUCTO,
  USOS,
  cambiosDeArticulo,
  createArticuloRequest,
  createMarcaRequest,
  deactivateArticuloRequest,
  estadoVencimiento,
  formatEnvases,
  formatMarca,
  getArticuloByQrRequest,
  getArticulosRequest,
  getMarcasRequest,
  porMarca,
  reactivateArticuloRequest,
  updateArticuloRequest,
} from '../../api/articulos';
import type { Articulo, ArticuloData, MarcaData, TipoProducto, UsoArticulo } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/alert/alert';
import { ArticuloForm } from '../../components/articuloForm/articuloForm';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { IconButton } from '../../components/iconButton/iconButton';
import { List, ListItem } from '../../components/list/list';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SearchBox } from '../../components/searchBox/searchBox';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FilterSelect } from '../agenda/agendaFiltros';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

// Ignora mayúsculas y tildes ("mascara" encuentra "Máscara")
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const TODOS = 'TODOS';
const textoDeBusqueda = (articulo: Articulo) =>
  normalize([articulo.nombre, articulo.codigo, articulo.tonalidad, articulo.qr, formatMarca(articulo.marca)].filter(Boolean).join(' '));

type PendingAction = { type: 'editar' | 'baja' | 'alta'; articulo: Articulo };

// Sección Stock: los artículos con cuánto queda de cada uno. Se pueden cargar (ej. al recibir un pedido); el ADMIN además los edita y da de baja.
// Enter en el buscador con un código "ART-..." abre ese artículo: un lector de QR escribe el código y aprieta Enter.
export const Stock = () => {
  const { token, user } = useAuth();
  const isAdmin = user?.rol === 'ADMIN';
  const navigate = useNavigate();

  const articulos = useFetch(token ? `articulos-${isAdmin}` : null, () => getArticulosRequest(token!, isAdmin));
  const marcas = useFetch(token ? 'marcas' : null, () => getMarcasRequest(token!));

  // "Bajo stock" y el alta van en la URL para poder abrirlos desde el menú lateral
  const [searchParams, setSearchParams] = useSearchParams();
  const soloBajo = searchParams.get('bajo') === '1';
  const creando = searchParams.get('nuevo') === '1';
  const [search, setSearch] = useState('');
  const [tipo, setTipo] = useState<TipoProducto | typeof TODOS>(TODOS);
  const [uso, setUso] = useState<UsoArticulo | typeof TODOS>(TODOS);
  const [marcaId, setMarcaId] = useState(TODOS);
  // Son excluyentes: un artículo no puede estar vencido y por vencer a la vez
  const [vencimiento, setVencimiento] = useState<'VENCIDO' | 'VENCE_PRONTO' | null>(null);

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const setSoloBajo = (value: boolean) => setSearchParams(value ? { bajo: '1' } : {}, { replace: true });

  const all = articulos.data ?? [];

  const query = normalize(search.trim());
  // Activos primero y dados de baja al final; el back ya los manda por nombre
  const visibles = all
    .filter(
      (articulo) =>
        textoDeBusqueda(articulo).includes(query) &&
        (tipo === TODOS || articulo.tipoProducto === tipo) &&
        // SALON y VENTA incluyen a los que sirven para las dos cosas, como en el back
        (uso === TODOS || articulo.uso === uso || (uso !== 'AMBOS' && articulo.uso === 'AMBOS')) &&
        (marcaId === TODOS || String(articulo.marcaId) === marcaId) &&
        (!soloBajo || (articulo.bajoStock && articulo.fechaBaja === null)) &&
        (!vencimiento || (estadoVencimiento(articulo) === vencimiento && articulo.fechaBaja === null)),
    )
    .sort((a, b) => Number(a.fechaBaja !== null) - Number(b.fechaBaja !== null));

  const hayFiltros = tipo !== TODOS || uso !== TODOS || marcaId !== TODOS || soloBajo || vencimiento !== null;
  const limpiarFiltros = () => {
    setTipo(TODOS);
    setUso(TODOS);
    setMarcaId(TODOS);
    setVencimiento(null);
    setSoloBajo(false);
  };

  // Lo que escribe un lector de QR: se busca ese artículo y se abre
  const buscarQr = async (texto: string) => {
    if (!token || !/^ART-/i.test(texto)) return;
    try {
      const articulo = await getArticuloByQrRequest(token, texto.toUpperCase());
      navigate(`/panel/stock/${articulo.id}`);
    } catch (err) {
      toast.error('No se encontró ese QR', { description: errorMessage(err) });
    }
  };

  const closeModal = () => {
    if (isSaving) return;
    setPending(null);
    setSaveError('');
    if (creando) setSearchParams({}, { replace: true });
  };

  // Corre la request del modal: maneja el estado de guardado, el error y el cierre
  const run = async (request: () => Promise<void>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await request();
      setPending(null);
      if (creando) setSearchParams({}, { replace: true });
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const crear = (data: ArticuloData) =>
    run(async () => {
      const creado = await createArticuloRequest(token!, data);
      articulos.setData((prev) => [...prev, creado].sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')));
      toast.success('Artículo creado', { description: `${creado.nombre} ya tiene su QR.` });
    });

  const crearMarca = async (data: MarcaData) => {
    const nueva = await createMarcaRequest(token!, data);
    marcas.setData((prev) => [...prev, nueva].sort(porMarca));
    return nueva;
  };

  const editar = (data: ArticuloData) => {
    if (pending?.type !== 'editar') return;
    const { articulo } = pending;
    // Sin cambios, se cierra sin llamar al back
    const changes = cambiosDeArticulo(data, articulo);
    if (Object.keys(changes).length === 0) {
      setPending(null);
      return;
    }
    return run(async () => {
      const actualizado = await updateArticuloRequest(token!, articulo.id, changes);
      articulos.setData((prev) => prev.map((a) => (a.id === articulo.id ? actualizado : a)));
      toast.success('Artículo actualizado', { description: `Se guardaron los cambios de ${actualizado.nombre}.` });
    });
  };

  const confirmar = () => {
    if (!pending) return;
    const { type, articulo } = pending;
    return run(async () => {
      if (type === 'baja') {
        await deactivateArticuloRequest(token!, articulo.id);
        articulos.setData((prev) => prev.map((a) => (a.id === articulo.id ? { ...a, fechaBaja: new Date().toISOString() } : a)));
        toast.success('Artículo dado de baja', { description: `${articulo.nombre} ya no se puede usar en fichas.` });
      } else {
        const actualizado = await reactivateArticuloRequest(token!, articulo.id);
        articulos.setData((prev) => prev.map((a) => (a.id === articulo.id ? actualizado : a)));
        toast.success('Artículo dado de alta', { description: `${actualizado.nombre} se puede usar de nuevo.` });
      }
    });
  };

  const editando = pending?.type === 'editar' ? pending.articulo : undefined;
  const isForm = creando || editando !== undefined;

  const opcionesMarca: [string, string][] = [
    [TODOS, 'Todas'],
    ...(marcas.data ?? []).map((marca): [string, string] => [String(marca.id), formatMarca(marca)]),
  ];
  const opcionesTipo = [[TODOS, 'Todos'], ...Object.entries(TIPOS_DE_PRODUCTO)] as [TipoProducto | typeof TODOS, string][];
  const opcionesUso = [[TODOS, 'Todos'], ...Object.entries(USOS)] as [UsoArticulo | typeof TODOS, string][];

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Stock' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Stock</Title>
            <p className="font-inter text-capilar-grey">Lo que hay en el salón, contado en envases.</p>
          </div>
          <Button
            onClick={() => setSearchParams({ nuevo: '1' })}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nuevo artículo
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-4">
        <SearchBox
          value={search}
          onChange={setSearch}
          onSearch={buscarQr}
          label="Buscar artículos"
          placeholder="Buscar por nombre, marca o código"
        />
        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3">
          <FilterSelect label="Tipo" value={tipo} options={opcionesTipo} onChange={setTipo} />
          <FilterSelect label="Marca" value={marcaId} options={opcionesMarca} onChange={setMarcaId} />
          <FilterSelect label="Uso" value={uso} options={opcionesUso} onChange={setUso} />
          <label className="flex cursor-pointer items-center gap-2 font-inter text-sm text-black">
            <input
              type="checkbox"
              checked={soloBajo}
              onChange={(event) => setSoloBajo(event.target.checked)}
              className="h-4 w-4 cursor-pointer accent-capilar-violet"
            />
            Poco stock
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-inter text-sm text-black">
            <input
              type="checkbox"
              checked={vencimiento === 'VENCIDO'}
              onChange={(event) => setVencimiento(event.target.checked ? 'VENCIDO' : null)}
              className="h-4 w-4 cursor-pointer accent-capilar-violet"
            />
            Vencidos
          </label>
          <label className="flex cursor-pointer items-center gap-2 font-inter text-sm text-black">
            <input
              type="checkbox"
              checked={vencimiento === 'VENCE_PRONTO'}
              onChange={(event) => setVencimiento(event.target.checked ? 'VENCE_PRONTO' : null)}
              className="h-4 w-4 cursor-pointer accent-capilar-violet"
            />
            Vence pronto
          </label>
          {hayFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="ml-auto flex items-center gap-1.5 font-inter text-sm font-semibold text-capilar-violet transition-transform hover:scale-105"
            >
              <span aria-hidden="true">✕</span> Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {articulos.error ? (
        <Alert variant="error" title="No se pudo cargar el stock">
          {articulos.error}
        </Alert>
      ) : articulos.isLoading ? (
        <Loader label="Cargando stock..." className="py-12" />
      ) : (
        <List
          items={visibles}
          getKey={(articulo) => articulo.id}
          emptyMessage={all.length === 0 ? 'Todavía no hay artículos cargados.' : 'No hay artículos que coincidan con la búsqueda.'}
          renderItem={(articulo) => {
            const isInactive = articulo.fechaBaja !== null;
            const negativo = Number(articulo.stock) < 0;
            const vence = isInactive ? null : estadoVencimiento(articulo);
            const detalle = [formatMarca(articulo.marca), TIPOS_DE_PRODUCTO[articulo.tipoProducto], articulo.tonalidad]
              .filter(Boolean)
              .join(' · ');

            return (
              <ListItem
                title={
                  <Link to={`/panel/stock/${articulo.id}`} className="hover:text-capilar-violet">
                    {articulo.nombre}
                  </Link>
                }
                description={isInactive ? `${detalle} · Dado de baja` : detalle}
                className={isInactive ? 'bg-gray-50 opacity-60' : ''}
                trailing={
                  <>
                    <span className="flex flex-col items-end font-inter text-sm">
                      <span className={`font-semibold ${negativo ? 'text-red-500' : articulo.bajoStock && !isInactive ? 'text-amber-700' : 'text-black'}`}>
                        {formatEnvases(articulo.stock)}
                      </span>
                      {articulo.bajoStock && !isInactive && <span className="text-xs text-amber-700">Poco stock</span>}
                      {vence && (
                        <span className={`text-xs font-semibold ${vence === 'VENCIDO' ? 'text-red-500' : 'text-amber-700'}`}>{ESTADOS_VENCIMIENTO[vence]}</span>
                      )}
                    </span>
                    {isAdmin &&
                      (isInactive ? (
                        <button
                          type="button"
                          onClick={() => setPending({ type: 'alta', articulo })}
                          className="rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet"
                        >
                          Dar de alta
                        </button>
                      ) : (
                        <>
                          <IconButton icon="editar" onClick={() => setPending({ type: 'editar', articulo })} aria-label={`Editar ${articulo.nombre}`} />
                          <IconButton icon="eliminar" onClick={() => setPending({ type: 'baja', articulo })} aria-label={`Eliminar ${articulo.nombre}`} />
                        </>
                      ))}
                  </>
                }
              />
            );
          }}
        />
      )}

      <Modal isOpen={isForm} onClose={closeModal} ariaLabel={editando ? 'Editar artículo' : 'Nuevo artículo'} className="max-w-2xl!">
        {isForm && (
          <ArticuloForm
            key={editando ? editando.id : 'nuevo'}
            articulo={editando}
            marcas={marcas.data ?? []}
            onCrearMarca={crearMarca}
            onSubmit={editando ? editar : crear}
            onCancel={closeModal}
            isLoading={isSaving}
            error={saveError}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={pending?.type === 'baja' || pending?.type === 'alta'}
        onClose={closeModal}
        title={pending?.type === 'baja' ? 'Eliminar artículo' : 'Dar de alta'}
        confirmLabel={pending?.type === 'baja' ? 'Eliminar' : 'Dar de alta'}
        onConfirm={confirmar}
        isLoading={isSaving}
        error={saveError}
      >
        {pending?.type === 'baja' ? (
          <>
            ¿Dar de baja <span className="font-semibold text-black">{pending.articulo.nombre}</span>? Deja de ofrecerse en las fichas, pero las fichas
            y los movimientos que lo usan lo siguen mostrando. Lo podés volver a dar de alta cuando quieras.
          </>
        ) : (
          <>
            ¿Volver a dar de alta <span className="font-semibold text-black">{pending?.articulo.nombre}</span>?
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
