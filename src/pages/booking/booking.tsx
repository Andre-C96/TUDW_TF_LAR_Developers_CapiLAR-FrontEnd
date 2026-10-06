import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getProfessionalsRequest, getUpcomingWorkDatesRequest } from '../../api/professionals';
import { formatDuration, formatPrice, getServicesRequest } from '../../api/services';
import { createTurnoRequest, formatFechaLarga } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Loader } from '../../components/loader/loader';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Caja de cada paso, con su número en un círculo del degradado
const Step = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-5 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8">
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-capilar-gradient font-inter text-sm font-semibold text-white">
        {number}
      </span>
      <Title as="h2" className="text-xl! md:text-2xl!">
        {title}
      </Title>
    </div>
    {children}
  </div>
);

// Opción elegible (servicio o profesional): borde del degradado cuando está elegida
const Option = ({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) => (
  <button
    type="button"
    role="radio"
    aria-checked={selected}
    onClick={onClick}
    className={`flex flex-col items-start gap-1 rounded-lg border-2 px-4 py-3 text-left font-inter text-sm transition-colors ${
      selected ? 'border-capilar-violet bg-capilar-violet/10' : 'border-gray-200 bg-white hover:border-capilar-violet/50'
    }`}
  >
    {children}
  </button>
);

// Reserva del cliente (F03): servicio → profesional que lo hace → día → horario libre → confirmar.
// Llega desde el botón Reservar de cada servicio de la home (?servicio=id) o sin servicio elegido.
// El turno queda PENDIENTE hasta que el profesional lo confirme.
export const Booking = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [servicioId, setServicioId] = useState<number | null>(Number(searchParams.get('servicio')) || null);
  const [legajo, setLegajo] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot>({ fecha: '', hora: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const services = useFetch('servicios', getServicesRequest);
  const professionals = useFetch(servicioId ? `profesionales-${servicioId}` : null, () =>
    getProfessionalsRequest(servicioId!),
  );
  // Fechas con horario del profesional elegido, para no ofrecer en el calendario las que no atiende
  const availability = useFetch(token && legajo ? `disponibilidad-${legajo}` : null, () =>
    getUpcomingWorkDatesRequest(token!, legajo!),
  );

  // ProtectedRoute ya garantiza la sesión
  if (!token) return null;

  const servicio = services.data?.find((s) => s.id === servicioId);
  const profesional = professionals.data?.find((p) => p.legajo === legajo);

  const chooseService = (id: number) => {
    setServicioId(id);
    setLegajo(null);
    setSlot({ fecha: '', hora: '' });
    setSaveError('');
  };

  const chooseProfessional = (id: number) => {
    setLegajo(id);
    setSlot({ fecha: '', hora: '' });
    setSaveError('');
  };

  const confirm = async () => {
    if (!servicioId || !legajo || !slot.hora) return;
    setIsSaving(true);
    setSaveError('');
    try {
      await createTurnoRequest(token, { fecha: slot.fecha, horaInicio: slot.hora, items: [{ servicioId, legajo }] });
      toast.success('¡Solicitud enviada!', { description: 'Te avisamos por mail apenas el salón confirme tu turno.' });
      navigate('/mis-turnos');
    } catch (err) {
      // Si alguien tomó el horario mientras tanto, el back responde 409 con el motivo
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Reservar turno' }]} />
        <div className="flex flex-col gap-2">
          <Title>Reservar turno</Title>
          <p className="font-inter text-capilar-grey">Elegí el servicio, quién te atiende y el horario que te quede cómodo.</p>
        </div>
      </div>

      <Step number={1} title="Servicio">
        {services.error ? (
          <Alert variant="error" title="No se pudieron cargar los servicios">
            {services.error}
          </Alert>
        ) : !services.data ? (
          <Loader label="Cargando servicios..." className="py-4" />
        ) : (
          <div role="radiogroup" aria-label="Servicio" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {services.data.map((s) => (
              <Option key={s.id} selected={s.id === servicioId} onClick={() => chooseService(s.id)}>
                <span className="font-semibold text-black">{s.tipo}</span>
                <span className="text-capilar-grey">
                  {formatDuration(s.tiempoDuracion)} · Desde {formatPrice(s.precio)}
                </span>
              </Option>
            ))}
          </div>
        )}
      </Step>

      {servicioId && (
        <Step number={2} title="Profesional">
          {professionals.error ? (
            <Alert variant="error" title="No se pudieron cargar los profesionales">
              {professionals.error}
            </Alert>
          ) : !professionals.data ? (
            <Loader label="Buscando profesionales..." className="py-4" />
          ) : professionals.data.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">
              Por ahora nadie del equipo hace este servicio. Probá con otro o consultanos.
            </p>
          ) : (
            <div role="radiogroup" aria-label="Profesional" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {professionals.data.map((p) => (
                <Option key={p.legajo} selected={p.legajo === legajo} onClick={() => chooseProfessional(p.legajo)}>
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-capilar-gradient text-xs font-semibold text-white"
                    >
                      {p.nombre[0]}
                      {p.apellido[0]}
                    </span>
                    <span className="font-semibold text-black">
                      {p.nombre} {p.apellido}
                    </span>
                  </span>
                </Option>
              ))}
            </div>
          )}
        </Step>
      )}

      {servicioId && legajo && (
        <Step number={3} title="Día y horario">
          {availability.error ? (
            <Alert variant="error" title="No se pudieron cargar los días de atención">
              {availability.error}
            </Alert>
          ) : !availability.data ? (
            <Loader label="Cargando días de atención..." className="py-4" />
          ) : availability.data.length === 0 ? (
            <p className="font-inter text-sm text-capilar-grey">
              {profesional?.nombre} no tiene horarios disponibles en los próximos días. Probá con otra persona del equipo.
            </p>
          ) : (
            <SlotPicker token={token} items={[{ servicioId, legajo }]} workDates={availability.data} value={slot} onChange={setSlot} />
          )}
        </Step>
      )}

      {servicio && profesional && slot.hora && (
        <div className="flex flex-col gap-5 rounded-[6px] border border-capilar-violet/40 bg-capilar-violet/5 p-6 shadow-md md:p-8">
          <Title as="h2" className="text-xl! md:text-2xl!">
            Tu turno
          </Title>
          <dl className="grid gap-4 font-inter text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-capilar-grey">Servicio</dt>
              <dd className="text-black">
                {servicio.tipo} · {formatDuration(servicio.tiempoDuracion)}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-capilar-grey">Profesional</dt>
              <dd className="text-black">
                {profesional.nombre} {profesional.apellido}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-capilar-grey">Cuándo</dt>
              <dd className="text-black first-letter:uppercase">
                {formatFechaLarga(slot.fecha)} a las {slot.hora}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-widest text-capilar-grey">Precio</dt>
              <dd className="text-black">Desde {formatPrice(servicio.precio)}</dd>
            </div>
          </dl>

          <p className="font-inter text-xs text-capilar-grey">
            El precio final se define en el salón según tu cabello. Tu turno queda pendiente hasta que el salón lo confirme. Una vez confirmado, podés cancelarlo hasta 12 horas antes.
          </p>

          {saveError && (
            <Alert variant="error" title="No se pudo reservar el turno">
              {saveError}
            </Alert>
          )}

          <Button
            onClick={confirm}
            disabled={isSaving}
            className="self-end px-8 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Reservando...' : 'Confirmar reserva'}
          </Button>
        </div>
      )}
    </section>
  );
};
