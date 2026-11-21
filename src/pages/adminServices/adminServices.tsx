import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { getAllCategoriasRequest } from '../../api/categorias';
import type { Categoria } from '../../api/categorias';
import { ApiError } from '../../api/client';
import {
  agruparPorCategoria,
  createServiceRequest,
  deactivateServiceRequest,
  formatDuration,
  formatPrice,
  getAllServicesRequest,
  reactivateServiceRequest,
  updateServiceRequest,
} from '../../api/services';
import type { Servicio, ServicioData } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { List, ListItem } from '../../components/list/list';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { IconButton } from '../../components/iconButton/iconButton';
import { SearchBox } from '../../components/searchBox/searchBox';
import { ServiceForm } from '../../components/serviceForm/serviceForm';
import { Tabs } from '../../components/tabs/tabs';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { AdminCategorias } from './adminCategorias';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Acción elegida, a la espera del formulario o de la confirmación en el modal
type PendingAction =
  | { type: 'crear' }
  | { type: 'editar'; servicio: Servicio }
  | { type: 'baja'; servicio: Servicio }
  | { type: 'alta'; servicio: Servicio };

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

// Ignora mayúsculas y tildes ("coloracion" encuentra "Coloración")
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Botón chico de las filas con texto (Dar de alta); editar y eliminar van con IconButton
const rowButtonClasses =
  'rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors';

// Textos del modal de confirmación (baja y alta)
const confirmTexts = (action: { type: 'baja' | 'alta'; servicio: Servicio }): { title: string; question: ReactNode; detail: string; confirm: string } => {
  const name = <span className="font-semibold text-black">{action.servicio.tipo}</span>;

  return action.type === 'baja'
    ? {
        title: 'Eliminar servicio',
        question: <>¿Dar de baja el servicio {name}?</>,
        detail: 'Deja de ofrecerse para nuevos turnos. Los turnos que ya lo tienen lo siguen mostrando y podés volver a darlo de alta cuando quieras.',
        confirm: 'Eliminar',
      }
    : {
        title: 'Dar de alta',
        question: <>¿Volver a dar de alta el servicio {name}?</>,
        detail: 'Va a quedar disponible de nuevo para reservar.',
        confirm: 'Dar de alta',
      };
};

