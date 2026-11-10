import { useState } from 'react';
import type { ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { getProfessionalsRequest } from '../../api/professionals';
import { agrupacionDelRango, getEvolucionRequest, getRentabilidadRequest, getTurnosCompletadosRequest } from '../../api/reportes';
import type { Agrupacion, FilaRentabilidad } from '../../api/reportes';
import { formatPrice, getAllServicesRequest } from '../../api/services';
import { addDays, addMonths, fromIsoDate, startOfMonth, toIsoDate } from '../../api/turnos';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Collapsible, CountBadge } from '../../components/collapsible/collapsible';
import type { DateRange } from '../../components/datePicker/datePicker';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { MonthNav, YearNav } from '../../components/weekNav/weekNav';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FilterSelect, RangoField } from '../agenda/agendaFiltros';
import { FichaTabs } from '../agenda/fichaTabs';
import { RentabilidadGraficos } from './rentabilidadGraficos';
import { generarRentabilidadPdf } from './rentabilidadPdf';

type TipoPeriodo = 'mes' | 'anio' | 'rango';
type Pestania = 'resumen' | 'graficos';

const PERIODOS: [TipoPeriodo, string][] = [
  ['mes', 'Mes'],
  ['anio', 'Año'],
  ['rango', 'Rango'],
];

const TODOS = 'TODOS';

const Dato = ({ label, valor }: { label: string; valor: string }) => (
  <div className="flex flex-col gap-1 rounded-[6px] border border-gray-200 bg-white p-4 shadow-sm">
    <span className="font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey">{label}</span>
    <span className="font-inter text-2xl font-semibold text-black">{valor}</span>
  </div>
);

const celdaClass = 'px-4 py-2.5 text-right whitespace-nowrap';

