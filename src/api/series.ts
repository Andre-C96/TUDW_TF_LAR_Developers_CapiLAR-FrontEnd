import { apiFetch } from './client';
import { addDays, fromIsoDate, toIsoDate } from './turnos';
import type { EstadoTurno } from './turnos';

// Turnos recurrentes (F05): el profesional repite un servicio suyo de un turno CONFIRMADO o COMPLETADO, a la misma hora,
// cada tantos días y hasta 60 días adelante. Cada turno trae su serie (serieId) y la que se armó desde él (serieOrigenId). La clienta solo las ve (y reserva otro horario en las fechas ocupadas).

export type FrecuenciaSerie = 'SEMANAL' | 'QUINCENAL' | 'CADA_20_DIAS' | 'MENSUAL';
// SUSPENDIDA y BAJA cancelan los turnos que no empezaron; una suspendida se puede reactivar
export type EstadoSerie = 'ACTIVA' | 'SUSPENDIDA' | 'BAJA';
// LIBRE: se crea el turno. SIN_HORARIO: el profesional no cargó horario ese día; se crea igual y le llega un mail.
// OCUPADA: no se crea; la clienta elige otro horario de ese día (horariosLibres)
export type EstadoFecha = 'LIBRE' | 'SIN_HORARIO' | 'OCUPADA';

// Mismos días que el back
export const FRECUENCIAS: Record<FrecuenciaSerie, { label: string; dias: number }> = {
  SEMANAL: { label: 'Cada semana', dias: 7 },
  QUINCENAL: { label: 'Cada 15 días', dias: 14 },
  CADA_20_DIAS: { label: 'Cada 20 días', dias: 20 },
  MENSUAL: { label: 'Cada 4 semanas', dias: 28 },
};

export const MAX_DIAS_SERIE = 60;

interface SerieBase {
  turnoOrigenId: number;
  cliente: { id: number; nombre: string; apellido: string };
  legajo: number;
  profesional: string;
  servicioId: number;
  servicio: string;
  frecuencia: FrecuenciaSerie;
  // "HH:mm" del servicio que se repite
  horaInicio: string;
  // "YYYY-MM-DD": primera fecha (la del turno + la frecuencia) y última posible
  fechaInicio: string;
  fechaFin: string;
}

export interface FechaPlanificada {
  fecha: string;
  estado: EstadoFecha;
  // Por qué está ocupada o sin horario
  motivo: string | null;
  // Solo en OCUPADA: otros horarios de inicio libres ese día
  horariosLibres: string[];
}

// Vista previa: no crea nada
export interface PlanSerie extends SerieBase {
  fechas: FechaPlanificada[];
}

// Respuesta de POST /series: cada fecha con el turno creado (null en las ocupadas)
export interface SerieCreada extends PlanSerie {
  id: number;
  estado: EstadoSerie;
  fechas: (FechaPlanificada & { turnoId: number | null })[];
}

export interface TurnoDeSerie {
  id: number;
  horaInicio: string;
  horaFin: string;
  estado: EstadoTurno;
}

export interface Serie extends SerieBase {
  id: number;
  estado: EstadoSerie;
  // Cada fecha con su turno: el activo o, si se canceló, el último. null: estaba ocupada o la serie está suspendida
  fechas: { fecha: string; turno: TurnoDeSerie | null }[];
}

export interface SerieData {
  turnoId: number;
  // Solo si el turno tiene más de un servicio del profesional
  turnoDetalleId?: number;
  frecuencia: FrecuenciaSerie;
  fechaFin: string;
}

// Endpoints

// PROFESIONAL. 409 si el turno ya es parte de una serie
export const previewSerieRequest = (token: string, data: SerieData) =>
  apiFetch<PlanSerie>('/series/vista-previa', { method: 'POST', body: data, token });

// PROFESIONAL: crea la serie ACTIVA y un turno CONFIRMADO en cada fecha LIBRE o SIN_HORARIO. Le avisa a la clienta por mail
export const createSerieRequest = (token: string, data: SerieData) =>
  apiFetch<SerieCreada>('/series', { method: 'POST', body: data, token });

// PROFESIONAL: las que gestiona. CLIENTE: las suyas. Más nuevas primero
export const getSeriesRequest = (token: string) => apiFetch<Serie[]>('/series', { token });

// Solo ACTIVA. Cancela los turnos que no empezaron (motivo opcional, le llega a la clienta)
export const suspendSerieRequest = (token: string, id: number, motivo?: string) =>
  apiFetch<Serie>(`/series/${id}/suspender`, { method: 'PATCH', body: motivo ? { motivo } : {}, token });

// Solo SUSPENDIDA. Vuelve a reservar las fechas por delante sin turno (no las que canceló la clienta)
export const reactivateSerieRequest = (token: string, id: number) =>
  apiFetch<Serie>(`/series/${id}/reactivar`, { method: 'PATCH', token });

// ACTIVA o SUSPENDIDA, sin vuelta atrás. Cancela los turnos que no empezaron
export const endSerieRequest = (token: string, id: number, motivo?: string) =>
  apiFetch<Serie>(`/series/${id}/baja`, { method: 'PATCH', body: motivo ? { motivo } : {}, token });

// --- Ayudas ---

// "Cada 15 días · 10:00"
export const describeSerie = (serie: Pick<SerieBase, 'frecuencia' | 'horaInicio'>) =>
  `${FRECUENCIAS[serie.frecuencia].label.toLowerCase()} a las ${serie.horaInicio}`;

// Con su serie (id -> serie), para la etiqueta "↻ Cada 15 días" de cada turno
export const seriesPorId = (series: Serie[]) => new Map(series.map((serie) => [serie.id, serie]));

// Se puede repetir si no es parte de una serie ni el origen de una que siga vigente (lo mismo que valida el back)
export const puedeRepetir = (turno: { estado: EstadoTurno; serieId?: number | null; serieOrigenId?: number | null }) =>
  (turno.estado === 'CONFIRMADO' || turno.estado === 'COMPLETADO') && turno.serieId == null && turno.serieOrigenId == null;

// Rango de la fecha de fin: desde la primera repetición que todavía no pasó hasta 60 días desde hoy.
// Desde un turno completado hace tiempo, las primeras repeticiones ya pasaron: el back las saltea
export const rangoFechaFin = (fechaTurno: string, frecuencia: FrecuenciaSerie) => {
  const { dias } = FRECUENCIAS[frecuencia];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let min = addDays(fromIsoDate(fechaTurno), dias);
  while (toIsoDate(min) <= toIsoDate(today)) min = addDays(min, dias);
  const max = addDays(today, MAX_DIAS_SERIE);
  return { min, max, vacio: toIsoDate(min) > toIsoDate(max) };
};
