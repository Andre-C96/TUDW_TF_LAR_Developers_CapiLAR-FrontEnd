import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import type { Rol, Usuario } from '../../api/auth';
import { ApiError } from '../../api/client';
import {
  deactivateUserRequest,
  getUsersRequest,
  reactivateUserRequest,
  updateUserRoleRequest,
} from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { List, ListItem } from '../../components/list/list';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { IconButton } from '../../components/iconButton/iconButton';
import { SearchBox } from '../../components/searchBox/searchBox';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

const roles: Rol[] = ['CLIENTE', 'PROFESIONAL', 'ADMIN'];

// Filtros del listado ('' = todos)
// Sin ninguno elegido se ven todos
const filters: { label: string; rol: Rol }[] = [
  { label: 'Clientes', rol: 'CLIENTE' },
  { label: 'Profesionales', rol: 'PROFESIONAL' },
  { label: 'Admins', rol: 'ADMIN' },
];

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Acción elegida en una fila, a la espera de confirmación en el modal
type PendingAction =
  | { type: 'rol'; user: Usuario; rol: Rol }
  | { type: 'baja'; user: Usuario }
  | { type: 'alta'; user: Usuario };

const fullName = (user: Usuario) => `${user.nombre} ${user.apellido}`;

const formatDate = (iso: string) => new Date(iso).toLocaleDateString('es-AR');

// Botón chico de las filas con texto (Dar de alta); eliminar va con IconButton
const rowButtonClasses =
  'rounded-[6px] border border-gray-300 bg-white px-3 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors';

// Círculo con las iniciales del usuario (gris si está dado de baja)
const Avatar = ({ user }: { user: Usuario }) => (
  <span
    aria-hidden="true"
    className={`flex h-10 w-10 items-center justify-center rounded-full font-inter text-sm font-semibold text-white ${
      user.fechaBaja ? 'bg-gray-300' : 'bg-capilar-gradient'
    }`}
  >
    {user.nombre[0]}
    {user.apellido[0]}
  </span>
);

// Textos del modal según la acción
const confirmTexts = (action: PendingAction): { title: string; question: ReactNode; detail?: ReactNode; confirm: string } => {
  const name = <span className="font-semibold text-black">{fullName(action.user)}</span>;

  switch (action.type) {
    case 'rol':
      return {
        title: 'Cambiar rol',
        question: <>¿Cambiar el rol de {name}?</>,
        detail: (
          <p className="text-center font-inter text-sm font-semibold tracking-widest">
            <span className="text-capilar-grey">{action.user.rol}</span>
            <span aria-hidden="true" className="mx-3 text-capilar-violet">
              →
            </span>
            <span className="sr-only"> a </span>
            <span className="bg-capilar-gradient bg-clip-text text-transparent">{action.rol}</span>
          </p>
        ),
        confirm: 'Confirmar',
      };
    case 'baja':
      return {
        title: 'Eliminar usuario',
        question: <>¿Dar de baja a {name}?</>,
        detail: (
          <p className="text-center font-inter text-sm text-capilar-grey">
            No va a poder iniciar sesión. Sus datos se conservan y podés volver a darlo de alta cuando quieras.
          </p>
        ),
        confirm: 'Eliminar',
      };
    case 'alta':
      return {
        title: 'Dar de alta',
        question: <>¿Volver a dar de alta a {name}?</>,
        detail: <p className="text-center font-inter text-sm text-capilar-grey">Va a poder iniciar sesión de nuevo.</p>,
        confirm: 'Dar de alta',
      };
  }
};

