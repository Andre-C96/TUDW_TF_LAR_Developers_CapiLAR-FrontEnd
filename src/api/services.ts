import { apiFetch } from './client';

export interface Servicio {
  id: number;
  tipo: string;
  // Minutos
  tiempoDuracion: number;
  // El back lo manda como texto con 2 decimales
  precio: string;
  fechaBaja: string | null;
}

// Lo que se manda al crear; al editar, solo los campos que cambiaron
export interface ServicioData {
  tipo: string;
  tiempoDuracion: number;
  precio: number;
}

// Mismas reglas que el back: de un diagnóstico de 15 min al máximo de un turno, 7 h
export const SERVICIO_DURACION_MIN = 15;
export const SERVICIO_DURACION_MAX = 7 * 60;
export const SERVICIO_TIPO_MAX = 100;

// Endpoints de servicios. El listado de activos es público; el resto, solo ADMIN.

// Servicios que ofrece el salón (solo activos), sin iniciar sesión
export const getServicesRequest = () => apiFetch<Servicio[]>('/servicios');

// Todos, incluidos los dados de baja (ADMIN), para poder volver a darlos de alta
export const getAllServicesRequest = (token: string) => apiFetch<Servicio[]>('/servicios/todos', { token });

export const createServiceRequest = (token: string, data: ServicioData) =>
  apiFetch<Servicio>('/servicios', { method: 'POST', body: data, token });

// Los turnos ya reservados conservan el precio con el que se reservaron
export const updateServiceRequest = (token: string, id: number, data: Partial<ServicioData>) =>
  apiFetch<Servicio>(`/servicios/${id}`, { method: 'PATCH', body: data, token });

// Baja lógica: deja de ofrecerse, pero los turnos que ya lo usan lo siguen mostrando
export const deactivateServiceRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/servicios/${id}`, { method: 'DELETE', token });

export const reactivateServiceRequest = (token: string, id: number) =>
  apiFetch<Servicio>(`/servicios/${id}/alta`, { method: 'PATCH', token });

// "1 h 30 min", "45 min", "2 h"
export const formatDuration = (minutes: number) => {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (!hours) return `${rest} min`;
  return rest ? `${hours} h ${rest} min` : `${hours} h`;
};

// "$ 15.000" o "$ 15.000,50"
export const formatPrice = (precio: string | number) =>
  new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 2 }).format(
    Number(precio),
  );
