import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import {
  CATEGORIA_NOMBRE_MAX,
  createCategoriaRequest,
  deactivateCategoriaRequest,
  reactivateCategoriaRequest,
  updateCategoriaRequest,
} from '../../api/categorias';
import type { Categoria } from '../../api/categorias';
import type { Servicio } from '../../api/services';
import { Button } from '../../components/button/button';
import { Form, FormField } from '../../components/form/form';
import { IconButton } from '../../components/iconButton/iconButton';
import { List, ListItem } from '../../components/list/list';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

const rowButtonClasses =
  'rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet';

type PendingAction =
  | { type: 'crear' }
  | { type: 'renombrar'; categoria: Categoria }
  | { type: 'baja'; categoria: Categoria }
  | { type: 'alta'; categoria: Categoria };

interface AdminCategoriasProps {
  token: string;
  // Todas, incluidas las dadas de baja
  categorias: Categoria[];
  // Para contar los servicios de cada una
  servicios: Servicio[];
  onCategoriasChange: (update: (prev: Categoria[]) => Categoria[]) => void;
  // Al renombrar: el nombre nuevo se ve también en sus servicios
  onRenamed: (categoria: Categoria) => void;
}

// "3 servicios activos", "1 servicio activo", "Sin servicios"
const formatCantidad = (activos: number) =>
  activos === 0 ? 'Sin servicios activos' : `${activos} ${activos === 1 ? 'servicio activo' : 'servicios activos'}`;

