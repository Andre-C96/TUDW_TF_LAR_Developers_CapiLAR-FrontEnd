import { apiFetch } from './client';
import type { Servicio } from './services';
import { MAX_DIAS_ANTICIPACION, addDays, toIsoDate } from './turnos';

// Servicios que hace cada profesional. Ver: cualquier usuario logueado. Cada profesional elige los suyos del catálogo
// del ADMIN (/me/servicios, solo PROFESIONAL).

// Solo los servicios activos que tiene
export const getProfessionalServicesRequest = (token: string, legajo: number) =>
  apiFetch<Servicio[]>(`/profesionales/${legajo}/servicios`, { token });

export const getMyServicesRequest = (token: string) => apiFetch<Servicio[]>('/profesionales/me/servicios', { token });

// 409 si ya lo tiene; si lo había quitado antes, lo vuelve a sumar
export const addMyServiceRequest = (token: string, servicioId: number) =>
  apiFetch<Servicio>('/profesionales/me/servicios', { method: 'POST', body: { servicioId }, token });

// Baja lógica: los turnos ya reservados con ese servicio no se tocan
export const removeMyServiceRequest = (token: string, servicioId: number) =>
  apiFetch<{ message: string }>(`/profesionales/me/servicios/${servicioId}`, { method: 'DELETE', token });

// --- Profesionales y horarios de trabajo ---

export interface ProfesionalResumen {
  legajo: number;
  nombre: string;
  apellido: string;
}

// Horario de trabajo de una fecha ("YYYY-MM-DD"), con horas "HH:mm". Cada semana puede ser distinta
export interface Disponibilidad {
  id: number;
  fecha: string;
  horarioInicio: string;
  horarioFin: string;
}

// El mismo horario en una o varias fechas (hasta 31): se guardan todas o ninguna
export interface DisponibilidadData {
  fechas: string[];
  horarioInicio: string;
  horarioFin: string;
}

// Mismas reglas que el back
export const MAX_JORNADA_MINUTOS = 12 * 60;
// Los horarios se consultan y se cargan de a 31 días
export const MAX_DIAS_CONSULTA = 31;

// Público: con servicioId, solo los que hacen ese servicio
export const getProfessionalsRequest = (servicioId?: number) =>
  apiFetch<ProfesionalResumen[]>(servicioId ? `/profesionales?servicioId=${servicioId}` : '/profesionales');

// Ver: cualquier usuario logueado. Cargar y quitar: el propio profesional.
// Horarios entre dos fechas (incluidas, de a 31 días como máximo), por fecha y hora
export const getAvailabilityRequest = (token: string, legajo: number, desde: string, hasta: string) =>
  apiFetch<Disponibilidad[]>(`/profesionales/${legajo}/disponibilidad?${new URLSearchParams({ desde, hasta })}`, { token });

// Fechas con horario cargado de hoy a 60 días (lo que se puede reservar), en dos pedidos de hasta 31 días
export const getUpcomingWorkDatesRequest = async (token: string, legajo: number) => {
  const today = new Date();
  const ranges = [0, MAX_DIAS_CONSULTA].map((offset) => [
    toIsoDate(addDays(today, offset)),
    toIsoDate(addDays(today, Math.min(offset + MAX_DIAS_CONSULTA - 1, MAX_DIAS_ANTICIPACION))),
  ]);
  const parts = await Promise.all(ranges.map(([desde, hasta]) => getAvailabilityRequest(token, legajo, desde, hasta)));
  return [...new Set(parts.flat().map((horario) => horario.fecha))];
};

// 409 si se superpone con otro horario de alguna fecha; 400 si la jornada pasa de 12 h, o la fecha ya pasó o está a más de 60 días
export const createAvailabilityRequest = (token: string, legajo: number, data: DisponibilidadData) =>
  apiFetch<Disponibilidad[]>(`/profesionales/${legajo}/disponibilidad`, { method: 'POST', body: data, token });

// Baja lógica de un horario. 409 si hay turnos reservados dentro de ese horario
export const removeAvailabilityRequest = (token: string, legajo: number, id: number) =>
  apiFetch<{ message: string }>(`/profesionales/${legajo}/disponibilidad/${id}`, { method: 'DELETE', token });

// Baja lógica de todos los horarios de una fecha. 409 si hay turnos reservados ese día
export const removeAvailabilityDateRequest = (token: string, legajo: number, fecha: string) =>
  apiFetch<{ message: string }>(`/profesionales/${legajo}/disponibilidad?fecha=${fecha}`, { method: 'DELETE', token });
