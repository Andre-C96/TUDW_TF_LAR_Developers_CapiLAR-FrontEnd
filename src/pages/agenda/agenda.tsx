import { useSearchParams } from 'react-router-dom';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { AgendaTurnos } from './agendaTurnos';
import { NewTurno } from './newTurno';
import { Schedule } from './schedule';

const tabs = [
  { id: 'turnos', label: 'Turnos' },
  { id: 'nuevo', label: 'Nuevo turno' },
  { id: 'horarios', label: 'Mis horarios' },
] as const;

type TabId = (typeof tabs)[number]['id'];

// Agenda del profesional (F05) en tres pestañas: sus turnos (confirmar, rechazar, cancelar...),
// cargarle un turno a un cliente (nace confirmado) y sus horarios de atención y días libres.
// La pestaña va en la URL (?tab=) para que sobreviva a la recarga.
export const Agenda = () => {
  const { user, token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tabParam = searchParams.get('tab');
  const tab: TabId = tabs.some((t) => t.id === tabParam) ? (tabParam as TabId) : 'turnos';
  const legajo = user?.profesional?.legajo;

  const goTo = (id: TabId) => setSearchParams(id === 'turnos' ? {} : { tab: id }, { replace: true });

  // ProtectedRoute ya garantiza la sesión y el rol
  if (!token) return null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Agenda' }]} />
        <div className="flex flex-col gap-2">
          <Title>Agenda</Title>
          <p className="font-inter text-capilar-grey">Tus turnos, tus horarios de atención y tus días libres.</p>
        </div>
      </div>

      {legajo === undefined ? (
        <Alert variant="advertencia" title="No encontramos tu legajo">
          Pedile a la administración que revise tu usuario de profesional.
        </Alert>
      ) : (
        <>
          <div role="tablist" aria-label="Secciones de la agenda" className="flex gap-6 border-b border-gray-200">
            {tabs.map((t) => (
              <button
                key={t.id}
                type="button"
                role="tab"
                aria-selected={tab === t.id}
                onClick={() => goTo(t.id)}
                className={`-mb-px border-b-2 pb-3 font-inter text-sm font-semibold uppercase tracking-widest transition-colors ${
                  tab === t.id ? 'border-capilar-violet text-black' : 'border-transparent text-capilar-grey hover:text-capilar-violet'
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div role="tabpanel">
            {tab === 'turnos' && <AgendaTurnos token={token} legajo={legajo} />}
            {tab === 'nuevo' && <NewTurno token={token} legajo={legajo} onCreated={() => goTo('turnos')} />}
            {tab === 'horarios' && <Schedule token={token} legajo={legajo} />}
          </div>
        </>
      )}
    </section>
  );
};