// Pestaña Categorías de la sección Servicios del ADMIN: crear, renombrar y dar de baja o de alta (baja lógica)
export const AdminCategorias = ({ token, categorias, servicios, onCategoriasChange, onRenamed }: AdminCategoriasProps) => {
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [nombre, setNombre] = useState('');
  const [fieldError, setFieldError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Activas primero y dadas de baja al final, por nombre
  const visibles = [...categorias].sort(
    (a, b) => Number(a.fechaBaja !== null) - Number(b.fechaBaja !== null) || a.nombre.localeCompare(b.nombre, 'es'),
  );
  const activosDe = (id: number) => servicios.filter((s) => s.categoria.id === id && s.fechaBaja === null).length;

  const open = (action: PendingAction) => {
    setPending(action);
    setNombre(action.type === 'renombrar' ? action.categoria.nombre : '');
    setFieldError('');
    setSaveError('');
  };

  const close = () => {
    if (isSaving) return;
    setPending(null);
  };

  const replace = (updated: Categoria) =>
    onCategoriasChange((prev) => prev.map((categoria) => (categoria.id === updated.id ? updated : categoria)));

  // Corre la request del modal: maneja el estado de guardado, el error (ej. el 409 del back) y el cierre
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

  const submitNombre = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!pending || (pending.type !== 'crear' && pending.type !== 'renombrar')) return;

    const value = nombre.trim();
    const error = !value ? 'Ingresá el nombre' : value.length > CATEGORIA_NOMBRE_MAX ? `Hasta ${CATEGORIA_NOMBRE_MAX} caracteres` : '';
    setFieldError(error);
    if (error) return;

    if (pending.type === 'crear') {
      return run(async () => {
        const created = await createCategoriaRequest(token, value);
        onCategoriasChange((prev) => [...prev, created]);
        toast.success('Categoría creada', { description: `Ya podés asignarle servicios a ${created.nombre}.` });
      });
    }

    const { categoria } = pending;
    if (value === categoria.nombre) {
      setPending(null);
      return;
    }
    return run(async () => {
      const updated = await updateCategoriaRequest(token, categoria.id, value);
      replace(updated);
      onRenamed(updated);
      toast.success('Categoría renombrada', { description: `Ahora se llama ${updated.nombre}.` });
    });
  };

  const confirm = () => {
    if (pending?.type === 'baja') {
      const { categoria } = pending;
      return run(async () => {
        await deactivateCategoriaRequest(token, categoria.id);
        replace({ ...categoria, fechaBaja: new Date().toISOString() });
        toast.success('Categoría dada de baja', { description: `${categoria.nombre} ya no se ofrece para los servicios.` });
      });
    }
    if (pending?.type === 'alta') {
      return run(async () => {
        const updated = await reactivateCategoriaRequest(token, pending.categoria.id);
        replace(updated);
        toast.success('Categoría dada de alta', { description: `${updated.nombre} se puede usar de nuevo.` });
      });
    }
  };

  const isForm = pending?.type === 'crear' || pending?.type === 'renombrar';
  const confirmTexts: { title: string; question: ReactNode; detail: string; confirm: string } | null =
    pending?.type === 'baja'
      ? {
          title: 'Eliminar categoría',
          question: (
            <>
              ¿Dar de baja la categoría <span className="font-semibold text-black">{pending.categoria.nombre}</span>?
            </>
          ),
          detail: 'Deja de ofrecerse para los servicios. Solo se puede si no tiene servicios activos.',
          confirm: 'Eliminar',
        }
      : pending?.type === 'alta'
        ? {
            title: 'Dar de alta',
            question: (
              <>
                ¿Volver a dar de alta la categoría <span className="font-semibold text-black">{pending.categoria.nombre}</span>?
              </>
            ),
            detail: 'Va a poder asignarse de nuevo a los servicios.',
            confirm: 'Dar de alta',
          }
        : null;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <p className="font-inter text-sm text-capilar-grey">
          Agrupan los servicios en la reserva y en este listado. Cada servicio tiene una.
        </p>
        <Button
          onClick={() => open({ type: 'crear' })}
          className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
        >
          Nueva categoría
        </Button>
      </div>

      <List
        items={visibles}
        getKey={(categoria) => categoria.id}
        emptyMessage='Todavía no hay categorías. Creá la primera con "Nueva categoría".'
        renderItem={(categoria) => {
          const isInactive = categoria.fechaBaja !== null;
          return (
            <ListItem
              title={categoria.nombre}
              description={
                isInactive
                  ? `Dada de baja el ${new Date(categoria.fechaBaja!).toLocaleDateString('es-AR')}`
                  : formatCantidad(activosDe(categoria.id))
              }
              className={isInactive ? 'bg-gray-50 opacity-60' : ''}
              trailing={
                isInactive ? (
                  <button type="button" onClick={() => open({ type: 'alta', categoria })} className={rowButtonClasses}>
                    Dar de alta
                  </button>
                ) : (
                  <>
                    <IconButton icon="editar" onClick={() => open({ type: 'renombrar', categoria })} aria-label={`Renombrar ${categoria.nombre}`} />
                    <IconButton icon="eliminar" onClick={() => open({ type: 'baja', categoria })} aria-label={`Eliminar ${categoria.nombre}`} />
                  </>
                )
              }
            />
          );
        }}
      />

      <Modal
        isOpen={pending !== null}
        onClose={close}
        ariaLabel={isForm ? (pending.type === 'crear' ? 'Nueva categoría' : 'Renombrar categoría') : confirmTexts?.title}
        // Las confirmaciones se cierran al tocar afuera; el formulario no
        closeOnBackdrop={!isForm}
      >
        {isForm && (
          <div className="flex flex-col gap-6">
            <Title as="h2" className="text-center">
              {pending.type === 'crear' ? 'Nueva categoría' : 'Renombrar categoría'}
            </Title>
            <Form onSubmit={submitNombre} noValidate>
              <FormField
                label="Nombre"
                value={nombre}
                onChange={(event) => setNombre(event.target.value)}
                maxLength={CATEGORIA_NOMBRE_MAX}
                placeholder="Ej.: Color"
                error={fieldError}
              />
              {saveError && (
                <p role="alert" className="text-center font-inter text-sm text-red-500">
                  {saveError}
                </p>
              )}
              <div className="flex justify-end gap-3">
                <Button type="button" variant="grey" onClick={close} disabled={isSaving} className="px-5 py-2 text-xs uppercase">
                  Cancelar
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isSaving ? 'Guardando...' : pending.type === 'crear' ? 'Crear' : 'Guardar'}
                </Button>
              </div>
            </Form>
          </div>
        )}

        {confirmTexts && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <Title as="h2">{confirmTexts.title}</Title>
              <p className="font-inter text-sm text-capilar-grey">{confirmTexts.question}</p>
            </div>
            <p className="text-center font-inter text-sm text-capilar-grey">{confirmTexts.detail}</p>
            {saveError && (
              <p role="alert" className="text-center font-inter text-sm text-red-500">
                {saveError}
              </p>
            )}
            <div className="flex gap-3">
              <Button variant="grey" onClick={close} disabled={isSaving} className="flex-1 py-2 text-sm uppercase">
                Cancelar
              </Button>
              <Button
                onClick={confirm}
                disabled={isSaving}
                className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isSaving ? 'Guardando...' : confirmTexts.confirm}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
