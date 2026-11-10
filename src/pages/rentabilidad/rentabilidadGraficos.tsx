import { getEvolucionRequest, mejorPunto, rankingsDe } from '../../api/reportes';
import type { Agrupacion, FiltrosRentabilidad, PuntoEvolucion, Rentabilidad } from '../../api/reportes';
import { formatPrice } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { Loader } from '../../components/loader/loader';
import { useFetch } from '../../customHooks/fetch/useFetch';

const MAX_BARRAS = 8;

const tituloClass = 'font-inter text-sm font-semibold text-black';
const cajaClass = 'flex flex-col gap-4 rounded-[6px] border border-gray-200 bg-white p-5 shadow-sm';

const Destacado = ({ titulo, valor, detalle }: { titulo: string; valor: string; detalle: string }) => (
  <div className="flex flex-col gap-1 rounded-[6px] border border-gray-200 bg-white p-4 shadow-sm">
    <span className="font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey">{titulo}</span>
    <span className="font-inter text-lg font-semibold text-black first-letter:uppercase">{valor}</span>
    <span className="font-inter text-sm text-capilar-grey">{detalle}</span>
  </div>
);

interface FilaBarra {
  id: number;
  label: string;
  valor: number;
  texto: string;
}

// Ranking en barras horizontales, de mayor a menor. Un margen negativo no dibuja barra: se ve en el número
const BarrasHorizontales = ({ titulo, filas }: { titulo: string; filas: FilaBarra[] }) => {
  const maximo = Math.max(...filas.map((fila) => fila.valor), 0);
  const visibles = filas.slice(0, MAX_BARRAS);
  return (
    <section className={cajaClass}>
      <h3 className={tituloClass}>{titulo}</h3>
      <ul className="flex flex-col gap-3">
        {visibles.map((fila) => (
          <li key={fila.id} className="flex flex-col gap-1 font-inter text-sm">
            <div className="flex items-baseline justify-between gap-4">
              <span className="min-w-0 text-black">{fila.label}</span>
              <span className={`shrink-0 font-semibold ${fila.valor < 0 ? 'text-red-500' : 'text-black'}`}>{fila.texto}</span>
            </div>
            <div className="h-2 w-full rounded-r-[4px] bg-gray-100">
              <div className="h-full rounded-r-[4px] bg-capilar-violet" style={{ width: `${maximo > 0 ? (Math.max(fila.valor, 0) / maximo) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      {filas.length > MAX_BARRAS && <p className="font-inter text-xs text-capilar-grey">Y {filas.length - MAX_BARRAS} más: están todos en Resumen.</p>}
    </section>
  );
};

// Tope del eje: un número redondo apenas mayor que el máximo (1, 2 o 5 por una potencia de 10)
const techoDelEje = (maximo: number) => {
  if (maximo <= 0) return 1;
  const potencia = 10 ** Math.floor(Math.log10(maximo));
  const escala = maximo / potencia;
  return (escala <= 1 ? 1 : escala <= 2 ? 2 : escala <= 5 ? 5 : 10) * potencia;
};

type Columna = PuntoEvolucion;

// Una columna por semana o mes, con la mejor resaltada y con su valor. Al pasar el mouse o con el foco, el detalle
const Columnas = ({ titulo, columnas, mejor }: { titulo: string; columnas: Columna[]; mejor: Columna | null }) => {
  const techo = techoDelEje(Math.max(...columnas.map((columna) => columna.margen), 0));
  return (
    <section className={cajaClass}>
      <h3 className={tituloClass}>{titulo}</h3>
      <div className="mt-6">
        <div className="relative h-56">
          {[1, 0.5, 0].map((parte) => (
            <div key={parte} className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2" style={{ bottom: `${parte * 100}%` }}>
              <span className="w-20 shrink-0 text-right font-inter text-[11px] text-capilar-grey">{formatPrice(techo * parte)}</span>
              <div className="flex-1 border-t border-gray-200" />
            </div>
          ))}
          <div className="absolute inset-y-0 right-0 left-22 flex gap-0.5">
            {columnas.map((columna) => {
              const altura = (Math.max(columna.margen, 0) / techo) * 100;
              const esMejor = columna === mejor;
              return (
                <div
                  key={columna.label}
                  tabIndex={0}
                  aria-label={`${columna.largo}: margen ${formatPrice(columna.margen)}, cobrado ${formatPrice(columna.cobrado)}, productos ${formatPrice(columna.costo)}`}
                  className="group relative h-full min-w-0 flex-1 outline-none"
                >
                  <div
                    className={`absolute bottom-0 left-1/2 w-6 max-w-full -translate-x-1/2 rounded-t-[4px] transition-colors ${
                      esMejor ? 'bg-capilar-violet' : 'bg-capilar-violet/35 group-hover:bg-capilar-violet/60 group-focus:bg-capilar-violet/60'
                    }`}
                    style={{ height: `${altura}%` }}
                  />
                  {esMejor && (
                    <span
                      className="absolute left-1/2 -translate-x-1/2 pb-1 font-inter text-xs font-semibold whitespace-nowrap text-black group-hover:invisible group-focus:invisible"
                      style={{ bottom: `${altura}%` }}
                    >
                      {formatPrice(columna.margen)}
                    </span>
                  )}
                  <div
                    role="tooltip"
                    className="pointer-events-none invisible absolute left-1/2 z-10 mb-1 w-44 -translate-x-1/2 rounded-[6px] border border-gray-200 bg-white p-3 font-inter text-xs shadow-lg group-hover:visible group-focus:visible"
                    style={{ bottom: `${altura}%` }}
                  >
                    <p className="font-semibold text-black first-letter:uppercase">{columna.largo}</p>
                    <p className="mt-1 flex justify-between gap-2 text-capilar-grey">
                      Cobrado <span className="text-black">{formatPrice(columna.cobrado)}</span>
                    </p>
                    <p className="flex justify-between gap-2 text-capilar-grey">
                      Productos <span className="text-black">{formatPrice(columna.costo)}</span>
                    </p>
                    <p className="flex justify-between gap-2 font-semibold text-black">
                      Margen <span>{formatPrice(columna.margen)}</span>
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="mt-3 ml-22 flex gap-0.5">
          {columnas.map((columna) => (
            <span key={columna.label} className="min-w-0 flex-1 text-center font-inter text-[11px] leading-tight text-capilar-grey">
              {columna.label}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
};

interface RentabilidadGraficosProps {
  token: string;
  reporte: Rentabilidad;
  filtros: FiltrosRentabilidad;
  agrupacion: Agrupacion;
}

// Pestaña Gráficos
export const RentabilidadGraficos = ({ token, reporte, filtros, agrupacion }: RentabilidadGraficosProps) => {
  const { desde, hasta } = reporte;
  const evolucion = useFetch(`rentabilidad-evolucion-${desde}-${hasta}-${agrupacion}-${filtros.legajo}-${filtros.servicioId}`, () =>
    getEvolucionRequest(token, desde, hasta, filtros, agrupacion),
  );

  const { porCantidad, porMargen } = rankingsDe(reporte);
  const columnas = evolucion.data ?? [];
  const mejor = mejorPunto(columnas);
  const nombre = agrupacion === 'semana' ? 'Semana' : 'Mes';

  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 md:grid-cols-3">
        <Destacado
          titulo="Servicio más solicitado"
          valor={porCantidad[0].servicio}
          detalle={`${porCantidad[0].cantidad} ${porCantidad[0].cantidad === 1 ? 'vez' : 'veces'}`}
        />
        <Destacado titulo="Servicio con más margen" valor={porMargen[0].servicio} detalle={`${formatPrice(porMargen[0].margen)} de margen`} />
        <Destacado
          titulo={`${nombre} con más margen`}
          valor={mejor ? mejor.largo : evolucion.isLoading ? '...' : 'Sin margen'}
          detalle={mejor ? `${formatPrice(mejor.margen)} de margen` : ' '}
        />
      </div>

      {evolucion.error ? (
        <Alert variant="error" title="No se pudo cargar la evolución">
          {evolucion.error}
        </Alert>
      ) : evolucion.isLoading ? (
        <Loader label="Armando el gráfico..." className="py-12" />
      ) : (
        <Columnas titulo={`Margen por ${agrupacion === 'semana' ? 'semana' : 'mes'}`} columnas={columnas} mejor={mejor} />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <BarrasHorizontales
          titulo="Servicios más solicitados"
          filas={porCantidad.map((fila) => ({ id: fila.servicioId, label: fila.servicio, valor: fila.cantidad, texto: String(fila.cantidad) }))}
        />
        <BarrasHorizontales
          titulo="Margen por servicio"
          filas={porMargen.map((fila) => ({ id: fila.servicioId, label: fila.servicio, valor: Number(fila.margen), texto: formatPrice(fila.margen) }))}
        />
      </div>
    </div>
  );
};
