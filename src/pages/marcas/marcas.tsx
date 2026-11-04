import { useState } from 'react';
import type { FormEvent } from 'react';
import { toast } from 'sonner';
import { MARCA_TEXTO_MAX, createMarcaRequest, deleteMarcaRequest, formatMarca, getMarcasRequest, updateMarcaRequest } from '../../api/articulos';
import type { Marca, MarcaData } from '../../api/articulos';
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

// Ignora mayúsculas y tildes ("fidelite" encuentra "Fidelité")
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Como las devuelve el back: por razón social y línea
const ordenar = (marcas: Marca[]) => [...marcas].sort((a, b) => formatMarca(a).localeCompare(formatMarca(b), 'es'));

type PendingAction = { type: 'crear' } | { type: 'editar'; marca: Marca } | { type: 'borrar'; marca: Marca };

interface MarcaFormProps {
  marca?: Marca;
  onSubmit: (data: MarcaData) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

const MarcaForm = ({ marca, onSubmit, onCancel, isLoading, error }: MarcaFormProps) => {
  const [razonSocial, setRazonSocial] = useState(marca?.razonSocial ?? '');
  const [linea, setLinea] = useState(marca?.linea ?? '');
  const [razonError, setRazonError] = useState('');

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!razonSocial.trim()) {
      setRazonError('Ingresá el nombre de la marca');
      return;
    }
    setRazonError('');
    onSubmit({ razonSocial: razonSocial.trim(), linea: linea.trim() || null });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{marca ? 'Editar marca' : 'Nueva marca'}</Title>
        <p className="font-inter text-sm text-capilar-grey">Cargá una por cada línea de productos.</p>
      </div>
      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Marca"
          value={razonSocial}
          onChange={(event) => setRazonSocial(event.target.value)}
          maxLength={MARCA_TEXTO_MAX}
          placeholder="Ej.: Fidelité"
          error={razonError}
        />
        <FormField
          label="Línea (opcional)"
          value={linea}
          onChange={(event) => setLinea(event.target.value)}
          maxLength={MARCA_TEXTO_MAX}
          placeholder="Ej.: Argán"
        />
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
            {isLoading ? 'Guardando...' : marca ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

// Sección Marcas del ADMIN: marca + línea, para elegirlas al cargar artículos.
// Se borran de verdad (no hay baja lógica), y solo si ningún artículo las usa: si no, el back responde 409 con el motivo
export const Marcas = () => {
  const { token } = useAuth();
  const marcas = useFetch(token ? 'marcas' : null, () => getMarcasRequest(token!));
  const [search, setSearch] = useState('');
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const closeModal = () => {
    if (isSaving) return;
    setPending(null);
    setSaveError('');
  };

  const run = async (request: () => Promise<void>) => {
    setIsSaving(true);
    setSaveError('');
    try {
      await request();
      setPending(null);
    } catch (err) {
      setSaveError(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const submit = (data: MarcaData) => {
    if (pending?.type === 'crear') {
      return run(async () => {
        const creada = await createMarcaRequest(token!, data);
        marcas.setData((prev) => ordenar([...prev, creada]));
        toast.success('Marca creada', { description: `${formatMarca(creada)} ya se puede usar en los artículos.` });
      });
    }
    if (pending?.type !== 'editar') return;
    const { marca } = pending;

    const changes: Partial<MarcaData> = {};
    if (data.razonSocial !== marca.razonSocial) changes.razonSocial = data.razonSocial;
    if (data.linea !== marca.linea) changes.linea = data.linea;
    if (Object.keys(changes).length === 0) {
      setPending(null);
      return;
    }

    return run(async () => {
      const actualizada = await updateMarcaRequest(token!, marca.id, changes);
      marcas.setData((prev) => ordenar(prev.map((m) => (m.id === marca.id ? actualizada : m))));
      toast.success('Marca actualizada', { description: `Se guardaron los cambios de ${formatMarca(actualizada)}.` });
    });
  };

  const borrar = () => {
    if (pending?.type !== 'borrar') return;
    const { marca } = pending;
    return run(async () => {
      await deleteMarcaRequest(token!, marca.id);
      marcas.setData((prev) => prev.filter((m) => m.id !== marca.id));
      toast.success('Marca borrada', { description: formatMarca(marca) });
    });
  };

  const isForm = pending?.type === 'crear' || pending?.type === 'editar';

  // Son pocas: se piden una vez y la búsqueda filtra en el navegador
  const query = normalize(search.trim());
  const visibles = (marcas.data ?? []).filter((marca) => normalize(`${marca.razonSocial} ${marca.linea ?? ''}`).includes(query));

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Marcas' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Marcas</Title>
            <p className="font-inter text-capilar-grey">Las marcas y líneas de los artículos del salón.</p>
          </div>
          <Button
            onClick={() => setPending({ type: 'crear' })}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nueva marca
          </Button>
        </div>
      </div>

      <SearchBox value={search} onChange={setSearch} label="Buscar marcas" placeholder="Buscar por marca o línea" />

      {marcas.error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {marcas.error}
        </Alert>
      ) : marcas.isLoading ? (
        <Loader label="Cargando marcas..." className="py-12" />
      ) : (
        <List
          items={visibles}
          getKey={(marca) => marca.id}
          emptyMessage={
            (marcas.data ?? []).length === 0
              ? 'Todavía no hay marcas. Creá la primera con "Nueva marca".'
              : 'No hay marcas que coincidan con la búsqueda.'
          }
          renderItem={(marca) => (
            <ListItem
              title={marca.razonSocial}
              description={marca.linea ?? undefined}
              trailing={
                <>
                  <IconButton icon="editar" onClick={() => setPending({ type: 'editar', marca })} aria-label={`Editar ${formatMarca(marca)}`} />
                  <IconButton icon="eliminar" onClick={() => setPending({ type: 'borrar', marca })} aria-label={`Eliminar ${formatMarca(marca)}`} />
                </>
              }
            />
          )}
        />
      )}

      <Modal isOpen={isForm} onClose={closeModal} ariaLabel={pending?.type === 'crear' ? 'Nueva marca' : 'Editar marca'}>
        {isForm && (
          <MarcaForm
            key={pending.type === 'editar' ? pending.marca.id : 'nueva'}
            marca={pending.type === 'editar' ? pending.marca : undefined}
            onSubmit={submit}
            onCancel={closeModal}
            isLoading={isSaving}
            error={saveError}
          />
        )}
      </Modal>

      <ConfirmDialog
        isOpen={pending?.type === 'borrar'}
        onClose={closeModal}
        title="Eliminar marca"
        confirmLabel="Eliminar"
        onConfirm={borrar}
        isLoading={isSaving}
        error={saveError}
      >
        {pending?.type === 'borrar' && (
          <>
            ¿Borrar <span className="font-semibold text-black">{formatMarca(pending.marca)}</span>? Solo se puede si ningún artículo la usa, ni siquiera
            uno dado de baja.
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