// Sección Usuarios del ADMIN (F02): buscar usuarios, cambiarles el rol y darlos de baja o de alta (baja lógica)
export const Users = () => {
  const { user: me, token } = useAuth();
  const [search, setSearch] = useState('');
  const [rolFilter, setRolFilter] = useState<Rol | ''>('');
  const [users, setUsers] = useState<Usuario[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');

  const [pending, setPending] = useState<PendingAction | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Pide el listado al cambiar la búsqueda o el filtro (la búsqueda espera a que se deje de escribir)
  useEffect(() => {
    if (!token) return;
    let ignore = false;

    const timer = setTimeout(
      async () => {
        setIsLoading(true);
        setError('');
        try {
          const data = await getUsersRequest(token, { search: search.trim(), rol: rolFilter || undefined });
          if (!ignore) setUsers(data);
        } catch (err) {
          if (!ignore) setError(err instanceof ApiError ? err.message : unexpectedError);
        } finally {
          if (!ignore) setIsLoading(false);
        }
      },
      search ? 300 : 0,
    );

    return () => {
      ignore = true;
      clearTimeout(timer);
    };
  }, [token, search, rolFilter]);

  // Activos primero y dados de baja al final (sort estable: dentro de cada grupo se mantiene el orden del back)
  const sortedUsers = [...users].sort((a, b) => Number(a.fechaBaja !== null) - Number(b.fechaBaja !== null));

  const replaceUser = (id: number, changes: Partial<Usuario>) =>
    setUsers((prev) =>
      prev
        .map((user) => (user.id === id ? { ...user, ...changes } : user))
        // Si hay un filtro de rol y el usuario ya no entra en él, sale de la lista
        .filter((user) => !rolFilter || user.rol === rolFilter),
    );

  const closeModal = () => {
    if (isSaving) return;
    setPending(null);
    setSaveError('');
  };

  const confirmAction = async () => {
    if (!pending || !token) return;
    const { user } = pending;
    setIsSaving(true);
    setSaveError('');
    try {
      if (pending.type === 'rol') {
        // Se usa lo que devuelve el back: al pasar a PROFESIONAL trae su legajo nuevo
        const updated = await updateUserRoleRequest(token, user.id, pending.rol);
        replaceUser(user.id, updated);
        toast.success('Rol actualizado', { description: `${fullName(user)} ahora es ${pending.rol}.` });
      } else if (pending.type === 'baja') {
        await deactivateUserRequest(token, user.id);
        replaceUser(user.id, { fechaBaja: new Date().toISOString() });
        toast.success('Usuario dado de baja', { description: `${fullName(user)} ya no puede iniciar sesión.` });
      } else {
        await reactivateUserRequest(token, user.id);
        replaceUser(user.id, { fechaBaja: null });
        toast.success('Usuario dado de alta', { description: `${fullName(user)} puede volver a iniciar sesión.` });
      }
      setPending(null);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  const texts = pending && confirmTexts(pending);

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Usuarios' }]} />
        <div className="flex flex-col gap-2">
          <Title>Usuarios</Title>
          <p className="font-inter text-capilar-grey">Buscá usuarios y administrá sus roles.</p>
        </div>
      </div>

      {/* Filtros por rol y buscador en un mismo recuadro (como la agenda) */}
      <div className="flex flex-col gap-3 rounded-[6px] border border-gray-200 bg-white p-4 shadow-sm lg:flex-row lg:items-center">
        <div role="group" aria-label="Filtrar por rol" className="flex flex-wrap items-center gap-2">
          <span className="mr-1 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">Filtros</span>
          {filters.map((filter) => {
            // El elegido se quita con la ✕ (vuelven a verse todos)
            const isActive = rolFilter === filter.rol;
            return (
              <span
                key={filter.label}
                className={`inline-flex items-center rounded-[6px] border font-inter text-sm transition-colors ${
                  isActive
                    ? 'border-capilar-violet bg-purple-50 font-semibold text-capilar-violet'
                    : 'border-gray-300 bg-white font-medium text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
                }`}
              >
                <button
                  type="button"
                  onClick={() => setRolFilter(filter.rol)}
                  aria-pressed={isActive}
                  className={`py-1.5 pl-3 ${isActive ? 'pr-1.5' : 'pr-3'}`}
                >
                  {filter.label}
                </button>
                {isActive && (
                  <button
                    type="button"
                    onClick={() => setRolFilter('')}
                    aria-label={`Quitar el filtro ${filter.label}`}
                    title="Quitar filtro"
                    className="group mr-1.5 flex h-5 w-5 items-center justify-center text-capilar-violet"
                  >
                    {/* Cruz fina que se pone en negrita al pasar el mouse (el carácter ✕ no cambia de grosor) */}
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      aria-hidden="true"
                      className="h-2.5 w-2.5 stroke-2 transition-[stroke-width] group-hover:stroke-[4]"
                    >
                      <path d="M6 6l12 12M18 6 6 18" />
                    </svg>
                  </button>
                )}
              </span>
            );
          })}
        </div>
        <SearchBox
          value={search}
          onChange={setSearch}
          label="Buscar usuarios"
          placeholder="Buscar por nombre, apellido o correo"
          compact
          className="lg:ml-auto lg:max-w-sm"
        />
      </div>

      {error ? (
        <Alert variant="error" title="No se pudo cargar el listado">
          {error}
        </Alert>
      ) : isLoading ? (
        <Loader label="Cargando usuarios..." className="py-12" />
      ) : (
        <List
          items={sortedUsers}
          getKey={(user) => user.id}
          emptyMessage="No hay usuarios que coincidan con la búsqueda."
          renderItem={(user) => {
            const isMe = user.id === me?.id;
            const isInactive = user.fechaBaja !== null;
            const contact = user.telefono ? `${user.email} · ${user.telefono}` : user.email;

            return (
              <ListItem
                leading={<Avatar user={user} />}
                title={isMe ? `${fullName(user)} (vos)` : fullName(user)}
                description={isInactive ? `${contact} · Dado de baja el ${formatDate(user.fechaBaja!)}` : contact}
                className={isInactive ? 'bg-gray-50 opacity-60' : ''}
                trailing={
                  isInactive ? (
                    // Dado de baja: rol solo como texto y opción de volver a darlo de alta
                    <>
                      <span className="font-inter text-xs font-semibold tracking-widest text-capilar-grey">
                        {user.rol}
                      </span>
                      <button
                        type="button"
                        onClick={() => setPending({ type: 'alta', user })}
                        className={`${rowButtonClasses} hover:border-capilar-violet hover:text-capilar-violet`}
                      >
                        Dar de alta
                      </button>
                    </>
                  ) : isMe ? (
                    // El admin no puede cambiarse su propio rol ni darse de baja
                    <span className="font-inter text-xs font-semibold tracking-widest text-capilar-grey">
                      {user.rol}
                    </span>
                  ) : (
                    // Rol · eliminar
                    <>
                      <span className="relative">
                        <select
                          value={user.rol}
                          onChange={(event) => setPending({ type: 'rol', user, rol: event.target.value as Rol })}
                          aria-label={`Rol de ${fullName(user)}`}
                          className="cursor-pointer appearance-none rounded-[6px] border border-gray-300 bg-white py-2 pr-9 pl-3 font-inter text-xs font-semibold tracking-widest text-black outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20"
                        >
                          {roles.map((rol) => (
                            <option key={rol} value={rol}>
                              {rol}
                            </option>
                          ))}
                        </select>
                        {/* Flecha propia (la del navegador queda pegada al borde y no se puede correr) */}
                        <svg
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth={2.5}
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          aria-hidden="true"
                          className="pointer-events-none absolute top-1/2 right-3 h-3.5 w-3.5 -translate-y-1/2 text-capilar-grey"
                        >
                          <path d="M6 9l6 6 6-6" />
                        </svg>
                      </span>
                      <IconButton icon="eliminar" onClick={() => setPending({ type: 'baja', user })} aria-label={`Eliminar a ${fullName(user)}`} />
                    </>
                  )
                }
              />
            );
          }}
        />
      )}

      <Modal isOpen={pending !== null} onClose={closeModal} ariaLabel={texts?.title}>
        {texts && (
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2 text-center">
              <Title as="h2">{texts.title}</Title>
              <p className="font-inter text-sm text-capilar-grey">{texts.question}</p>
            </div>

            {texts.detail}

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
