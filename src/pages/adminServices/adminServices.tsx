import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
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
import { SearchBox } from '../../components/searchBox/searchBox';
import { ServiceForm } from '../../components/serviceForm/serviceForm';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

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

// Botón chico de las filas (Editar / Eliminar / Dar de alta)
const rowButtonClasses =
  'rounded-lg border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors';

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

// Sección Servicios del ADMIN: crear, modificar y dar de baja o de alta servicios (baja lógica)
export const AdminServices = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [services, setServices] = useState<Servicio[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Son pocos servicios: se piden una vez (con los dados de baja) y la búsqueda filtra en el navegador
  useEffect(() => {
    if (!token) return;
    let ignore = false;

    getAllServicesRequest(token)
      .then((data) => {
        if (!ignore) setServices(data);
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
    if (data.tiempoDuracion !== servicio.tiempoDuracion) changes.tiempoDuracion = data.tiempoDuracion;
    if (data.precio !== Number(servicio.precio)) changes.precio = data.precio;
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

  const isForm = pending?.type === 'crear' || pending?.type === 'editar';
  const texts = pending && (pending.type === 'baja' || pending.type === 'alta') ? confirmTexts(pending) : null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Servicios' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Servicios</Title>
            <p className="font-inter text-capilar-grey">Cargá los servicios del salón con su duración y precio.</p>
          </div>
          <Button
            onClick={() => setPending({ type: 'crear' })}
            className="shrink-0 self-start px-6 py-3 text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nuevo servicio
          </Button>
        </div>
      </div>

      <SearchBox value={search} onChange={setSearch} label="Buscar servicios" placeholder="Buscar por nombre" />

      {error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {error}
        </Alert>
      ) : isLoading ? (
        <Loader label="Cargando servicios..." className="py-12" />
      ) : (
        <List
          items={visibleServices}
          getKey={(servicio) => servicio.id}
          emptyMessage={
            services.length === 0
              ? 'Todavía no hay servicios. Creá el primero con "Nuevo servicio".'
              : 'No hay servicios que coincidan con la búsqueda.'
          }
          renderItem={(servicio) => {
            const isInactive = servicio.fechaBaja !== null;
            const duration = formatDuration(servicio.tiempoDuracion);

            return (
              <ListItem
                title={servicio.tipo}
                description={isInactive ? `${duration} · Dado de baja el ${formatDate(servicio.fechaBaja!)}` : duration}
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
                        <button
                          type="button"
                          onClick={() => setPending({ type: 'editar', servicio })}
                          aria-label={`Editar ${servicio.tipo}`}
                          className={`${rowButtonClasses} hover:border-capilar-violet hover:text-capilar-violet`}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => setPending({ type: 'baja', servicio })}
                          aria-label={`Eliminar ${servicio.tipo}`}
                          className={`${rowButtonClasses} hover:border-red-500 hover:text-red-500`}
                        >
                          Eliminar
                        </button>
                      </>
                    )}
                  </>
                }
              />
            );
          }}
        />
      )}

      <Modal
        isOpen={pending !== null}
        onClose={closeModal}
        ariaLabel={isForm ? (pending.type === 'crear' ? 'Nuevo servicio' : 'Editar servicio') : texts?.title}
      >
        {isForm && (
          <ServiceForm
            // key: al pasar de un servicio a otro, el formulario arranca de cero
            key={pending.type === 'editar' ? pending.servicio.id : 'nuevo'}
            servicio={pending.type === 'editar' ? pending.servicio : undefined}
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
              <Button variant="grey" onClick={closeModal} disabled={isSaving} className="flex-1 py-3 uppercase">
                Cancelar
              </Button>
              <Button
                onClick={confirmAction}
                disabled={isSaving}
                className="flex-1 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
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
