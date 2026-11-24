import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getProfessionalsRequest, getUpcomingWorkDatesRequest } from '../../api/professionals';
import { agruparPorCategoria, formatPrice, getServicesRequest } from '../../api/services';
import { HORAS_CANCELACION_CLIENTE, MAX_DIAS_ANTICIPACION, buscarPrimerHorarioLibre, createTurnoRequest, formatFechaLarga, toIsoDate } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { CategoriaChips } from '../../components/categoriaChips/categoriaChips';
import { Loader } from '../../components/loader/loader';
import { RadioGroup } from '../../components/radioGroup/radioGroup';
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
// Se confirma al instante, salvo los servicios que requieren aprobación: esos quedan PENDIENTE hasta que el profesional los acepta.
export const Booking = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [servicioId, setServicioId] = useState<number | null>(Number(searchParams.get('servicio')) || null);
  // Chip de categoría elegido; null: todas
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [legajo, setLegajo] = useState<number | null>(null);
  const [slot, setSlot] = useState<Slot>({ fecha: '', hora: '' });
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  // 403: el back no deja reservar sin verificar el correo
  const [needsVerification, setNeedsVerification] = useState(false);
  // "Primer turno disponible": buscando, lo que encontró (o null si no hay en 60 días) y un número para descartar
  // la respuesta si mientras tanto se cambió de servicio o se eligió una profesional a mano
  const [primero, setPrimero] = useState<{ estado: 'buscando' } | { estado: 'listo'; encontrado: boolean } | null>(null);
  const busquedaPrimero = useRef(0);

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
  const grupos = agruparPorCategoria(services.data ?? []);
  const profesional = professionals.data?.find((p) => p.legajo === legajo);

  const chooseService = (id: number) => {
    busquedaPrimero.current++;
    setPrimero(null);
    setServicioId(id);
    setLegajo(null);
    setSlot({ fecha: '', hora: '' });
    setSaveError('');
  };

  const chooseProfessional = (id: number) => {
    busquedaPrimero.current++;
    setPrimero(null);
    setLegajo(id);
    setSlot({ fecha: '', hora: '' });
    setSaveError('');
  };

  // Busca, entre todas las profesionales que hacen el servicio, el primer día con lugar de cada una (de los que
  // trabaja) y se queda con el más cercano: elige profesional, día y horario, y queda listo para confirmar
  const findFirstSlot = async () => {
    if (!servicioId || !professionals.data?.length) return;
    const busqueda = ++busquedaPrimero.current;
    setPrimero({ estado: 'buscando' });
    setLegajo(null);
    setSlot({ fecha: '', hora: '' });
    setSaveError('');

    const hoy = toIsoDate(new Date());
    const porProfesional = await Promise.all(
      professionals.data.map(async (p) => {
        const dias = await getUpcomingWorkDatesRequest(token, p.legajo).catch(() => []);
        const proximos = dias.filter((d) => d >= hoy).sort();
        const libre = await buscarPrimerHorarioLibre(token, proximos, [{ servicioId, legajo: p.legajo }]);
        return libre && { legajo: p.legajo, ...libre };
      }),
    );
    if (busqueda !== busquedaPrimero.current) return;

    // El más cercano: por fecha y, el mismo día, por hora ("HH:mm" se compara como texto)
    const mejor = porProfesional
      .filter((r) => r !== null)
      .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.hora.localeCompare(b.hora))[0];
    setPrimero({ estado: 'listo', encontrado: Boolean(mejor) });
    if (mejor) {
      setLegajo(mejor.legajo);
      setSlot({ fecha: mejor.fecha, hora: mejor.hora });
    }
  };

  const confirm = async () => {
    if (!servicioId || !legajo || !slot.hora) return;
    setIsSaving(true);
    setSaveError('');
    try {
      const turno = await createTurnoRequest(token, { fecha: slot.fecha, horaInicio: slot.hora, items: [{ servicioId, legajo }] });
      if (turno.estado === 'PENDIENTE') {
        toast.success('¡Solicitud enviada!', { description: 'Te avisamos por mail apenas tu profesional confirme el turno.' });
      } else {
        toast.success('¡Turno confirmado!', { description: 'Te esperamos. Te mandamos los detalles por mail.' });
      }
      navigate('/mis-turnos');
    } catch (err) {
      // Si alguien tomó el horario mientras tanto, el back responde 409 con el motivo; 403 si falta verificar el correo
      setSaveError(err instanceof ApiError ? err.message : unexpectedError);
      setNeedsVerification(err instanceof ApiError && err.status === 403);
      setIsSaving(false);
    }
  };

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-24 pb-16">
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
          <>
            {/* Encuesta TP4: el listado se hacía largo. Con "Todas" se ven agrupados; cada chip deja solo su categoría */}
            {grupos.length > 1 && (
              <CategoriaChips categorias={grupos.map((g) => g.categoria)} value={categoriaId} onChange={setCategoriaId} />
            )}

            <RadioGroup aria-label="Servicio" className="flex flex-col gap-6">
              {grupos
                .filter((g) => categoriaId === null || g.categoria.id === categoriaId)
                .map(({ categoria, servicios }) => (
                  <div key={categoria.id} className="flex flex-col gap-3">
                    {grupos.length > 1 && (
                      <h3 className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{categoria.nombre}</h3>
                    )}
                    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {servicios.map((s) => (
                        <Option key={s.id} selected={s.id === servicioId} onClick={() => chooseService(s.id)}>
                          <span className="font-semibold text-black">{s.tipo}</span>
                          {s.descripcion && (
                            <span className="line-clamp-2 text-xs text-capilar-grey" title={s.descripcion}>
                              {s.descripcion}
                            </span>
                          )}
                          {/* Sin la duración: la maneja el salón (se superponen turnos en los tiempos de pose) */}
                          <span className="text-capilar-grey">Desde {formatPrice(s.precio)}</span>
                        </Option>
                      ))}
                    </div>
                  </div>
                ))}
            </RadioGroup>
          </>
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
            <div className="flex flex-col gap-4">
              <RadioGroup aria-label="Profesional" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {/* Quality del TF: sin elegir a nadie, el turno libre más cercano entre todo el equipo */}
                <Option selected={primero !== null} onClick={findFirstSlot}>
                  <span className="flex items-center gap-3">
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-capilar-violet text-capilar-violet"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
                        <circle cx="12" cy="12" r="9" />
                        <path d="M12 7v5l3 2" />
                      </svg>
                    </span>
                    <span className="flex flex-col">
                      <span className="font-semibold text-black">Primer turno disponible</span>
                      <span className="text-xs text-capilar-grey">Con cualquiera del equipo</span>
                    </span>
                  </span>
                </Option>
                {professionals.data.map((p) => (
                  <Option key={p.legajo} selected={primero === null && p.legajo === legajo} onClick={() => chooseProfessional(p.legajo)}>
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
              </RadioGroup>
              {primero?.estado === 'buscando' && (
                <Loader size="sm" label="Buscando el primer turno libre..." className="items-start! py-2" />
              )}
              {primero?.estado === 'listo' &&
                (primero.encontrado && profesional && slot.hora ? (
                  <Alert variant="info" title="Encontramos el primer turno libre">
                    <span className="first-letter:uppercase">{formatFechaLarga(slot.fecha)}</span> a las {slot.hora} con{' '}
                    {profesional.nombre} {profesional.apellido}. Revisalo abajo y confirmá, o elegí otro día y horario.
                  </Alert>
                ) : !primero.encontrado ? (
                  <Alert variant="advertencia" title="No hay turnos libres">
                    Nadie del equipo tiene lugar para este servicio en los próximos {MAX_DIAS_ANTICIPACION} días.
                  </Alert>
                ) : null)}
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
              <dd className="text-black">{servicio.tipo}</dd>
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

          {servicio.requiereEvaluacion ? (
            <Alert variant="advertencia" title="Tu profesional confirma este turno">
              Es un servicio que necesita evaluación: el turno queda por confirmar hasta que {profesional.nombre} lo acepte. Te
              avisamos por mail.
            </Alert>
          ) : (
            <Alert variant="info" title="Se confirma al instante">
              Apenas reserves, tu turno queda confirmado.
            </Alert>
          )}

          <p className="font-inter text-xs text-capilar-grey">
            El precio final se define en el salón según tu cabello. Una vez confirmado, podés cancelarlo hasta{' '}
            {HORAS_CANCELACION_CLIENTE} horas antes.
          </p>

          {saveError && (
            <Alert variant="error" title="No se pudo reservar el turno">
              {saveError}
              {needsVerification && (
                <Link to="/mi-perfil" className="mt-2 block font-semibold text-capilar-violet-text hover:underline">
                  Ir a mi perfil para pedir otro enlace
                </Link>
              )}
            </Alert>
          )}

          <Button
            onClick={confirm}
            disabled={isSaving}
            className="self-end px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSaving ? 'Reservando...' : 'Confirmar reserva'}
          </Button>
        </div>
      )}
    </section>
  );
};
