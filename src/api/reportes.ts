import { apiFetch } from './client';
import { MAX_DIAS_AGENDA, addDays, addMonths, fromIsoDate, startOfMonth, startOfWeek, toIsoDate } from './turnos';
import type { Turno, TurnoDetalle } from './turnos';

// Rentabilidad (F12), solo ADMIN. Los importes vienen como texto, sin ceros de más ("15000", "254.56").

export interface FilaRentabilidad {
  // Servicios hechos
  cantidad: number;
  cobrado: string;
  costo: string;
  margen: string;
  // Servicios con algún insumo de texto libre, sin costo: su margen real es menor
  conCostoIncompleto: number;
}

export interface Rentabilidad {
  desde: string;
  hasta: string;
  total: FilaRentabilidad & { turnos: number };
  porServicio: (FilaRentabilidad & { servicioId: number; servicio: string })[];
  porProfesional: (FilaRentabilidad & { legajo: number; profesional: string })[];
}

export interface FiltrosRentabilidad {
  legajo?: number;
  servicioId?: number;
}

// Servicios hechos entre dos fechas (incluidas), hasta 366 días
export const getRentabilidadRequest = (token: string, desde: string, hasta: string, { legajo, servicioId }: FiltrosRentabilidad) => {
  const params = new URLSearchParams({ desde, hasta });
  if (legajo) params.set('legajo', String(legajo));
  if (servicioId) params.set('servicioId', String(servicioId));
  return apiFetch<Rentabilidad>(`/reportes/rentabilidad?${params}`, { token });
};

// En los turnos completados, solo para el ADMIN
export interface DetalleConCostos extends TurnoDetalle {
  costo: string | null;
  margen: string | null;
  costoIncompleto: boolean | null;
}

export interface TurnoConCostos extends Omit<Turno, 'detalles'> {
  detalles: DetalleConCostos[];
}

// Turnos completados del período, del más nuevo al más viejo. La agenda se pide de a 31 días: va por tramos
export const getTurnosCompletadosRequest = async (token: string, desde: string, hasta: string, legajo?: number) => {
  const pedidos: Promise<TurnoConCostos[]>[] = [];
  for (let inicio = fromIsoDate(desde); toIsoDate(inicio) <= hasta; inicio = addDays(inicio, MAX_DIAS_AGENDA)) {
    const fin = toIsoDate(addDays(inicio, MAX_DIAS_AGENDA - 1));
    const params = new URLSearchParams({ desde: toIsoDate(inicio), hasta: fin < hasta ? fin : hasta });
    if (legajo) params.set('legajo', String(legajo));
    pedidos.push(apiFetch<TurnoConCostos[]>(`/turnos/agenda?${params}`, { token }));
  }
  const partes = await Promise.all(pedidos);
  return partes
    .flat()
    .filter((turno) => turno.estado === 'COMPLETADO')
    .sort((a, b) => `${b.fecha} ${b.horaInicio}`.localeCompare(`${a.fecha} ${a.horaInicio}`));
};

export type Agrupacion = 'semana' | 'mes';

export interface Tramo {
  desde: string;
  hasta: string;
  // Para el eje del gráfico ("2–8 nov", "nov")
  label: string;
  // Para el destacado ("noviembre 2026")
  largo: string;
}

// Hasta dos meses se ve por semanas; más largo, por meses
export const agrupacionDelRango = (desde: string, hasta: string): Agrupacion =>
  (fromIsoDate(hasta).getTime() - fromIsoDate(desde).getTime()) / 86_400_000 <= 62 ? 'semana' : 'mes';

const diaYMes = (fecha: string) => fromIsoDate(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'short' }).replace('.', '');

const labelSemana = (desde: string, hasta: string) => {
  if (desde === hasta) return diaYMes(desde);
  const mismoMes = desde.slice(0, 7) === hasta.slice(0, 7);
  return mismoMes ? `${fromIsoDate(desde).getDate()}–${diaYMes(hasta)}` : `${diaYMes(desde)}–${diaYMes(hasta)}`;
};

// El período partido en semanas (de lunes a domingo) o meses, recortando los extremos a sus fechas
export const tramosDelPeriodo = (desde: string, hasta: string, agrupacion: Agrupacion): Tramo[] => {
  const tramos: Tramo[] = [];
  const variosAnios = desde.slice(0, 4) !== hasta.slice(0, 4);
  let inicio = desde;
  while (inicio <= hasta) {
    const fecha = fromIsoDate(inicio);
    const finNatural = toIsoDate(agrupacion === 'semana' ? addDays(startOfWeek(fecha), 6) : addDays(addMonths(startOfMonth(fecha), 1), -1));
    const fin = finNatural < hasta ? finNatural : hasta;
    const mes = fecha.toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    tramos.push({
      desde: inicio,
      hasta: fin,
      label: agrupacion === 'semana' ? labelSemana(inicio, fin) : variosAnios ? `${mes} ${String(fecha.getFullYear()).slice(2)}` : mes,
      largo: agrupacion === 'semana' ? labelSemana(inicio, fin) : `${fecha.toLocaleDateString('es-AR', { month: 'long' })} ${fecha.getFullYear()}`,
    });
    inicio = toIsoDate(addDays(fromIsoDate(fin), 1));
  }
  return tramos;
};

export interface PuntoEvolucion {
  label: string;
  largo: string;
  cobrado: number;
  costo: number;
  margen: number;
}

// El reporte solo trae totales: la evolución se arma pidiendo uno por cada semana o mes
export const getEvolucionRequest = async (token: string, desde: string, hasta: string, filtros: FiltrosRentabilidad, agrupacion: Agrupacion) => {
  const tramos = tramosDelPeriodo(desde, hasta, agrupacion);
  const reportes = await Promise.all(tramos.map((tramo) => getRentabilidadRequest(token, tramo.desde, tramo.hasta, filtros)));
  return reportes.map(
    ({ total }, index): PuntoEvolucion => ({
      label: tramos[index].label,
      largo: tramos[index].largo,
      cobrado: Number(total.cobrado),
      costo: Number(total.costo),
      margen: Number(total.margen),
    }),
  );
};

// La semana o el mes con más margen, si dejó algo: entre períodos en cero no hay ninguno para resaltar
export const mejorPunto = (puntos: PuntoEvolucion[]) =>
  puntos.reduce<PuntoEvolucion | null>((actual, punto) => (punto.margen > (actual?.margen ?? 0) ? punto : actual), null);

export const rankingsDe = ({ porServicio }: Rentabilidad) => ({
  porCantidad: [...porServicio].sort((a, b) => b.cantidad - a.cantidad),
  porMargen: [...porServicio].sort((a, b) => Number(b.margen) - Number(a.margen)),
});
