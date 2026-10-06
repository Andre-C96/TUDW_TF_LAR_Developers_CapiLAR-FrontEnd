import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getProfessionalServicesRequest, getUpcomingWorkDatesRequest } from '../../api/professionals';
import { formatDuration, formatPrice } from '../../api/services';
import { createTurnoRequest, formatFechaLarga } from '../../api/turnos';
import type { Usuario } from '../../api/auth';
import { searchClientsRequest } from '../../api/users';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { Loader } from '../../components/loader/loader';
import { SearchBox } from '../../components/searchBox/searchBox';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

const boxClasses = 'flex flex-col gap-5 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8';

const BoxTitle = ({ children }: { children: ReactNode }) => (
  <Title as="h2" className="text-xl! md:text-2xl!">
    {children}
  </Title>
);

interface NewTurnoProps {
  token: string;
  legajo: number;
  // Después de guardar (ej. volver a la pestaña Turnos)
  onCreated: () => void;
}

// Pestaña Nuevo turno: el profesional le carga un turno a un cliente (por teléfono o en el salón).
// Como lo carga el salón, el turno nace CONFIRMADO.
export const NewTurno = ({ token, legajo, onCreated }: NewTurnoProps) => {
  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [cliente, setCliente] = useState<Usuario | null>(null);
  const [servicioId, setServicioId] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot>({ fecha: '', hora: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  // Espera a que se deje de escribir para no pedir en cada tecla
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(search.trim()), 300);
    return () => clearTimeout(timer);
  }, [search]);

  const clients = useFetch(!cliente && debounced.length >= 2 ? `clientes-${debounced}` : null, () =>
    searchClientsRequest(token, debounced),
  );
  const services = useFetch(`servicios-${legajo}`, () => getProfessionalServicesRequest(token, legajo));
  const availability = useFetch(`disponibilidad-${legajo}`, () => getUpcomingWorkDatesRequest(token, legajo));

  const servicio = services.data?.find((s) => s.id === servicioId);

  const reset = () => {
    setSearch('');
    setCliente(null);
    setServicioId(null);
    setSlot({ fecha: '', hora: '' });
  };

  const save = async () => {
    if (!cliente || !servicioId || !slot.hora) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await createTurnoRequest(token, {
        fecha: slot.fecha,
        horaInicio: slot.hora,
        items: [{ servicioId, legajo }],
        clienteId: cliente.id,
      });
      toast.success('Turno cargado y confirmado', { description: `Le avisamos a ${cliente.nombre} por mail.` });
      reset();
      onCreated();
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div className={boxClasses}>
        <BoxTitle>Cliente</BoxTitle>
        {cliente ? (
          <div className="flex items-center justify-between gap-4 rounded-lg bg-capilar-violet/10 px-4 py-3 font-inter text-sm">
            <span>
              <span className="font-semibold text-black">
                {cliente.nombre} {cliente.apellido}
              </span>
              <span className="text-capilar-grey"> · {cliente.email}</span>
            </span>
            <button
              type="button"
              onClick={() => setCliente(null)}
              className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-capilar-violet"
            >
              Cambiar
            </button>
          </div>
        ) : (
          <>
            <SearchBox value={search} onChange={setSearch} label="Buscar cliente" placeholder="Buscar por nombre, apellido o correo" />
            {debounced.length < 2 ? (
              <p className="font-inter text-sm text-capilar-grey">Escribí al menos 2 letras para buscar.</p>
            ) : clients.error ? (
              <Alert variant="error" title="No se pudieron buscar clientes">
                {clients.error}
              </Alert>
            ) : clients.isLoading ? (
              <Loader size="sm" className="items-start! py-2" />
            ) : clients.data?.length === 0 ? (
              <p className="font-inter text-sm text-capilar-grey">No encontramos clientes con esa búsqueda.</p>
            ) : (
              <ul className="divide-y divide-gray-200 rounded-lg border border-gray-200">
                {clients.data?.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => setCliente(c)}
                      className="flex w-full flex-col items-start px-4 py-3 text-left font-inter text-sm hover:bg-capilar-violet/5"
                    >
                      <span className="font-semibold text-black">
                        {c.nombre} {c.apellido}
                      </span>
                      <span className="text-capilar-grey">
                        {c.email}
                        {c.telefono && ` · ${c.telefono}`}
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </div>

      {cliente && (
        <div className={boxClasses}>
          <BoxTitle>Servicio</BoxTitle>
          {services.error ? (
            <Alert variant="error" title="No se pudieron cargar tus servicios">
              {services.error}
            </Alert>
          ) : !services.data ? (
            <Loader size="sm" className="items-start! py-2" />
          ) : services.data.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">Todavía no tenés servicios asignados. Pedíselos a la administración.</p>
          ) : (
            <div role="radiogroup" aria-label="Servicio" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {services.data.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  role="radio"
                  aria-checked={s.id === servicioId}
                  onClick={() => {
                    setServicioId(s.id);
                    setSlot({ fecha: '', hora: '' });
                  }}
                  className={`flex flex-col items-start gap-1 rounded-lg border-2 px-4 py-3 text-left font-inter text-sm transition-colors ${
                    s.id === servicioId ? 'border-capilar-violet bg-capilar-violet/10' : 'border-gray-200 bg-white hover:border-capilar-violet/50'
                  }`}
                >
                  <span className="font-semibold text-black">{s.tipo}</span>
                  <span className="text-capilar-grey">
                    {formatDuration(s.tiempoDuracion)} · Desde {formatPrice(s.precio)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {cliente && servicioId && (
        <div className={boxClasses}>
          <BoxTitle>Día y horario</BoxTitle>
          {availability.data?.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">No tenés horarios cargados en los próximos días: cargalos en la pestaña Mis horarios.</p>
          ) : (
            <SlotPicker token={token} items={[{ servicioId, legajo }]} workDates={availability.data ?? undefined} options={{ clienteId: cliente.id }} value={slot} onChange={setSlot} />
          )}
        </div>
      )}

      {cliente && servicio && slot.hora && (
        <div className="flex flex-col gap-4 rounded-[6px] border border-capilar-violet/40 bg-capilar-violet/5 p-6 shadow-md md:flex-row md:items-center md:justify-between md:p-8">
          <p className="font-inter text-sm text-black">
            <span className="font-semibold">
              {cliente.nombre} {cliente.apellido}
            </span>{' '}
            · {servicio.tipo} · <span className="first-letter:uppercase">{formatFechaLarga(slot.fecha)}</span> a las {slot.hora}
          </p>
          <Button
            onClick={save}
            disabled={isSaving}
            className="shrink-0 px-8 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Guardando...' : 'Cargar turno'}
          </Button>
        </div>
      )}

      {saveError && (
        <Alert variant="error" title="No se pudo cargar el turno">
          {saveError}
        </Alert>
      )}
    </div>
  );
};