const Tabla = <T extends FilaRentabilidad>({
  titulo,
  columna,
  filas,
  nombreDe,
  claveDe,
}: {
  titulo: string;
  columna: string;
  filas: T[];
  nombreDe: (fila: T) => ReactNode;
  claveDe: (fila: T) => number;
}) => (
  <section className="flex flex-col gap-3">
    <h2 className="font-inter text-xl font-semibold text-black">{titulo}</h2>
    <div className="overflow-x-auto rounded-[6px] border border-gray-200 bg-white shadow-sm">
      <table className="w-full font-inter text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-[11px] uppercase tracking-widest text-capilar-grey">
            <th className="px-4 py-2.5 text-left font-semibold">{columna}</th>
            <th className={`${celdaClass} font-semibold`}>Cant.</th>
            <th className={`${celdaClass} font-semibold`}>Cobrado</th>
            <th className={`${celdaClass} font-semibold`}>Productos</th>
            <th className={`${celdaClass} font-semibold`}>Margen</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 text-black">
          {filas.map((fila) => (
            <tr key={claveDe(fila)}>
              <td className="px-4 py-2.5">{nombreDe(fila)}</td>
              <td className={celdaClass}>{fila.cantidad}</td>
              <td className={celdaClass}>{formatPrice(fila.cobrado)}</td>
              <td className={celdaClass}>{formatPrice(fila.costo)}</td>
              <td className={`${celdaClass} font-semibold ${Number(fila.margen) < 0 ? 'text-red-500' : ''}`}>{formatPrice(fila.margen)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </section>
);

interface TurnosDelPeriodoProps {
  token: string;
  desde: string;
  hasta: string;
  legajo?: number;
  servicioId?: number;
}

// Una fila por servicio hecho, con los mismos filtros del reporte
const TurnosDelPeriodo = ({ token, desde, hasta, legajo, servicioId }: TurnosDelPeriodoProps) => {
  const turnos = useFetch(`turnos-completados-${desde}-${hasta}-${legajo}`, () => getTurnosCompletadosRequest(token, desde, hasta, legajo));

  if (turnos.error) {
    return (
      <Alert variant="error" title="No se pudieron cargar los turnos">
        {turnos.error}
      </Alert>
    );
  }
  if (!turnos.data) return <Loader label="Cargando turnos..." className="py-8" />;

  const filas = turnos.data.flatMap((turno) =>
    turno.detalles
      .filter((detalle) => (!legajo || detalle.legajo === legajo) && (!servicioId || detalle.servicioId === servicioId))
      .map((detalle) => ({ turno, detalle })),
  );

  return (
    <ul className="divide-y divide-gray-200 rounded-[6px] border border-gray-200 bg-white shadow-sm">
      {filas.map(({ turno, detalle }) => (
        <li key={detalle.id} className="flex flex-col gap-1 px-4 py-3 font-inter sm:flex-row sm:items-center sm:justify-between sm:gap-6">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-black">
              {fromIsoDate(turno.fecha).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' })} · {turno.cliente.nombre} {turno.cliente.apellido}
            </p>
            <p className="text-xs text-capilar-grey">
              {detalle.servicio} · {detalle.profesional}
            </p>
          </div>
          <div className="shrink-0 text-sm sm:text-right">
            <p className="text-capilar-grey">
              Cobrado <span className="text-black">{formatPrice(detalle.precioFinal ?? detalle.precioBase)}</span> · Productos{' '}
              <span className="text-black">{formatPrice(detalle.costo ?? 0)}</span> · <span className="font-semibold text-black">Margen {formatPrice(detalle.margen ?? 0)}</span>
            </p>
            {detalle.costoIncompleto && <p className="text-xs text-amber-700">Tiene productos sin precio</p>}
          </div>
        </li>
      ))}
    </ul>
  );
};

// Sección Rentabilidad del ADMIN: lo que dejó cada período después de los productos.
// Resumen con totales y detalle, y Gráficos en otra pestaña (en la URL: ?tab=graficos, para abrirla desde el menú lateral).
export const Rentabilidad = () => {
  const { token } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const pestania: Pestania = searchParams.get('tab') === 'graficos' ? 'graficos' : 'resumen';

  const [tipo, setTipo] = useState<TipoPeriodo>('mes');
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [year, setYear] = useState(() => new Date().getFullYear());
  const [rango, setRango] = useState<DateRange>({ desde: '', hasta: '' });
  const [legajo, setLegajo] = useState(TODOS);
  const [servicioId, setServicioId] = useState(TODOS);
  // Los turnos se piden la primera vez que se abre el desplegable: la agenda va de a 31 días
  const [verTurnos, setVerTurnos] = useState(false);
  const [generandoPdf, setGenerandoPdf] = useState(false);

  // Hay algo distinto de lo que se ve al entrar: el mes actual, con todos los profesionales y servicios
  const conFiltros = tipo !== 'mes' || toIsoDate(month) !== toIsoDate(startOfMonth(new Date())) || legajo !== TODOS || servicioId !== TODOS;
  const limpiarFiltros = () => {
    setTipo('mes');
    setMonth(startOfMonth(new Date()));
    setYear(new Date().getFullYear());
    setRango({ desde: '', hasta: '' });
    setLegajo(TODOS);
    setServicioId(TODOS);
  };

  const periodos: Record<TipoPeriodo, [string, string] | null> = {
    mes: [toIsoDate(month), toIsoDate(addDays(addMonths(month, 1), -1))],
    anio: [`${year}-01-01`, `${year}-12-31`],
    rango: rango.hasta ? [rango.desde, rango.hasta] : null,
  };
  const periodo = periodos[tipo];
  const filtros = {
    legajo: legajo === TODOS ? undefined : Number(legajo),
    servicioId: servicioId === TODOS ? undefined : Number(servicioId),
  };

  const reporte = useFetch(token && periodo ? `rentabilidad-${periodo[0]}-${periodo[1]}-${legajo}-${servicioId}` : null, () =>
    getRentabilidadRequest(token!, periodo![0], periodo![1], filtros),
  );
  const profesionales = useFetch('profesionales', () => getProfessionalsRequest());
  const servicios = useFetch(token ? 'servicios-todos' : null, () => getAllServicesRequest(token!));

  const opcionesProfesional: [string, string][] = [
    [TODOS, 'Todos'],
    ...(profesionales.data ?? []).map((p): [string, string] => [String(p.legajo), `${p.nombre} ${p.apellido}`]),
  ];
  const opcionesServicio: [string, string][] = [
    [TODOS, 'Todos'],
    ...(servicios.data ?? []).map((s): [string, string] => [String(s.id), s.tipo]),
  ];

  // Mes: por semanas. Año: por meses. Rango: según lo largo que sea
  const agrupacion: Agrupacion = tipo === 'mes' ? 'semana' : tipo === 'anio' || !periodo ? 'mes' : agrupacionDelRango(periodo[0], periodo[1]);
  const datos = reporte.data;
  const sinPrecio = datos?.total.conCostoIncompleto ?? 0;

  const nombreDe = (opciones: [string, string][], valor: string) => opciones.find(([opcion]) => opcion === valor)?.[1] ?? 'Todos';

  // Cómo se llama el período, en el PDF y en el nombre del archivo
  const nombreDelPeriodo = (): [string, string] => {
    if (tipo === 'mes') {
      const mes = month.toLocaleDateString('es-AR', { month: 'long' });
      return [`${mes} de ${month.getFullYear()}`, `${mes}-${month.getFullYear()}`];
    }
    if (tipo === 'anio') return [String(year), String(year)];
    const [desde, hasta] = periodo!.map((fecha) => fromIsoDate(fecha).toLocaleDateString('es-AR'));
    return [`${desde} al ${hasta}`, `${periodo![0]}-a-${periodo![1]}`];
  };

  const descargarPdf = async () => {
    if (!token || !periodo || !datos) return;
    setGenerandoPdf(true);
    try {
      const evolucion = await getEvolucionRequest(token, periodo[0], periodo[1], filtros, agrupacion);
      const [textoPeriodo, sufijo] = nombreDelPeriodo();
      const doc = await generarRentabilidadPdf({
        reporte: datos,
        evolucion,
        agrupacion,
        periodo: textoPeriodo,
        profesional: nombreDe(opcionesProfesional, legajo),
        servicio: nombreDe(opcionesServicio, servicioId),
      });
      doc.save(`rentabilidad-${sufijo}.pdf`);
      toast.success('PDF descargado');
    } catch (err) {
      toast.error('No se pudo generar el PDF', { description: err instanceof ApiError ? err.message : 'Probá de nuevo.' });
    } finally {
      setGenerandoPdf(false);
    }
  };

  // ProtectedRoute ya garantiza la sesión y el rol
  if (!token) return null;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Rentabilidad' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Rentabilidad</Title>
            <p className="font-inter text-capilar-grey">Lo que dejó cada período después de los productos.</p>
          </div>
          <Button
            onClick={descargarPdf}
            disabled={!datos || datos.total.cantidad === 0 || generandoPdf}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60 md:self-auto"
          >
            {generandoPdf ? 'Generando...' : 'Descargar PDF'}
          </Button>
        </div>
      </div>

      {/* En una sola fila desde pantallas medianas: si falta lugar, se achican los selects de profesional y servicio */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm lg:flex-nowrap">
        <FilterSelect label="Período" value={tipo} options={PERIODOS} onChange={setTipo} />
        {tipo === 'mes' && <MonthNav month={month} onChange={setMonth} />}
        {tipo === 'anio' && <YearNav year={year} onChange={setYear} />}
        {tipo === 'rango' && <RangoField value={rango} onChange={setRango} />}
        <FilterSelect label="Profesional" value={legajo} options={opcionesProfesional} onChange={setLegajo} compact />
        <FilterSelect label="Servicio" value={servicioId} options={opcionesServicio} onChange={setServicioId} compact />
        {conFiltros && (
          <button
            type="button"
            onClick={limpiarFiltros}
            className="group ml-auto flex shrink-0 items-center gap-1.5 font-inter text-sm font-semibold text-capilar-violet transition-transform hover:scale-105"
          >
            {/* Cruz fina que se pone en negrita al pasar el mouse, como en la agenda */}
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

      <FichaTabs
        tabs={[
          ['resumen', 'Resumen'],
          ['graficos', 'Gráficos'],
        ]}
        value={pestania}
        onChange={(value: Pestania) => setSearchParams(value === 'resumen' ? {} : { tab: value }, { replace: true })}
      />

      {!periodo ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">Elegí desde y hasta qué día ver la rentabilidad.</p>
      ) : reporte.error ? (
        <Alert variant="error" title="No se pudo cargar la rentabilidad">
          {reporte.error}
        </Alert>
      ) : !datos ? (
        <Loader label="Cargando rentabilidad..." className="py-12" />
      ) : datos.total.cantidad === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">No hay turnos completados en este período.</p>
      ) : (
        <div className="flex flex-col gap-8">
          {sinPrecio > 0 && (
            <Alert variant="advertencia">
              {sinPrecio} {sinPrecio === 1 ? 'servicio tiene' : 'servicios tienen'} productos sin precio: el margen real es menor.
            </Alert>
          )}

          {pestania === 'graficos' ? (
            <RentabilidadGraficos token={token} reporte={datos} filtros={filtros} agrupacion={agrupacion} />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                <Dato label="Cobrado" valor={formatPrice(datos.total.cobrado)} />
                <Dato label="Productos" valor={formatPrice(datos.total.costo)} />
                <Dato label="Margen" valor={formatPrice(datos.total.margen)} />
                <Dato label="Turnos" valor={String(datos.total.turnos)} />
              </div>

              <Tabla titulo="Por servicio" columna="Servicio" filas={datos.porServicio} nombreDe={(fila) => fila.servicio} claveDe={(fila) => fila.servicioId} />
              <Tabla
                titulo="Por profesional"
                columna="Profesional"
                filas={datos.porProfesional}
                nombreDe={(fila) => fila.profesional}
                claveDe={(fila) => fila.legajo}
              />

              <Collapsible
                title="Ver turnos del período"
                aside={<CountBadge color="violeta">{datos.total.turnos}</CountBadge>}
                onOpen={() => setVerTurnos(true)}
              >
                {verTurnos && <TurnosDelPeriodo token={token} desde={periodo[0]} hasta={periodo[1]} legajo={filtros.legajo} servicioId={filtros.servicioId} />}
              </Collapsible>
            </>
          )}
        </div>
      )}
    </section>
  );
};
