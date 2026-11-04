import { apiFetch } from './client';

// Alergias (F01): la lista del salón la administra el ADMIN y cada clienta elige las suyas.
// Lo que no está en la lista lo escribe en "Otra" (texto libre).

// Mismos límites que el back
export const ALERGIA_NOMBRE_MAX = 100;
export const ALERGIA_DESCRIPCION_MAX = 255;

export interface Alergia {
  id: number;
  nombre: string;
  descripcion: string | null;
  // Dada de baja: ya no se ofrece, pero quien la tiene la conserva
  fechaBaja: string | null;
}

// Lo que se manda al crear; al editar, solo los campos que cambiaron
export interface AlergiaData {
  nombre: string;
  // null la borra
  descripcion: string | null;
}

export interface AlergiaDeCliente {
  id: number;
  nombre: string;
}

export interface ConAlergias {
  alergias: AlergiaDeCliente[];
  // "Otra": lo que no está en la lista. También están acá las cargadas antes de que existiera la lista
  alergia: string | null;
}

// "Amoníaco, Látex, Polvo de arroz" ("" si no tiene ninguna)
export const formatAlergias = (cliente: ConAlergias | null | undefined) =>
  cliente ? [...cliente.alergias.map(({ nombre }) => nombre), cliente.alergia].filter(Boolean).join(', ') : '';

// Endpoints. El listado de activas es público (para el registro); el resto, solo ADMIN.

export const getAlergiasRequest = () => apiFetch<Alergia[]>('/alergias');

// Todas, incluidas las dadas de baja, para poder volver a darlas de alta
export const getAllAlergiasRequest = (token: string) => apiFetch<Alergia[]>('/alergias/todas', { token });

export const createAlergiaRequest = (token: string, data: AlergiaData) =>
  apiFetch<Alergia>('/alergias', { method: 'POST', body: data, token });

export const updateAlergiaRequest = (token: string, id: number, data: Partial<AlergiaData>) =>
  apiFetch<Alergia>(`/alergias/${id}`, { method: 'PATCH', body: data, token });

export const deactivateAlergiaRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/alergias/${id}`, { method: 'DELETE', token });

export const reactivateAlergiaRequest = (token: string, id: number) =>
  apiFetch<Alergia>(`/alergias/${id}/alta`, { method: 'PATCH', token });
