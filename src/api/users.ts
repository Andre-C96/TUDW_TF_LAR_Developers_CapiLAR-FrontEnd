import { apiFetch } from './client';
import type { Rol, Usuario } from './auth';

export interface UsersFilters {
  // Busca en nombre, apellido y email
  search?: string;
  rol?: Rol;
}

// Endpoints de usuarios del ADMIN (F02). El back valida el rol y que el admin no se modifique a sí mismo.

// Sin incluirBajas el back oculta a los dados de baja; el listado los muestra al final, en gris
export const getUsersRequest = (token: string, { search, rol }: UsersFilters) => {
  const params = new URLSearchParams({ incluirBajas: 'true' });
  if (search) params.set('search', search);
  if (rol) params.set('rol', rol);
  return apiFetch<Usuario[]>(`/users?${params}`, { token });
};

export const updateUserRoleRequest = (token: string, id: number, rol: Rol) =>
  apiFetch<Usuario>(`/users/${id}/rol`, { method: 'PATCH', body: { rol }, token });

// Baja lógica: el back guarda fechaBaja, la fila queda
export const deactivateUserRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/users/${id}`, { method: 'DELETE', token });

// Vuelve a dar de alta: el back borra fechaBaja
export const reactivateUserRequest = (token: string, id: number) =>
  apiFetch<Usuario>(`/users/${id}/alta`, { method: 'PATCH', token });

// Perfil propio (cualquier rol). Solo se mandan los campos a cambiar; alergia solo para CLIENTE ("" o null la borra)
export interface UpdateProfileData {
  telefono?: string;
  alergia?: string | null;
}

export const updateProfileRequest = (token: string, data: UpdateProfileData) =>
  apiFetch<Usuario>('/users/me', { method: 'PATCH', body: data, token });

// Baja lógica de la propia cuenta: el token actual deja de funcionar
export const deactivateMeRequest = (token: string) =>
  apiFetch<{ message: string }>('/users/me', { method: 'DELETE', token });

// Clientes activos para cargarles un turno desde la agenda (PROFESIONAL y ADMIN). Busca en nombre, apellido y email
export const searchClientsRequest = (token: string, search: string) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  return apiFetch<Usuario[]>(`/users/clientes?${params}`, { token });
};
