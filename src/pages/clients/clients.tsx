import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { searchClientsRequest } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Avatar } from '../../components/avatar/avatar';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Loader } from '../../components/loader/loader';
import { SearchBox } from '../../components/searchBox/searchBox';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

// Clientes del salón (PROFESIONAL): todos los activos por apellido, o los que coinciden con la búsqueda
// (nombre, apellido, correo o parte del teléfono). Cada uno lleva a su perfil con el historial de fichas.
export const Clients = () => {
  const { token } = useAuth();
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');

  // Espera a que se deje de escribir para no pedir en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const clients = useFetch(token ? `clientes-${debounced}` : null, () => searchClientsRequest(token!, debounced));

  if (!token) return null;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Clientes' }]} />
        <div className="flex flex-col gap-2">
          <Title>Clientes</Title>
          <p className="font-inter text-capilar-grey">Buscá un cliente para ver sus datos y su historial de fichas.</p>
        </div>
      </div>

      <SearchBox value={search} onChange={setSearch} label="Buscar clientes" placeholder="Buscar por nombre, apellido, correo o teléfono" />

      {clients.error ? (
        <Alert variant="error" title="No se pudieron cargar los clientes">
          {clients.error}
        </Alert>
      ) : clients.isLoading ? (
        <Loader label="Buscando clientes..." className="py-12" />
      ) : clients.data?.length === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">
          {debounced ? 'No encontramos clientes con esa búsqueda.' : 'Todavía no hay clientes registrados.'}
        </p>
      ) : (
        <ul className="divide-y divide-gray-200 overflow-hidden rounded-[6px] border border-gray-200 bg-white shadow-md">
          {clients.data?.map((c) => (
            <li key={c.id}>
              <Link
                to={`/panel/clientes/${c.id}`}
                className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-capilar-violet/5 focus-visible:bg-capilar-violet/5 focus-visible:outline-none"
              >
                <Avatar
                  token={token}
                  userId={c.id}
                  nombre={c.nombre}
                  apellido={c.apellido}
                  foto={c.cliente?.foto ?? null}
                  className="h-11 w-11 text-sm shadow-none!"
                />
                <span className="flex min-w-0 flex-1 flex-col font-inter text-sm">
                  <span className="font-semibold text-black">
                    {c.apellido}, {c.nombre}
                  </span>
                  <span className="truncate text-capilar-grey">
                    {c.telefono && `${c.telefono} · `}
                    {c.email}
                  </span>
                </span>
                {c.cliente?.alergia && (
                  <span className="hidden shrink-0 rounded-md bg-amber-50 px-2 py-1 font-inter text-xs text-amber-800 sm:inline">
                    Alergias
                  </span>
                )}
                <span aria-hidden="true" className="text-xl text-capilar-grey">
                  ›
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
};
