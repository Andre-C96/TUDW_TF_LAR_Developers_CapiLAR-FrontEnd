import { apiFetch } from './client';
import type { Marca } from './articulos';

// Proveedores (F13), solo ADMIN. No tienen marcas asignadas: se le puede comprar cualquier artículo y las marcas salen de sus compras.

export interface Proveedor {
  id: number;
  // Solo los números ("30712345678")
  cuit: string;
  razonSocial: string;
  telefono: string | null;
  email: string | null;
  condicionesComerciales: string | null;
  fechaAlta: string;
  fechaBaja: string | null;
}

// null borra el campo
export interface ProveedorData {
  cuit: string;
  razonSocial: string;
  telefono: string | null;
  email: string | null;
  condicionesComerciales: string | null;
}

// Mismos límites que el back
export const PROVEEDOR_RAZON_MAX = 150;
export const PROVEEDOR_TELEFONO_MAX = 30;
export const PROVEEDOR_EMAIL_MAX = 191;
export const PROVEEDOR_CONDICIONES_MAX = 500;

// "30712345678" -> "30-71234567-8"
export const formatCuit = (cuit: string) => (cuit.length === 11 ? `${cuit.slice(0, 2)}-${cuit.slice(2, 10)}-${cuit.slice(10)}` : cuit);

// Por razón social. incluirBajas: para poder darlos de alta y filtrar compras viejas
export const getProveedoresRequest = (token: string, incluirBajas = false) =>
  apiFetch<Proveedor[]>(`/proveedores${incluirBajas ? '?incluirBajas=true' : ''}`, { token });

export const getProveedorRequest = (token: string, id: number) => apiFetch<Proveedor>(`/proveedores/${id}`, { token });

// Las marcas de sus compras no anuladas
export const getMarcasDeProveedorRequest = (token: string, id: number) => apiFetch<Marca[]>(`/proveedores/${id}/marcas`, { token });

// 409 si ya hay uno con ese CUIT, aunque esté dado de baja
export const createProveedorRequest = (token: string, data: ProveedorData) =>
  apiFetch<Proveedor>('/proveedores', { method: 'POST', body: data, token });

export const updateProveedorRequest = (token: string, id: number, data: Partial<ProveedorData>) =>
  apiFetch<Proveedor>(`/proveedores/${id}`, { method: 'PATCH', body: data, token });

// Baja lógica: no se le pueden cargar compras nuevas, pero las anteriores lo siguen mostrando
export const deactivateProveedorRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/proveedores/${id}`, { method: 'DELETE', token });

export const reactivateProveedorRequest = (token: string, id: number) =>
  apiFetch<Proveedor>(`/proveedores/${id}/alta`, { method: 'PATCH', token });
