import { apiFetch } from './client';

// Categorías de servicios (Color, Corte...) para agruparlos. Las administra el ADMIN
export interface Categoria {
  id: number;
  nombre: string;
  fechaBaja: string | null;
}

// Mismo límite que el back
export const CATEGORIA_NOMBRE_MAX = 100;

// Activas, por nombre (público)
export const getCategoriasRequest = () => apiFetch<Categoria[]>('/categorias');

// Todas, incluidas las dadas de baja (ADMIN), para poder volver a darlas de alta
export const getAllCategoriasRequest = (token: string) => apiFetch<Categoria[]>('/categorias/todas', { token });

// 409 si ya existe una con ese nombre (sin distinguir mayúsculas ni tildes), aunque esté dada de baja
export const createCategoriaRequest = (token: string, nombre: string) =>
  apiFetch<Categoria>('/categorias', { method: 'POST', body: { nombre }, token });

// El nombre nuevo se ve también en sus servicios
export const updateCategoriaRequest = (token: string, id: number, nombre: string) =>
  apiFetch<Categoria>(`/categorias/${id}`, { method: 'PATCH', body: { nombre }, token });

// Baja lógica. 409 si tiene servicios activos (hay que pasarlos a otra o darlos de baja antes)
export const deactivateCategoriaRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/categorias/${id}`, { method: 'DELETE', token });

export const reactivateCategoriaRequest = (token: string, id: number) =>
  apiFetch<Categoria>(`/categorias/${id}/alta`, { method: 'PATCH', token });
