import { useEffect, useEffectEvent, useState } from 'react';
import type { ReactNode } from 'react';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { puedeCargarFicha } from '../../api/fichas';
import { getUpcomingWorkDatesRequest } from '../../api/professionals';
import { FRECUENCIAS, getSeriesRequest, seriesPorTurno, turnoEnSerie } from '../../api/series';
import {
  MAX_DIAS_AGENDA,
  MAX_DIAS_ANTICIPACION,
  acceptTurnoRequest,
  addDays,
  addMonths,
  cancelTurnoRequest,
  completeTurnoRequest,
  formatFechaLarga,
  fromIsoDate,
  getAgendaRequest,
  markAbsentRequest,
  minutosHastaInicio,
  puedeMarcarAusente,
  rejectTurnoRequest,
  rescheduleTurnoRequest,
  startOfMonth,
  startOfWeek,
  toIsoDate,
} from '../../api/turnos';
import type { EstadoTurno, Turno, TurnoDetalle } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { Collapsible, CountBadge } from '../../components/collapsible/collapsible';
import type { DateRange } from '../../components/datePicker/datePicker';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Modal } from '../../components/modal/modal';
import { SearchBox } from '../../components/searchBox/searchBox';
import { SlotPicker } from '../../components/slotPicker/slotPicker';
import type { Slot } from '../../components/slotPicker/slotPicker';
import { Title } from '../../components/title/title';
import { SerieBadge, TurnoAction, TurnoCard, TurnoList } from '../../components/turnoCard/turnoCard';
import { MonthNav, WeekNav } from '../../components/weekNav/weekNav';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FilterSelect, RangoField } from './agendaFiltros';
import { FichaModal } from './fichaModal';
import { SerieModal } from './serieModal';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Filtro por fecha (Hoy por defecto)
type FiltroFecha = 'hoy' | 'semana' | 'mes' | 'rango';
const FILTROS_FECHA: [FiltroFecha, string][] = [
  ['hoy', 'Hoy'],
  ['semana', 'Semana'],
  ['mes', 'Mes'],
  ['rango', 'Rango'],
];

// Filtro por estado (Todos por defecto)
type FiltroEstado = 'todos' | 'confirmados' | 'porConfirmar' | 'cancelados' | 'completados' | 'ausentes';
const FILTROS_ESTADO: [FiltroEstado, string][] = [
  ['todos', 'Todos'],
  ['confirmados', 'Confirmados'],
  ['porConfirmar', 'Por confirmar'],
  ['cancelados', 'Cancelados'],
  ['completados', 'Completados'],
  ['ausentes', 'Ausentes'],
];
const ESTADOS: Record<Exclude<FiltroEstado, 'todos'>, EstadoTurno[]> = {
  confirmados: ['CONFIRMADO'],
  // Pendientes de aprobar y reprogramados que el cliente todavía no aceptó
  porConfirmar: ['PENDIENTE', 'REPROGRAMADO'],
  cancelados: ['CANCELADO', 'RECHAZADO'],
  completados: ['COMPLETADO'],
  ausentes: ['AUSENTE'],
};

// Lo que se está mostrando: el filtro de fecha o los resultados de la búsqueda
type Vista = FiltroFecha | 'busqueda';

// La búsqueda mira los turnos de los últimos 30 días y los próximos 60 (el máximo para reservar)
const BUSQUEDA_DIAS_ATRAS = 30;

// Más nuevo arriba: días de la fecha más lejana a la más vieja (dentro del día, por hora)
const porFechaDesc = (a: Turno, b: Turno) => b.fecha.localeCompare(a.fecha) || a.horaInicio.localeCompare(b.horaInicio);

// Cancelados y rechazados se cuentan aparte (en gris) en cada día
const esCancelado = (turno: Turno) => turno.estado === 'CANCELADO' || turno.estado === 'RECHAZADO';

// Sin mayúsculas ni tildes, para comparar lo que se busca
const normalizar = (texto: string) =>
  texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

