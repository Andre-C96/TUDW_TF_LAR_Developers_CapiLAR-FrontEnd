import { apiFetch } from './client';
import type { Servicio } from './services';

// Servicios que hace cada profesional. Ver: cualquier usuario logueado; asignar y quitar: solo ADMIN.

// Solo los servicios activos que tiene asignados
export const getProfessionalServicesRequest = (token: string, legajo: number) =>
  apiFetch<Servicio[]>(`/profesionales/${legajo}/servicios`, { token });

// 409 si ya lo tiene; si se lo habían quitado antes, se lo vuelve a asignar
export const assignServiceRequest = (token: string, legajo: number, servicioId: number) =>
  apiFetch<Servicio>(`/profesionales/${legajo}/servicios`, { method: 'POST', body: { servicioId }, token });

// Baja lógica: los turnos ya reservados con ese servicio no se tocan
export const removeServiceRequest = (token: string, legajo: number, servicioId: number) =>
  apiFetch<{ message: string }>(`/profesionales/${legajo}/servicios/${servicioId}`, { method: 'DELETE', token });
