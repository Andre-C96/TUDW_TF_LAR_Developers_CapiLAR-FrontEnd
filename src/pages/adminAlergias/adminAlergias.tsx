import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  ALERGIA_DESCRIPCION_MAX,
  ALERGIA_NOMBRE_MAX,
  createAlergiaRequest,
  deactivateAlergiaRequest,
  getAllAlergiasRequest,
  reactivateAlergiaRequest,
  updateAlergiaRequest,
} from '../../api/alergias';
import type { Alergia, AlergiaData } from '../../api/alergias';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Form, FormField } from '../../components/form/form';
import { IconButton } from '../../components/iconButton/iconButton';
import { List, ListItem } from '../../components/list/list';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SearchBox } from '../../components/searchBox/searchBox';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

// Ignora mayúsculas y tildes ("amoniaco" encuentra "Amoníaco")
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Acción elegida, a la espera del formulario o de la confirmación en el modal
type PendingAction = { type: 'editar' | 'baja' | 'alta'; alergia: Alergia };

interface AlergiaFormProps {
  alergia?: Alergia;
  onSubmit: (data: AlergiaData) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

const AlergiaForm = ({ alergia, onSubmit, onCancel, isLoading, error }: AlergiaFormProps) => {
  const [nombre, setNombre] = useState(alergia?.nombre ?? '');
  const [descripcion, setDescripcion] = useState(alergia?.descripcion ?? '');
  const [nombreError, setNombreError] = useState('');
  const descripcionId = useId();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!nombre.trim()) {
      setNombreError('Ingresá el nombre de la alergia');
      return;
    }
    setNombreError('');
    onSubmit({ nombre: nombre.trim(), descripcion: descripcion.trim() || null });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{alergia ? 'Editar alergia' : 'Nueva alergia'}</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {alergia ? 'Las clientas que la tienen ven el cambio.' : 'Las clientas la van a poder elegir en su registro y en su perfil.'}
        </p>
      </div>
      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          maxLength={ALERGIA_NOMBRE_MAX}
          placeholder="Ej.: Amoníaco"
          error={nombreError}
        />
        <div className="flex flex-col gap-2">
          <label htmlFor={descripcionId} className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
            Descripción <span className="normal-case tracking-normal">(opcional)</span>
          </label>
          <textarea
            id={descripcionId}
            value={descripcion}
            onChange={(event) => setDescripcion(event.target.value)}
            maxLength={ALERGIA_DESCRIPCION_MAX}
            rows={2}
            placeholder="Ej.: Presente en muchas tinturas permanentes."
            className="w-full resize-none rounded-lg border border-gray-300 px-4 py-3 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20"
          />
          <p className="text-right font-inter text-xs text-capilar-grey">
            {descripcion.length}/{ALERGIA_DESCRIPCION_MAX}
          </p>
        </div>
        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="px-5 py-2 text-xs uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : alergia ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

// Sección Alergias del ADMIN: la lista que eligen las clientas. La baja es lógica: deja de ofrecerse, pero quien la tiene la conserva
export const AdminAlergias = () => {
  const { token } = useAuth();
  const alergias = useFetch(token ? 'alergias-todas' : null, () => getAllAlergiasRequest(token!));
  const [search, setSearch] = useState('');

  // El formulario de alta va en la URL (?nuevo=1) para poder abrirlo desde el menú lateral
  const [searchParams, setSearchParams] = useSearchParams();
  const creando = searchParams.get('nuevo') === '1';
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

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

  const replace = (updated: Alergia) => alergias.setData((prev) => prev.map((a) => (a.id === updated.id ? updated : a)));

  const crear = (data: AlergiaData) =>
    run(async () => {
      const creada = await createAlergiaRequest(token!, data);
      alergias.setData((prev) => [...prev, creada]);
      toast.success('Alergia creada', { description: `${creada.nombre} ya se puede elegir.` });
    });

  const editar = (data: AlergiaData) => {
    if (pending?.type !== 'editar') return;
    const { alergia } = pending;

    // Solo los campos que cambiaron; sin cambios, se cierra sin llamar al back
    const changes: Partial<AlergiaData> = {};
    if (data.nombre !== alergia.nombre) changes.nombre = data.nombre;
    if (data.descripcion !== alergia.descripcion) changes.descripcion = data.descripcion;
    if (Object.keys(changes).length === 0) {
      setPending(null);
      return;
    }

    return run(async () => {
      const actualizada = await updateAlergiaRequest(token!, alergia.id, changes);
      replace(actualizada);
      toast.success('Alergia actualizada', { description: `Se guardaron los cambios de ${actualizada.nombre}.` });
    });
  };

  const confirmar = () => {
    if (!pending) return;
    const { type, alergia } = pending;
    return run(async () => {
      if (type === 'baja') {
        await deactivateAlergiaRequest(token!, alergia.id);
        replace({ ...alergia, fechaBaja: new Date().toISOString() });
        toast.success('Alergia dada de baja', { description: `${alergia.nombre} ya no se ofrece.` });
      } else {
        const actualizada = await reactivateAlergiaRequest(token!, alergia.id);
        replace(actualizada);
        toast.success('Alergia dada de alta', { description: `${actualizada.nombre} se puede elegir de nuevo.` });
      }
    });
  };

  const all = alergias.data ?? [];
  const query = normalize(search.trim());
  // Filtradas por nombre; activas primero y dadas de baja al final (dentro de cada grupo, orden alfabético)
  const visibles = all
    .filter((alergia) => normalize(`${alergia.nombre} ${alergia.descripcion ?? ''}`).includes(query))
    .sort((a, b) => Number(a.fechaBaja !== null) - Number(b.fechaBaja !== null) || a.nombre.localeCompare(b.nombre, 'es'));

  const editando = pending?.type === 'editar' ? pending.alergia : undefined;
  const isForm = creando || editando !== undefined;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Alergias' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Alergias</Title>
            <p className="font-inter text-capilar-grey">La lista que eligen las clientas en su registro y en su perfil.</p>
          </div>
          <Button
            onClick={() => setSearchParams({ nuevo: '1' })}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nueva alergia
          </Button>
        </div>
      </div>

      <SearchBox value={search} onChange={setSearch} label="Buscar alergias" placeholder="Buscar por nombre" />

      {alergias.error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {alergias.error}
        </Alert>
      ) : alergias.isLoading ? (
        <Loader label="Cargando alergias..." className="py-12" />
      ) : (
        <List
          items={visibles}
          getKey={(alergia) => alergia.id}
          emptyMessage={all.length === 0 ? 'Todavía no hay alergias. Creá la primera con "Nueva alergia".' : 'No hay alergias que coincidan con la búsqueda.'}
          renderItem={(alergia) => {
            const isInactive = alergia.fechaBaja !== null;
            const detalle = alergia.descripcion ?? '';
            return (
              <ListItem
                title={alergia.nombre}
                description={isInactive ? [detalle, 'Dada de baja'].filter(Boolean).join(' · ') : detalle || undefined}
                className={isInactive ? 'bg-gray-50 opacity-60' : ''}
                trailing={
                  isInactive ? (
                    <button
                      type="button"
                      onClick={() => setPending({ type: 'alta', alergia })}
                      className="rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet"
                    >
                      Dar de alta
                    </button>
                  ) : (
                    <>
                      <IconButton icon="editar" onClick={() => setPending({ type: 'editar', alergia })} aria-label={`Editar ${alergia.nombre}`} />
                      <IconButton icon="eliminar" onClick={() => setPending({ type: 'baja', alergia })} aria-label={`Eliminar ${alergia.nombre}`} />
                    </>
                  )
                }
              />
            );
          }}
        />
      )}

      <Modal isOpen={isForm} onClose={closeModal} ariaLabel={editando ? 'Editar alergia' : 'Nueva alergia'}>
        {isForm && (
          <AlergiaForm
            key={editando ? editando.id : 'nueva'}
            alergia={editando}
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
        title={pending?.type === 'baja' ? 'Eliminar alergia' : 'Dar de alta'}
        confirmLabel={pending?.type === 'baja' ? 'Eliminar' : 'Dar de alta'}
        onConfirm={confirmar}
        isLoading={isSaving}
        error={saveError}
      >
        {pending?.type === 'baja' ? (
          <>
            ¿Dar de baja <span className="font-semibold text-black">{pending.alergia.nombre}</span>? Deja de ofrecerse, pero las clientas que ya la tienen la
            conservan. La podés volver a dar de alta cuando quieras.
          </>
        ) : (
          <>
            ¿Volver a dar de alta <span className="font-semibold text-black">{pending?.alergia.nombre}</span>?
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