// Busca por cliente, servicio o fecha ("octubre", "martes 28")
const coincide = (turno: Turno, busqueda: string) => {
  const texto = normalizar(
    [
      turno.cliente.nombre,
      turno.cliente.apellido,
      ...turno.detalles.map((detalle) => detalle.servicio),
      formatFechaLarga(turno.fecha),
    ].join(' '),
  );
  return normalizar(busqueda)
    .split(/\s+/)
    .every((palabra) => texto.includes(palabra));
};

// Cada cuánto se actualiza la vista Hoy (también al volver a la pestaña)
const REFRESCO_HOY_MS = 60_000;

// Grupos de la vista Hoy, como en el mail de agenda diaria: primero los que avisaron que vienen
const gruposHoy: { titulo: string; dot: string; incluye: (turno: Turno) => boolean }[] = [
  { titulo: 'Asistencia confirmada', dot: 'bg-green-600', incluye: (t) => t.estado === 'CONFIRMADO' && !!t.asistenciaConfirmadaEn },
  { titulo: 'Sin confirmar asistencia', dot: 'bg-capilar-peach', incluye: (t) => t.estado === 'CONFIRMADO' && !t.asistenciaConfirmadaEn },
  { titulo: 'Por resolver', dot: 'bg-amber-400', incluye: (t) => t.estado === 'PENDIENTE' || t.estado === 'REPROGRAMADO' },
  {
    titulo: 'Completados, ausentes y cancelados',
    dot: 'bg-gray-400',
    incluye: (t) => ['COMPLETADO', 'AUSENTE', 'CANCELADO', 'RECHAZADO'].includes(t.estado),
  },
];

// Acción que necesita confirmación (con motivo) o elegir un horario nuevo
type Pending = { type: 'rechazar' | 'cancelar' | 'completar' | 'ausente' | 'reprogramar'; turno: Turno };

interface AgendaTurnosProps {
  token: string;
  legajo: number;
}

// Turnos entre dos fechas ("YYYY-MM-DD"). La agenda se pide de a 31 días: por tramos.
const getRangeRequest = async (token: string, legajo: number, desde: string, hasta: string) => {
  const ranges: [string, string][] = [];
  for (let inicio = fromIsoDate(desde); toIsoDate(inicio) <= hasta; inicio = addDays(inicio, MAX_DIAS_AGENDA)) {
    const fin = toIsoDate(addDays(inicio, MAX_DIAS_AGENDA - 1));
    ranges.push([toIsoDate(inicio), fin < hasta ? fin : hasta]);
  }
  const parts = await Promise.all(ranges.map(([d, h]) => getAgendaRequest(token, legajo, d, h)));
  return parts.flat();
};

