import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  PROVEEDOR_CONDICIONES_MAX,
  PROVEEDOR_EMAIL_MAX,
  PROVEEDOR_RAZON_MAX,
  PROVEEDOR_TELEFONO_MAX,
  createProveedorRequest,
  deactivateProveedorRequest,
  formatCuit,
  getProveedoresRequest,
  reactivateProveedorRequest,
  updateProveedorRequest,
} from '../../api/proveedores';
import type { Proveedor, ProveedorData } from '../../api/proveedores';
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

// Ignora mayúsculas y tildes
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

const ordenar = (proveedores: Proveedor[]) => [...proveedores].sort((a, b) => a.razonSocial.localeCompare(b.razonSocial, 'es'));

type PendingAction = { type: 'editar' | 'baja' | 'alta'; proveedor: Proveedor };

interface ProveedorFormProps {
  proveedor?: Proveedor;
  onSubmit: (data: ProveedorData) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

// El dígito verificador del CUIT lo controla el back
const ProveedorForm = ({ proveedor, onSubmit, onCancel, isLoading, error }: ProveedorFormProps) => {
  const [cuit, setCuit] = useState(proveedor ? formatCuit(proveedor.cuit) : '');
  const [razonSocial, setRazonSocial] = useState(proveedor?.razonSocial ?? '');
  const [telefono, setTelefono] = useState(proveedor?.telefono ?? '');
  const [email, setEmail] = useState(proveedor?.email ?? '');
  const [condiciones, setCondiciones] = useState(proveedor?.condicionesComerciales ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digitos = cuit.replace(/\D/g, '');
    const errors = {
      cuit: digitos.length === 11 ? undefined : 'El CUIT tiene 11 números',
      razonSocial: razonSocial.trim() ? undefined : 'Ingresá la razón social',
    };
    setFieldErrors(errors);
    if (errors.cuit || errors.razonSocial) return;
    onSubmit({
      cuit: digitos,
      razonSocial: razonSocial.trim(),
      telefono: telefono.trim() || null,
      email: email.trim() || null,
      condicionesComerciales: condiciones.trim() || null,
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="text-center">
        <Title as="h2">{proveedor ? 'Editar proveedor' : 'Nuevo proveedor'}</Title>
      </div>
      <Form onSubmit={handleSubmit} noValidate>
        <FormField label="CUIT" inputMode="numeric" value={cuit} onChange={(event) => setCuit(event.target.value)} placeholder="30-71234567-8" error={fieldErrors.cuit} />
        <FormField
          label="Razón social"
          value={razonSocial}
          onChange={(event) => setRazonSocial(event.target.value)}
          maxLength={PROVEEDOR_RAZON_MAX}
          placeholder="Ej.: Distribuidora Meraki S.R.L."
          error={fieldErrors.razonSocial}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Teléfono (opcional)"
            value={telefono}
            onChange={(event) => setTelefono(event.target.value)}
            maxLength={PROVEEDOR_TELEFONO_MAX}
            placeholder="(0299) 448-1234"
          />
          <FormField
            label="Email (opcional)"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            maxLength={PROVEEDOR_EMAIL_MAX}
            placeholder="ventas@proveedor.com.ar"
          />
        </div>
        <FormField
          label="Condiciones comerciales (opcional)"
          value={condiciones}
          onChange={(event) => setCondiciones(event.target.value)}
          maxLength={PROVEEDOR_CONDICIONES_MAX}
          placeholder="Ej.: 30 días, 5% por pago contado"
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
            {isLoading ? 'Guardando...' : proveedor ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Form>
    </div>
  );
};

// Sección Proveedores del ADMIN. El alta va en la URL (?nuevo=1) para abrirla desde el menú lateral
export const Proveedores = () => {
  const { token } = useAuth();
  const proveedores = useFetch(token ? 'proveedores' : null, () => getProveedoresRequest(token!, true));
  const [searchParams, setSearchParams] = useSearchParams();
  const creando = searchParams.get('nuevo') === '1';
  const [search, setSearch] = useState('');
  const [verBajas, setVerBajas] = useState(false);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const closeModal = () => {
    if (isSaving) return;
    setPending(null);
    setSaveError('');
    if (creando) setSearchParams({}, { replace: true });
  };

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

  const reemplazar = (actualizado: Proveedor) => proveedores.setData((prev) => ordenar(prev.map((p) => (p.id === actualizado.id ? actualizado : p))));

  const crear = (data: ProveedorData) =>
    run(async () => {
      const creado = await createProveedorRequest(token!, data);
      proveedores.setData((prev) => ordenar([...prev, creado]));
      toast.success('Proveedor creado', { description: creado.razonSocial });
    });

  const editar = (data: ProveedorData) => {
    if (pending?.type !== 'editar') return;
    const { proveedor } = pending;
    const changes: Partial<ProveedorData> = {};
    if (data.cuit !== proveedor.cuit) changes.cuit = data.cuit;
    if (data.razonSocial !== proveedor.razonSocial) changes.razonSocial = data.razonSocial;
    if (data.telefono !== proveedor.telefono) changes.telefono = data.telefono;
    if (data.email !== proveedor.email) changes.email = data.email;
    if (data.condicionesComerciales !== proveedor.condicionesComerciales) changes.condicionesComerciales = data.condicionesComerciales;
    if (Object.keys(changes).length === 0) {
      setPending(null);
      return;
    }
    return run(async () => {
      reemplazar(await updateProveedorRequest(token!, proveedor.id, changes));
      toast.success('Proveedor actualizado', { description: `Se guardaron los cambios de ${data.razonSocial}.` });
    });
  };

  const confirmar = () => {
    if (pending?.type !== 'baja' && pending?.type !== 'alta') return;
    const { type, proveedor } = pending;
    return run(async () => {
      if (type === 'baja') {
        await deactivateProveedorRequest(token!, proveedor.id);
        reemplazar({ ...proveedor, fechaBaja: new Date().toISOString() });
        toast.success('Proveedor dado de baja', { description: proveedor.razonSocial });
      } else {
        reemplazar(await reactivateProveedorRequest(token!, proveedor.id));
        toast.success('Proveedor dado de alta', { description: proveedor.razonSocial });
      }
    });
  };

  const editando = pending?.type === 'editar' ? pending.proveedor : undefined;
  const isForm = creando || editando !== undefined;

  // Son pocos: se piden una vez y la búsqueda filtra en el navegador. El CUIT se encuentra con o sin guiones
  const all = proveedores.data ?? [];
  const query = normalize(search.trim());
  const digitos = search.replace(/\D/g, '');
  const visibles = all.filter(
    (proveedor) =>
      (verBajas || proveedor.fechaBaja === null) && (normalize(proveedor.razonSocial).includes(query) || (digitos !== '' && proveedor.cuit.includes(digitos))),
  );

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Proveedores' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Proveedores</Title>
            <p className="font-inter text-capilar-grey">A quién le compra el salón y en qué condiciones.</p>
          </div>
          <Button
            onClick={() => setSearchParams({ nuevo: '1' })}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nuevo proveedor
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
        <SearchBox value={search} onChange={setSearch} label="Buscar proveedores" placeholder="Buscar por razón social o CUIT" className="sm:flex-1" />
        <label className="flex shrink-0 cursor-pointer items-center gap-2 font-inter text-sm text-black">
          <input
            type="checkbox"
            checked={verBajas}
            onChange={(event) => setVerBajas(event.target.checked)}
            className="h-4 w-4 cursor-pointer accent-capilar-violet"
          />
          Ver dados de baja
        </label>
      </div>

      {proveedores.error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {proveedores.error}
        </Alert>
      ) : proveedores.isLoading ? (
        <Loader label="Cargando proveedores..." className="py-12" />
      ) : (
        <List
          items={visibles}
          getKey={(proveedor) => proveedor.id}
          emptyMessage={all.length === 0 ? 'Todavía no hay proveedores. Creá el primero con "Nuevo proveedor".' : 'No hay proveedores que coincidan con la búsqueda.'}
          renderItem={(proveedor) => {
            const isInactive = proveedor.fechaBaja !== null;
            const detalle = [formatCuit(proveedor.cuit), proveedor.telefono].filter(Boolean).join(' · ');
            return (
              <ListItem
                title={
                  <Link to={`/panel/proveedores/${proveedor.id}`} className="hover:text-capilar-violet">
                    {proveedor.razonSocial}
                  </Link>
                }
                description={isInactive ? `${detalle} · Dado de baja` : detalle}
                className={isInactive ? 'bg-gray-50 opacity-60' : ''}
                trailing={
                  isInactive ? (
                    <button
                      type="button"
                      onClick={() => setPending({ type: 'alta', proveedor })}
                      className="rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet"
                    >
                      Dar de alta
                    </button>
                  ) : (
                    <>
                      <IconButton icon="editar" onClick={() => setPending({ type: 'editar', proveedor })} aria-label={`Editar ${proveedor.razonSocial}`} />
                      <IconButton icon="eliminar" onClick={() => setPending({ type: 'baja', proveedor })} aria-label={`Eliminar ${proveedor.razonSocial}`} />
                    </>
                  )
                }
              />
            );
          }}
        />
      )}

      <Modal isOpen={isForm} onClose={closeModal} ariaLabel={editando ? 'Editar proveedor' : 'Nuevo proveedor'} className="max-w-xl!">
        {isForm && (
          <ProveedorForm
            key={editando ? editando.id : 'nuevo'}
            proveedor={editando}
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
        title={pending?.type === 'baja' ? 'Dar de baja' : 'Dar de alta'}
        confirmLabel={pending?.type === 'baja' ? 'Dar de baja' : 'Dar de alta'}
        onConfirm={confirmar}
        isLoading={isSaving}
        error={saveError}
      >
        {pending?.type === 'baja' ? (
          <>
            ¿Dar de baja <span className="font-semibold text-black">{pending.proveedor.razonSocial}</span>? No se le van a poder cargar compras nuevas, pero
            las anteriores lo siguen mostrando.
          </>
        ) : (
          <>
            ¿Volver a dar de alta <span className="font-semibold text-black">{pending?.proveedor.razonSocial}</span>?
          </>
        )}
      </ConfirmDialog>
    </section>
  );
};
