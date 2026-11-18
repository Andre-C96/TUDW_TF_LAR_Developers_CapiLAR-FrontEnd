import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { formatAlergias } from '../../api/alergias';
import { getClientFichasRequest } from '../../api/fichas';
import type { Ficha } from '../../api/fichas';
import { fromIsoDate, getClientTurnosRequest, toIsoDate } from '../../api/turnos';
import type { Turno } from '../../api/turnos';
import { getClientRequest } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Avatar } from '../../components/avatar/avatar';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Collapsible, CountBadge } from '../../components/collapsible/collapsible';
import { FichaTecnica } from '../../components/fichaTecnica/fichaTecnica';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { TurnoCard, TurnoList } from '../../components/turnoCard/turnoCard';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FichaEditModal } from '../agenda/fichaEditModal';

const tabs = [
  { id: 'perfil', label: 'Perfil' },
  { id: 'turnos', label: 'Turnos' },
  { id: 'historial', label: 'Historial' },
] as const;

const ESTADOS_ACTIVOS: Turno['estado'][] = ['PENDIENTE', 'CONFIRMADO', 'REPROGRAMADO'];

// "12 de marzo de 1990 · 36 años"
const formatNacimiento = (fecha: string) => {
  const nacimiento = fromIsoDate(fecha);
  const hoy = new Date();
  const cumplioEsteAnio = hoy.getMonth() > nacimiento.getMonth() || (hoy.getMonth() === nacimiento.getMonth() && hoy.getDate() >= nacimiento.getDate());
  const edad = hoy.getFullYear() - nacimiento.getFullYear() - (cumplioEsteAnio ? 0 : 1);
  return `${nacimiento.toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })} · ${edad} años`;
};

// Los próximos (activos, de hoy en adelante) del más cercano al más lejano; el resto, del más nuevo al más viejo
const TurnosDeLaClienta = ({ turnos }: { turnos: Turno[] }) => {
  const hoy = toIsoDate(new Date());
  const proximos = turnos.filter((turno) => ESTADOS_ACTIVOS.includes(turno.estado) && turno.fecha >= hoy).reverse();
  const anteriores = turnos.filter((turno) => !proximos.includes(turno));

  if (turnos.length === 0) return <p className="py-8 text-center font-inter text-sm text-capilar-grey">Todavía no tiene turnos.</p>;

  return (
    <div className="flex flex-col gap-8">
      <section className="flex flex-col gap-4">
        <h2 className="flex items-center gap-3 border-b border-gray-200 pb-3 font-inter text-xl font-semibold text-black md:text-2xl">
          Próximos <CountBadge color="violeta">{proximos.length}</CountBadge>
        </h2>
        {proximos.length === 0 ? (
          <p className="font-inter text-sm text-capilar-grey">No tiene turnos próximos.</p>
        ) : (
          <TurnoList>
            {proximos.map((turno) => (
              <TurnoCard key={turno.id} turno={turno} enLista sinCliente />
            ))}
          </TurnoList>
        )}
      </section>
      {anteriores.length > 0 && (
        <Collapsible title="Anteriores" aside={<CountBadge>{anteriores.length}</CountBadge>}>
          <TurnoList>
            {anteriores.map((turno) => (
              <TurnoCard key={turno.id} turno={turno} enLista sinCliente />
            ))}
          </TurnoList>
        </Collapsible>
      )}
    </div>
  );
};

type TabId = (typeof tabs)[number]['id'];

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{label}</dt>
    <dd className="font-inter text-sm text-black">{children}</dd>
  </div>
);

// Perfil de un cliente para el profesional: foto y datos de contacto, sus turnos con el salón y su historial de fichas
// técnicas (de cualquier profesional, de la más nueva a la más vieja). "Nuevo turno" abre la agenda con el cliente elegido.
// La pestaña va en la URL (?tab=) para que sobreviva a la recarga.
export const ClientProfile = () => {
  const { token, user } = useAuth();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabId = tabs.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'perfil';

  const cliente = useFetch(token && id ? `cliente-${id}` : null, () => getClientRequest(token!, id));
  // Los turnos y el historial se piden al abrir su pestaña
  const turnos = useFetch(token && id && tab === 'turnos' ? `turnos-cliente-${id}` : null, () => getClientTurnosRequest(token!, id));
  const fichas = useFetch(token && id && tab === 'historial' ? `fichas-cliente-${id}` : null, () => getClientFichasRequest(token!, id));

  // Cada profesional edita solo las fichas de sus servicios
  const [editando, setEditando] = useState<Ficha | null>(null);
  const legajo = user?.profesional?.legajo;

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
              {formatAlergias(c.cliente) && (
                <span className="self-center rounded-md bg-amber-50 px-2 py-1 font-inter text-xs text-amber-800 md:self-start">
                  Alergias: {formatAlergias(c.cliente)}
                </span>
              )}
            </div>
            {/* A una clienta dada de baja no se le pueden dar turnos */}
            {c.fechaBaja === null && (
              <Button
                onClick={() => navigate(`/panel/agenda?tab=nuevo&cliente=${c.id}`)}
                className="shrink-0 px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider"
              >
                Nuevo turno
              </Button>
            )}
          </div>

          {c.fechaBaja !== null && (
            <Alert variant="advertencia" title="Dada de baja">
              Dio de baja su cuenta el {new Date(c.fechaBaja).toLocaleDateString('es-AR')}. Se conservan sus turnos y su historial.
            </Alert>
          )}

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
                <Dato label="Alergias">{formatAlergias(c.cliente) || <span className="text-capilar-grey">No informó</span>}</Dato>
                <Dato label="Fecha de nacimiento">
                  {c.fechaNacimiento ? formatNacimiento(c.fechaNacimiento) : <span className="text-capilar-grey">No informó</span>}
                </Dato>
                <Dato label="Cliente desde">{new Date(c.fechaAlta).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' })}</Dato>
              </dl>
            ) : tab === 'turnos' ? (
              turnos.error ? (
                <Alert variant="error" title="No se pudieron cargar los turnos">
                  {turnos.error}
                </Alert>
              ) : !turnos.data ? (
                <Loader label="Cargando turnos..." className="py-12" />
              ) : (
                <TurnosDeLaClienta turnos={turnos.data} />
              )
            ) : fichas.error ? (
              <Alert variant="error" title="No se pudo cargar el historial">
                {fichas.error}
              </Alert>
            ) : fichas.isLoading ? (
              <Loader label="Cargando historial..." className="py-12" />
            ) : fichas.data?.length === 0 ? (
              <p className="py-8 text-center font-inter text-sm text-capilar-grey">Todavía no tiene fichas técnicas.</p>
            ) : (
              <div className="flex flex-col gap-2">
                {/* Todas cerradas: cada una se despliega al tocarla */}
                {fichas.data?.map((ficha) => (
                  <FichaTecnica key={ficha.id} token={token} ficha={ficha} onEditar={ficha.legajo === legajo ? () => setEditando(ficha) : undefined} />
                ))}
              </div>
            )}
          </div>
        </>
      )}

      {editando && (
        <FichaEditModal
          token={token}
          ficha={editando}
          onClose={() => setEditando(null)}
          onSaved={(actualizada) => fichas.setData((prev) => prev.map((f) => (f.id === actualizada.id ? actualizada : f)))}
        />
      )}
    </section>
  );
};