// Pestaña Turnos de la agenda. Arriba, el buscador y los filtros por fecha (Hoy, Semana, Mes, Rango, con el paso de
// semanas o meses o el calendario del rango) y por estado.
// Hoy se agrupa por asistencia (se actualiza solo); el resto y la búsqueda, en un desplegable por día (del más nuevo
// al más viejo) con la cantidad de turnos (y de cancelados en gris).
// Pendiente (servicios que requieren aprobación): confirmar o rechazar. Confirmado: cancelar o, desde que empieza, completar;
// desde la hora de fin, marcar ausente. Los activos se pueden reprogramar.
export const AgendaTurnos = ({ token, legajo }: AgendaTurnosProps) => {
  const [filtroFecha, setFiltroFecha] = useState<FiltroFecha>('hoy');
  const [filtroEstado, setFiltroEstado] = useState<FiltroEstado>('todos');
  const [busqueda, setBusqueda] = useState('');
  const [monday, setMonday] = useState(() => startOfWeek(new Date()));
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [rango, setRango] = useState<DateRange>({ desde: '', hasta: '' });
  const hoy = toIsoDate(new Date());

  // Hay algo distinto de lo que se ve al entrar (Hoy y Todos); el buscador se limpia con su propia ✕
  const conFiltros = filtroFecha !== 'hoy' || filtroEstado !== 'todos';
  const limpiarFiltros = () => {
    setFiltroFecha('hoy');
    setFiltroEstado('todos');
    setMonday(startOfWeek(new Date()));
    setMonth(startOfMonth(new Date()));
    setRango({ desde: '', hasta: '' });
  };

  const buscando = busqueda.trim() !== '';
  const vista: Vista = buscando ? 'busqueda' : filtroFecha;

  // Fechas que se piden según la vista (el rango, recién con las dos fechas elegidas)
  const periodos: Record<Vista, [string, string] | null> = {
    hoy: [hoy, hoy],
    semana: [toIsoDate(monday), toIsoDate(addDays(monday, 6))],
    mes: [toIsoDate(month), toIsoDate(addDays(addMonths(month, 1), -1))],
    rango: rango.hasta ? [rango.desde, rango.hasta] : null,
    busqueda: [toIsoDate(addDays(new Date(), -BUSQUEDA_DIAS_ATRAS)), toIsoDate(addDays(new Date(), MAX_DIAS_ANTICIPACION))],
  };
  const periodo = periodos[vista];
  const turnos = useFetch(periodo && `agenda-${periodo[0]}-${periodo[1]}`, () =>
    periodo ? getRangeRequest(token, legajo, ...periodo) : Promise.resolve([]),
  );

  // Vista Hoy: se actualiza sola (cada minuto y al volver a la pestaña) sin mostrar el loader
  const refreshHoy = useEffectEvent(async () => {
    try {
      const fresh = await getAgendaRequest(token, legajo, hoy, hoy);
      turnos.setData(() => fresh);
    } catch {
      // Sin conexión: se reintenta en el próximo refresco
    }
  });

  useEffect(() => {
    if (vista !== 'hoy') return;
    const interval = setInterval(refreshHoy, REFRESCO_HOY_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshHoy();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [vista]);

  const [pending, setPending] = useState<Pending | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [actionError, setActionError] = useState('');
  // Servicio del turno con la ficha técnica abierta
  const [ficha, setFicha] = useState<{ turno: Turno; detalle: TurnoDetalle } | null>(null);
  // Turno que se va a repetir (serie)
  const [repetir, setRepetir] = useState<Turno | null>(null);
  // Los turnos no traen su serie: se cruzan con las series del profesional
  const series = useFetch('series', () => getSeriesRequest(token));
  const seriePorTurno = seriesPorTurno(series.data ?? []);

  const badgeFor = (turno: Turno) => {
    const serie = seriePorTurno.get(turno.id);
    return serie ? <SerieBadge>{FRECUENCIAS[serie.frecuencia].label}</SerieBadge> : undefined;
  };

  const replace =(updated: Turno) => turnos.setData((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));

  const closePending = () => {
    if (busyId !== null) return;
    setPending(null);
    setActionError('');
  };

  // Corre la acción sobre un turno: actualiza la lista y avisa con un toast; los errores van al modal o a un toast
  const run = async (turno: Turno, request: () => Promise<Turno>, success: string, description: string) => {
    setBusyId(turno.id);
    setActionError('');
    try {
      replace(await request());
      setPending(null);
      toast.success(success, { description });
    } catch (err) {
      const message = err instanceof ApiError ? err.message : unexpectedError;
      if (pending) setActionError(message);
      else toast.error('No se pudo actualizar el turno', { description: message });
    } finally {
      setBusyId(null);
    }
  };

  const confirmDialog = (motivo: string) => {
    if (!pending) return;
    const { turno } = pending;
    if (pending.type === 'rechazar') {
      return run(turno, () => rejectTurnoRequest(token, turno.id, motivo), 'Solicitud rechazada', 'Le avisamos al cliente para que elija otro horario.');
    }
    if (pending.type === 'cancelar') {
      return run(turno, () => cancelTurnoRequest(token, turno.id, motivo), 'Turno cancelado', 'Le avisamos al cliente por mail.');
    }
    if (pending.type === 'completar') {
      return run(turno, () => completeTurnoRequest(token, turno.id), 'Turno completado', 'Ya figura en el historial del cliente.');
    }
    if (pending.type === 'ausente') {
      return run(turno, () => markAbsentRequest(token, turno.id), 'Marcado como ausente', 'Queda registrado que el cliente no vino.');
    }
  };

  const actionsFor = (turno: Turno) => {
    const busy = busyId === turno.id;
    const started = minutosHastaInicio(turno) <= 0;
    const open = (type: Pending['type']) => () => setPending({ type, turno });

    switch (turno.estado) {
      case 'PENDIENTE':
        return (
          <>
            <TurnoAction
              variant="positiva"
              disabled={busy}
              onClick={() => run(turno, () => acceptTurnoRequest(token, turno.id), 'Turno confirmado', 'Le avisamos al cliente por mail.')}
            >
              Confirmar
            </TurnoAction>
            {!started && (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('rechazar')}>
              Rechazar
            </TurnoAction>
          </>
        );
      case 'CONFIRMADO':
        return (
          <>
            {started ? (
              <TurnoAction variant="positiva" disabled={busy} onClick={open('completar')}>
                Completar
              </TurnoAction>
            ) : (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            {puedeMarcarAusente(turno) && (
              <TurnoAction disabled={busy} onClick={open('ausente')}>
                Marcar ausente
              </TurnoAction>
            )}
            {/* Se repite antes de completarlo: la serie sale de un turno confirmado */}
            {series.data && !turnoEnSerie(series.data, turno.id) && (
              <TurnoAction disabled={busy} onClick={() => setRepetir(turno)}>
                Repetir
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('cancelar')}>
              Cancelar
            </TurnoAction>
          </>
        );
      case 'REPROGRAMADO':
        return (
          <>
            {!started && (
              <TurnoAction disabled={busy} onClick={open('reprogramar')}>
                Reprogramar
              </TurnoAction>
            )}
            <TurnoAction variant="peligro" disabled={busy} onClick={open('cancelar')}>
              Cancelar
            </TurnoAction>
          </>
        );
      default:
        return undefined;
    }
  };

  // Ficha técnica de cada servicio: verla si existe (cualquier profesional) o cargarla (el suyo, confirmado y desde que
  // empieza ese servicio). La vista Hoy se refresca cada minuto, así que el botón aparece solo a la hora del turno
  const fichaActionFor = (turno: Turno) => (detalle: TurnoDetalle) => {
    const tiene = !!detalle.fichaId;
    if (!tiene && !(detalle.legajo === legajo && puedeCargarFicha(turno, detalle))) return null;
    return (
      <button
        type="button"
        onClick={() => setFicha({ turno, detalle })}
        className={`ml-2 inline-flex items-center rounded-full border px-2.5 py-0.5 align-middle font-inter text-xs font-semibold transition-colors ${
          tiene
            ? 'border-capilar-violet/40 bg-purple-50 text-capilar-violet hover:border-capilar-violet'
            : 'border-dashed border-gray-300 text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
        }`}
      >
        {tiene ? 'Ver ficha' : '+ Cargar ficha'}
      </button>
    );
  };

  // La ficha se creó o se quitó: el turno de la lista se actualiza sin volver a pedir la agenda
  const setFichaId = (turnoId: number, detalleId: number, fichaId: number | null) =>
    turnos.setData((prev) =>
      prev.map((t) =>
        t.id === turnoId ? { ...t, detalles: t.detalles.map((d) => (d.id === detalleId ? { ...d, fichaId } : d)) } : t,
      ),
    );

  // Servicios propios sin ficha: al completar el turno ya no se puede cargar
  const sinFicha = (turno: Turno) => turno.detalles.some((d) => d.legajo === legajo && !d.fichaId);

  // La búsqueda mira siempre todo su rango, sin importar el filtro de fecha; el de estado se aplica igual
  const visibles = (turnos.data ?? [])
    .filter((turno) => vista !== 'busqueda' || coincide(turno, busqueda))
    .filter((turno) => filtroEstado === 'todos' || ESTADOS[filtroEstado].includes(turno.estado))
    .sort(porFechaDesc);

  // Turnos agrupados por día, en el orden de visibles
  const byDay = new Map<string, Turno[]>();
  for (const turno of visibles) byDay.set(turno.fecha, [...(byDay.get(turno.fecha) ?? []), turno]);

  const conEstado = filtroEstado === 'todos' ? '' : ` ${FILTROS_ESTADO.find(([value]) => value === filtroEstado)?.[1].toLowerCase()}`;
  const vacio: Record<Vista, string> = {
    hoy: `No tenés turnos${conEstado} hoy.`,
    semana: `No tenés turnos${conEstado} esa semana.`,
    mes: `No tenés turnos${conEstado} ese mes.`,
    rango: rango.hasta ? `No tenés turnos${conEstado} entre esas fechas.` : 'Elegí desde y hasta qué día ver los turnos.',
    busqueda: `No encontramos turnos${conEstado} para "${busqueda.trim()}".`,
  };

  const dialogTexts = {
    rechazar: {
      title: 'Rechazar solicitud',
      text: '¿Rechazar esta solicitud? Al cliente le llega un aviso para que elija otro horario.',
      confirm: 'Rechazar',
      reason: { label: 'Motivo', required: true, hint: 'Es interno del salón: el cliente no lo ve.', placeholder: 'Ej.: no llego con el tiempo para ese servicio' },
    },
    cancelar: {
      title: 'Cancelar turno',
      text: '¿Cancelar este turno? El horario queda libre y le avisamos al cliente.',
      confirm: 'Cancelar turno',
      reason: { label: 'Motivo', required: true, hint: 'Se lo enviamos al cliente en el aviso.', placeholder: 'Ej.: no voy a estar ese día' },
    },
    completar: {
      title: 'Completar turno',
      text: '¿Marcar este turno como realizado?',
      confirm: 'Completar',
      reason: undefined,
    },
    ausente: {
      title: 'Marcar ausente',
      text: '¿El cliente no vino a este turno? Queda registrado como ausente.',
      confirm: 'Marcar ausente',
      reason: undefined,
    },
  };
  const texts = pending && pending.type !== 'reprogramar' ? dialogTexts[pending.type] : null;

  return (
    // Alto mínimo: con pocos turnos, el calendario del rango entra sin pasar por encima del footer
    <div className="flex min-h-[32rem] flex-col gap-6">
      {/* Buscador arriba a la derecha y, debajo, el recuadro de filtros */}
      <div className="flex flex-col gap-3">
        <SearchBox
          value={busqueda}
          onChange={setBusqueda}
          label="Buscar turnos"
          placeholder="Buscar por cliente, servicio o mes"
          compact
          className="lg:max-w-sm lg:self-end"
        />

        <div className="flex flex-col gap-2.5 rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <span className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">Filtros</span>
            <FilterSelect label="Fecha" value={filtroFecha} options={FILTROS_FECHA} onChange={setFiltroFecha} />

            {/* Al lado de la fecha: la fecha de hoy, el paso de semanas o meses, o el rango (la búsqueda no los usa) */}
            {!buscando && filtroFecha === 'hoy' && (
              <span className="shrink-0 font-inter text-sm font-semibold text-black first-letter:uppercase">{formatFechaLarga(hoy)}</span>
            )}
            {!buscando && filtroFecha === 'semana' && <WeekNav monday={monday} onChange={setMonday} />}
            {!buscando && filtroFecha === 'mes' && <MonthNav month={month} onChange={setMonth} />}
            {!buscando && filtroFecha === 'rango' && <RangoField value={rango} onChange={setRango} />}

            <FilterSelect label="Estado" value={filtroEstado} options={FILTROS_ESTADO} onChange={setFiltroEstado} />

            {conFiltros && (
              <button
                type="button"
                onClick={limpiarFiltros}
                className="group ml-auto flex shrink-0 items-center gap-1.5 font-inter text-sm font-semibold text-capilar-violet transition-transform hover:scale-105"
              >
                {/* Cruz fina que se pone en negrita al pasar el mouse, como en los filtros de Usuarios */}
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
                Limpiar filtros
              </button>
            )}
          </div>

          {buscando && (
            <p className="font-inter text-xs text-capilar-grey">
              Buscando en todos los turnos de los últimos {BUSQUEDA_DIAS_ATRAS} días y los próximos {MAX_DIAS_ANTICIPACION}, sin importar
              la fecha elegida.
            </p>
          )}
        </div>
      </div>

      {turnos.error ? (
        <Alert variant="error" title="No se pudo cargar la agenda">
          {turnos.error}
        </Alert>
      ) : turnos.isLoading ? (
        <Loader label="Cargando turnos..." className="py-12" />
      ) : byDay.size === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">{vacio[vista]}</p>
      ) : vista === 'hoy' ? (
        <TodayView turnos={visibles} actionsFor={actionsFor} fichaActionFor={fichaActionFor} badgeFor={badgeFor} />
      ) : (
        <div className="flex flex-col gap-3">
          {[...byDay].map(([fecha, delDia]) => {
            const cancelados = delDia.filter(esCancelado).length;
            return (
              <Collapsible
                // Se vuelve a armar al cambiar de vista: arranca abierto hoy o, al buscar, todos
                key={`${vista}-${fecha}`}
                variant="grupo"
                as="h3"
                defaultOpen={fecha === hoy || vista === 'busqueda'}
                title={fecha === hoy ? `${formatFechaLarga(fecha)} · hoy` : formatFechaLarga(fecha)}
                aside={
                  <span className="flex items-center gap-1.5">
                    <CountBadge color="violeta">
                      {delDia.length - cancelados}
                      <span className="sr-only"> turnos</span>
                    </CountBadge>
                    {cancelados > 0 && (
                      <CountBadge>
                        {cancelados}
                        <span className="sr-only"> cancelados</span>
                      </CountBadge>
                    )}
                  </span>
                }
              >
                <TurnoList>
                  {delDia.map((turno) => (
                    <TurnoCard
                      key={turno.id}
                      turno={turno}
                      enLista
                      actions={actionsFor(turno)}
                      detalleAction={fichaActionFor(turno)}
                      badge={badgeFor(turno)}
                    />
                  ))}
                </TurnoList>
              </Collapsible>
            );
          })}
        </div>
      )}

      {texts && pending && (
        <ConfirmDialog
          isOpen
          onClose={closePending}
          title={texts.title}
          confirmLabel={texts.confirm}
          onConfirm={confirmDialog}
          isLoading={busyId !== null}
          error={actionError}
          reason={texts.reason}
        >
          <p>{texts.text}</p>
          <p className="mt-2 font-semibold text-black">
            {pending.turno.cliente.nombre} {pending.turno.cliente.apellido} · {formatFechaLarga(pending.turno.fecha)}, {pending.turno.horaInicio}
          </p>
          {pending.type === 'completar' && (
            <p className="mt-2">
              {sinFicha(pending.turno)
                ? 'Ojo: todavía no cargaste la ficha técnica y, una vez completado, ya no se puede cargar.'
                : 'La ficha técnica se cierra y la clienta ve tus indicaciones y las fotos en su historial.'}
            </p>
          )}
        </ConfirmDialog>
      )}

      <Modal isOpen={pending?.type === 'reprogramar'} onClose={closePending} ariaLabel="Reprogramar turno" className="max-w-3xl!">
        {pending?.type === 'reprogramar' && (
          <RescheduleForm
            token={token}
            legajo={legajo}
            turno={pending.turno}
            onCancel={closePending}
            isLoading={busyId !== null}
            error={actionError}
            onSubmit={(slot) =>
              run(
                pending.turno,
                () => rescheduleTurnoRequest(token, pending.turno.id, slot.fecha, slot.hora),
                'Nuevo horario enviado',
                'El turno queda esperando a que el cliente lo acepte.',
              )
            }
          />
        )}
      </Modal>

      {ficha && (
        <FichaModal
          token={token}
          legajo={legajo}
          turno={ficha.turno}
          detalle={ficha.detalle}
          onClose={() => setFicha(null)}
          onFichaChange={(fichaId) => setFichaId(ficha.turno.id, ficha.detalle.id, fichaId)}
        />
      )}

      {repetir && (
        <SerieModal
          token={token}
          legajo={legajo}
          turno={repetir}
          onClose={() => setRepetir(null)}
          onCreated={(serie) => {
            setRepetir(null);
            // La serie trae turnos nuevos: se vuelven a pedir los turnos y las series
            turnos.reload();
            series.reload();
            const creados = serie.fechas.filter((f) => f.turnoId !== null).length;
            toast.success('Serie creada', {
              description: `Reservamos ${creados} ${creados === 1 ? 'turno' : 'turnos'} y le avisamos al cliente por mail.`,
            });
          }}
        />
      )}
    </div>
  );
};

interface TodayViewProps {
  turnos: Turno[];
  actionsFor: (turno: Turno) => ReactNode;
  fichaActionFor: (turno: Turno) => (detalle: TurnoDetalle) => ReactNode;
  badgeFor: (turno: Turno) => ReactNode;
}

// Turnos de hoy: arriba un resumen con cuántos hay de cada grupo y debajo cada grupo por hora
const TodayView = ({ turnos, actionsFor, fichaActionFor, badgeFor }: TodayViewProps) => {
  const grupos = gruposHoy
    .map((grupo) => ({ ...grupo, turnos: turnos.filter(grupo.incluye) }))
    .filter((grupo) => grupo.turnos.length > 0);

  return (
    <div className="flex flex-col gap-6">
      <ul aria-label="Resumen de hoy" className="flex flex-wrap gap-2">
        {grupos.map((grupo) => (
          <li
            key={grupo.titulo}
            className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 font-inter text-xs text-black shadow-sm"
          >
            <span aria-hidden="true" className={`h-2 w-2 rounded-full ${grupo.dot}`} />
            {grupo.titulo}
            <span className="font-semibold">{grupo.turnos.length}</span>
          </li>
        ))}
      </ul>

      {grupos.map((grupo) => (
        <div key={grupo.titulo} className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 font-inter text-sm font-semibold uppercase tracking-widest text-capilar-grey">
            <span aria-hidden="true" className={`h-2.5 w-2.5 rounded-full ${grupo.dot}`} />
            {grupo.titulo}
          </h3>
          <TurnoList>
            {grupo.turnos.map((turno) => (
              <TurnoCard
                key={turno.id}
                turno={turno}
                enLista
                actions={actionsFor(turno)}
                detalleAction={fichaActionFor(turno)}
                badge={badgeFor(turno)}
              />
            ))}
          </TurnoList>
        </div>
      ))}
    </div>
  );
};

interface RescheduleFormProps {
  token: string;
  legajo: number;
  turno: Turno;
  onSubmit: (slot: Slot) => void;
  onCancel: () => void;
  isLoading: boolean;
  error: string;
}

// Elegir el nuevo día y horario (mismos servicios y profesionales). El cliente tiene que aceptarlo.
const RescheduleForm = ({ token, legajo, turno, onSubmit, onCancel, isLoading, error }: RescheduleFormProps) => {
  const [slot, setSlot] = useState<Slot>({ fecha: '', hora: '' });
  const availability = useFetch(`disponibilidad-${legajo}`, () => getUpcomingWorkDatesRequest(token, legajo));
  const items = turno.detalles.map((detalle) => ({ servicioId: detalle.servicioId, legajo: detalle.legajo }));

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Reprogramar turno</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {turno.cliente.nombre} {turno.cliente.apellido} · hoy: {formatFechaLarga(turno.fecha)}, {turno.horaInicio}. Elegí el nuevo horario: el
          cliente lo tiene que aceptar.
        </p>
      </div>

      {availability.isLoading ? (
        <Loader size="sm" className="py-4" />
      ) : (
        <SlotPicker
          token={token}
          items={items}
          options={{ turnoId: turno.id }}
          workDates={availability.data ?? undefined}
          value={slot}
          onChange={setSlot}
        />
      )}

      {error && (
        <p role="alert" className="text-center font-inter text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
          Volver
        </Button>
        <Button
          onClick={() => onSubmit(slot)}
          disabled={isLoading || !slot.hora}
          className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Enviando...' : 'Proponer horario'}
        </Button>
      </div>
    </div>
  );
};