// Sección Servicios del ADMIN: crear, modificar y dar de baja o de alta servicios (baja lógica).
// En la pestaña Categorías, las categorías con las que se agrupan
export const AdminServices = () => {
  const { token } = useAuth();
  const [tab, setTab] = useState<'servicios' | 'categorias'>('servicios');
  const [search, setSearch] = useState('');
  const [services, setServices] = useState<Servicio[]>([]);
  // Todas, incluidas las dadas de baja; el formulario ofrece solo las activas
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  // El formulario de alta va en la URL (?nuevo=1) para poder abrirlo desde el menú lateral
  const [searchParams, setSearchParams] = useSearchParams();
  const creando = searchParams.get('nuevo') === '1';
  const [accion, setAccion] = useState<PendingAction | null>(null);
  const pending: PendingAction | null = accion ?? (creando ? { type: 'crear' } : null);
  const setPending = (next: PendingAction | null) => {
    setAccion(next);
    if (next === null && creando) setSearchParams({}, { replace: true });
  };
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Son pocos servicios: se piden una vez (con los dados de baja), junto con las categorías, y la búsqueda filtra en el navegador
  useEffect(() => {
    if (!token) return;
    let ignore = false;

    Promise.all([getAllServicesRequest(token), getAllCategoriasRequest(token)])
      .then(([servicios, cats]) => {
        if (ignore) return;
        setServices(servicios);
        setCategorias(cats);
      })
      .catch((err) => {
        if (!ignore) setError(err instanceof ApiError ? err.message : unexpectedError);
      })
      .finally(() => {
        if (!ignore) setIsLoading(false);
      });

    return () => {
      ignore = true;
    };
  }, [token]);

  // Filtrados por nombre; activos primero y dados de baja al final (dentro de cada grupo, orden alfabético)
  const query = normalize(search.trim());
  const visibleServices = services
    .filter((servicio) => normalize(servicio.tipo).includes(query))
    .sort(
      (a, b) =>
        Number(a.fechaBaja !== null) - Number(b.fechaBaja !== null) || a.tipo.localeCompare(b.tipo, 'es'),
    );
  const grupos = agruparPorCategoria(visibleServices);
  const categoriasActivas = categorias.filter((categoria) => categoria.fechaBaja === null);

  // Al renombrar una categoría, sus servicios muestran el nombre nuevo
  const renameCategoria = (categoria: Categoria) =>
    setServices((prev) =>
      prev.map((servicio) =>
        servicio.categoria.id === categoria.id ? { ...servicio, categoria: { id: categoria.id, nombre: categoria.nombre } } : servicio,
      ),
    );

  const replaceService = (updated: Servicio) =>
    setServices((prev) => prev.map((servicio) => (servicio.id === updated.id ? updated : servicio)));

  const closeModal = () => {
    if (isSaving) return;
    setPending(null);
    setSaveError('');
  };

  // Corre la request del modal: maneja el estado de guardado, el error y el cierre
  const run = async (request: () => Promise<void>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await request();
      setPending(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const submitForm = (data: ServicioData) => {
    if (!pending || !token) return;

    if (pending.type === 'crear') {
      return run(async () => {
        const created = await createServiceRequest(token, data);
        setServices((prev) => [...prev, created]);
        toast.success('Servicio creado', { description: `${created.tipo} ya se puede reservar.` });
      });
    }

    if (pending.type !== 'editar') return;
    const { servicio } = pending;

    // Solo los campos que cambiaron; sin cambios, se cierra sin llamar al back
    const changes: Partial<ServicioData> = {};
    if (data.tipo !== servicio.tipo) changes.tipo = data.tipo;
    if (data.descripcion !== servicio.descripcion) changes.descripcion = data.descripcion;
    if (data.tiempoDuracion !== servicio.tiempoDuracion) changes.tiempoDuracion = data.tiempoDuracion;
    if (data.precio !== Number(servicio.precio)) changes.precio = data.precio;
    if (data.requiereEvaluacion !== servicio.requiereEvaluacion) changes.requiereEvaluacion = data.requiereEvaluacion;
    if (data.categoriaId !== servicio.categoria.id) changes.categoriaId = data.categoriaId;
    if (Object.keys(changes).length === 0) {
      setPending(null);
      return;
    }

    return run(async () => {
      const updated = await updateServiceRequest(token, servicio.id, changes);
      replaceService(updated);
      toast.success('Servicio actualizado', { description: `Se guardaron los cambios de ${updated.tipo}.` });
    });
  };

  const confirmAction = () => {
    if (!pending || !token) return;

    if (pending.type === 'baja') {
      const { servicio } = pending;
      return run(async () => {
        await deactivateServiceRequest(token, servicio.id);
        replaceService({ ...servicio, fechaBaja: new Date().toISOString() });
        toast.success('Servicio dado de baja', { description: `${servicio.tipo} ya no se ofrece para nuevos turnos.` });
      });
    }

    if (pending.type === 'alta') {
      return run(async () => {
        const updated = await reactivateServiceRequest(token, pending.servicio.id);
        replaceService(updated);
        toast.success('Servicio dado de alta', { description: `${updated.tipo} se puede reservar de nuevo.` });
      });
    }
  };

  const renderServicio = (servicio: Servicio) => {
    const isInactive = servicio.fechaBaja !== null;
    const summary = servicio.requiereEvaluacion
      ? `${formatDuration(servicio.tiempoDuracion)} · Requiere aprobación`
      : formatDuration(servicio.tiempoDuracion);

    return (
      <ListItem
        title={servicio.tipo}
        description={isInactive ? `${summary} · Dado de baja el ${formatDate(servicio.fechaBaja!)}` : summary}
        className={isInactive ? 'bg-gray-50 opacity-60' : ''}
        trailing={
          <>
            <span className="font-inter text-sm font-semibold text-black">Desde {formatPrice(servicio.precio)}</span>
            {isInactive ? (
              <button
                type="button"
                onClick={() => setPending({ type: 'alta', servicio })}
                className={`${rowButtonClasses} hover:border-capilar-violet hover:text-capilar-violet`}
              >
                Dar de alta
              </button>
            ) : (
              <>
                <IconButton icon="editar" onClick={() => setPending({ type: 'editar', servicio })} aria-label={`Editar ${servicio.tipo}`} />
                <IconButton icon="eliminar" onClick={() => setPending({ type: 'baja', servicio })} aria-label={`Eliminar ${servicio.tipo}`} />
              </>
            )}
          </>
        }
      />
    );
  };

  const isForm = pending?.type === 'crear' || pending?.type === 'editar';
  const texts = pending && (pending.type === 'baja' || pending.type === 'alta') ? confirmTexts(pending) : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Servicios' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Servicios</Title>
            <p className="font-inter text-capilar-grey">Cargá los servicios del salón con su categoría, duración y precio.</p>
          </div>
          {tab === 'servicios' && (
            <Button
              onClick={() => setSearchParams({ nuevo: '1' })}
              className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
            >
              Nuevo servicio
            </Button>
          )}
        </div>
      </div>

      <Tabs
        ariaLabel="Secciones de servicios"
        variant="subrayado"
        tabs={[
          ['servicios', 'Servicios'],
          ['categorias', 'Categorías'],
        ]}
        value={tab}
        onChange={setTab}
      />

      {error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {error}
        </Alert>
      ) : isLoading ? (
        <Loader label="Cargando servicios..." className="py-12" />
      ) : tab === 'categorias' ? (
        token && (
          <AdminCategorias
            token={token}
            categorias={categorias}
            servicios={services}
            onCategoriasChange={setCategorias}
            onRenamed={renameCategoria}
          />
        )
      ) : (
        <>
          <SearchBox value={search} onChange={setSearch} label="Buscar servicios" placeholder="Buscar por nombre" />
          {grupos.length === 0 ? (
            <p className="py-8 text-center font-inter text-sm text-capilar-grey">
              {services.length === 0
                ? 'Todavía no hay servicios. Creá el primero con "Nuevo servicio".'
                : 'No hay servicios que coincidan con la búsqueda.'}
            </p>
          ) : (
            grupos.map(({ categoria, servicios }) => (
              <div key={categoria.id} className="flex flex-col gap-3">
                <Title as="h2" className="text-lg! md:text-xl!">
                  {categoria.nombre}
                </Title>
                <List
                  items={servicios}
                  getKey={(servicio) => servicio.id}
                  renderItem={renderServicio}
                />
              </div>
            ))
          )}
        </>
      )}

      <Modal
        isOpen={pending !== null}
        onClose={closeModal}
        ariaLabel={isForm ? (pending.type === 'crear' ? 'Nuevo servicio' : 'Editar servicio') : texts?.title}
        // El formulario es largo: más ancho para que quede más bajo
        className={isForm ? 'max-w-xl!' : ''}
        // Las confirmaciones se cierran al tocar afuera; el formulario no
        closeOnBackdrop={!isForm}
      >
        {isForm && (
          <ServiceForm
            // key: al pasar de un servicio a otro, el formulario arranca de cero
            key={pending.type === 'editar' ? pending.servicio.id : 'nuevo'}
            servicio={pending.type === 'editar' ? pending.servicio : undefined}
            categorias={categoriasActivas}
            onSubmit={submitForm}
            onCancel={closeModal}
            isLoading={isSaving}
            error={saveError}
          />
        )}

        {texts && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <Title as="h2">{texts.title}</Title>
              <p className="font-inter text-sm text-capilar-grey">{texts.question}</p>
            </div>

            <p className="text-center font-inter text-sm text-capilar-grey">{texts.detail}</p>

            {saveError && (
              <p role="alert" className="text-center font-inter text-sm text-red-500">
                {saveError}
              </p>
            )}

            <div className="flex gap-3">
              <Button variant="grey" onClick={closeModal} disabled={isSaving} className="flex-1 py-2 text-sm uppercase">
                Cancelar
              </Button>
              <Button
                onClick={confirmAction}
                disabled={isSaving}
                className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Guardando...' : texts.confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
};
