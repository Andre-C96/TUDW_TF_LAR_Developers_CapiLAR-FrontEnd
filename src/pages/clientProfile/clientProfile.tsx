import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { getClientFichasRequest } from '../../api/fichas';
import { getClientRequest } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Avatar } from '../../components/avatar/avatar';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { FichaTecnica } from '../../components/fichaTecnica/fichaTecnica';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

const tabs = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'historial', label: 'Historial' },
] as const;

type TabId = (typeof tabs)[number]['id'];

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{label}</dt>
    <dd className="font-inter text-sm text-black">{children}</dd>
  </div>
);

// Perfil de un cliente para el profesional: foto y datos de contacto, y su historial de fichas técnicas
// (de cualquier profesional, de la más nueva a la más vieja). "Nuevo turno" abre la agenda con el cliente elegido.
// La pestaña va en la URL (?tab=) para que sobreviva a la recarga.
export const ClientProfile = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tab: TabId = searchParams.get('tab') === 'historial' ? 'historial' : 'perfil';

  const cliente = useFetch(token && id ? `cliente-${id}` : null, () => getClientRequest(token!, id));
  // El historial se pide al abrir su pestaña
  const fichas = useFetch(token && id && tab === 'historial' ? `fichas-cliente-${id}` : null, () => getClientFichasRequest(token!, id));

  if (!token) return null;

  const c = cliente.data;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <Breadcrumbs
        items={[{ label: 'Panel', to: '/panel' }, { label: 'Clientes', to: '/panel/clientes' }, { label: c ? `${c.nombre} ${c.apellido}` : 'Cliente' }]}
      />

      {cliente.error || !id ? (
        <Alert variant="error" title="No se pudo cargar el cliente">
          {cliente.error || 'El enlace no es válido.'}
        </Alert>
      ) : !c ? (
        <Loader label="Cargando cliente..." className="py-12" />
      ) : (
        <>
          <div className="flex flex-col items-center gap-6 text-center md:flex-row md:text-left">
            <Avatar token={token} userId={c.id} nombre={c.nombre} apellido={c.apellido} foto={c.cliente?.foto ?? null} />
            <div className="flex flex-1 flex-col gap-2">
              <Title>
                {c.nombre} {c.apellido}
              </Title>
              {c.cliente?.alergia && (
                <span className="self-center rounded-md bg-amber-50 px-2 py-1 font-inter text-xs text-amber-800 md:self-start">
                  Alergias: {c.cliente.alergia}
                </span>
              )}
            </div>
            <Button
              onClick={() => navigate(`/panel/agenda?tab=nuevo&cliente=${c.id}`)}
              className="shrink-0 px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider"
            >
              Nuevo turno
            </Button>
          </div>

          <div role="tablist" aria-label="Secciones del cliente" className="flex gap-6 border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => setSearchParams(t.id === 'perfil' ? {} : { tab: t.id }, { replace: true })}
                className={`-mb-px border-b-2 pb-3 font-inter text-sm font-semibold uppercase tracking-widest transition-colors ${
                  tab === t.id ? 'border-capilar-violet text-black' : 'border-transparent text-capilar-grey hover:text-capilar-violet'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'perfil' ? (
              <dl className="grid gap-6 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md sm:grid-cols-2 md:p-8">
                <Dato label="Correo electrónico">
                  {c.email}
                  {!c.emailVerificadoEn && (
                    <span
                      title="Todavía no verificó su correo: puede no recibir los avisos de los turnos"
                      className="ml-2 rounded-md bg-gray-100 px-2 py-0.5 text-xs text-capilar-grey"
                    >
                      Sin verificar
                    </span>
                  )}
                </Dato>
                <Dato label="Teléfono">{c.telefono ?? <span className="text-capilar-grey">Sin cargar</span>}</Dato>
                <Dato label="Alergias">{c.cliente?.alergia ?? <span className="text-capilar-grey">No informó</span>}</Dato>
              </dl>
            ) : fichas.error ? (
              <Alert variant="error" title="No se pudo cargar el historial">
                {fichas.error}
              </Alert>
            ) : fichas.isLoading ? (
              <Loader label="Cargando historial..." className="py-12" />
            ) : fichas.data?.length === 0 ? (
              <p className="py-8 text-center font-inter text-sm text-capilar-grey">Todavía no tiene fichas técnicas.</p>
            ) : (
              <div className="flex flex-col gap-4">
                {/* Todas cerradas: cada una se despliega al tocarla */}
                {fichas.data?.map((ficha) => (
                  <FichaTecnica key={ficha.id} token={token} ficha={ficha} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </section>
  );
};
