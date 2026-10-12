import { apiFetch, apiFetchBlob } from './client';
import type { Rol, Usuario } from './auth';
import { addDays, toIsoDate } from './turnos';

// --- Datos personales: mismas reglas en el registro y en el perfil ---

// Teléfono: solo números, con característica y sin 0 ni 15 (ej. 2994567890), de 10 a 13 dígitos
export const TELEFONO_MIN = 10;
export const TELEFONO_MAX = 13;
export const TELEFONO_HINT = 'Solo números, con característica y sin 0 ni 15. Ej.: 2994567890';

// Para el onChange: descarta todo lo que no sea un número
export const onlyDigits = (value: string) => value.replace(/\D/g, '').slice(0, TELEFONO_MAX);

// Mensaje de error o undefined si está bien
export const validateTelefono = (telefono: string) => {
  if (!telefono) return 'Ingresá tu teléfono';
  if (!/^\d+$/.test(telefono)) return 'Usá solo números';
  if (telefono.length < TELEFONO_MIN || telefono.length > TELEFONO_MAX) {
    return `Tiene que tener entre ${TELEFONO_MIN} y ${TELEFONO_MAX} números`;
  }
  return undefined;
};

// Alergias o sensibilidades (texto libre, opcional, solo CLIENTE)
export const ALERGIA_MAX = 255;

// Fecha de nacimiento "YYYY-MM-DD", opcional: desde 1900 y anterior a hoy (igual que el back)
export const FECHA_NACIMIENTO_MIN = '1900-01-01';
// Para el max del input: ayer
export const fechaNacimientoMax = () => toIsoDate(addDays(new Date(), -1));

export const validateFechaNacimiento = (fecha: string) => {
  if (!fecha) return undefined;
  if (fecha < FECHA_NACIMIENTO_MIN) return 'Tiene que ser posterior a 1900';
  if (fecha >= toIsoDate(new Date())) return 'Tiene que ser anterior a hoy';
  return undefined;
};

// Años cumplidos a hoy
export const edad = (fechaNacimiento: string) => {
  const [y, m, d] = fechaNacimiento.split('-').map(Number);
  const today = new Date();
  const cumplioEsteAnio = today.getMonth() + 1 > m || (today.getMonth() + 1 === m && today.getDate() >= d);
  return today.getFullYear() - y - (cumplioEsteAnio ? 0 : 1);
};

export const formatEdad = (fechaNacimiento: string) => {
  const anios = edad(fechaNacimiento);
  return `${anios} ${anios === 1 ? 'año' : 'años'}`;
};

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
  // "YYYY-MM-DD"; null la borra
  fechaNacimiento?: string | null;
}

export const updateProfileRequest = (token: string, data: UpdateProfileData) =>
  apiFetch<Usuario>('/users/me', { method: 'PATCH', body: data, token });

// --- Foto de perfil (CLIENTE y PROFESIONAL; el ADMIN no tiene) ---

// Mismas reglas que el back
export const FOTO_MAX_BYTES = 2 * 1024 * 1024;
export const FOTO_TIPOS = ['image/jpeg', 'image/png', 'image/webp'];

// Mensaje de error o undefined si está bien (el back igual revisa el formato real del archivo)
export const validateFoto = (file: File) => {
  if (!FOTO_TIPOS.includes(file.type)) return 'La foto tiene que ser JPG, PNG o WEBP';
  if (file.size > FOTO_MAX_BYTES) return 'La foto no puede superar los 2 MB';
};

// La foto del perfil del rol actual: nombre del archivo o null
export const userPhoto = (user: Usuario) =>
  (user.rol === 'CLIENTE' ? user.cliente?.foto : user.rol === 'PROFESIONAL' ? user.profesional?.foto : null) ?? null;

// Sube o reemplaza la foto propia; devuelve el usuario actualizado
export const updatePhotoRequest = (token: string, file: File) => {
  const body = new FormData();
  body.append('foto', file);
  return apiFetch<Usuario>('/users/me/foto', { method: 'PATCH', body, token });
};

// 404 si no tenía foto
export const removePhotoRequest = (token: string) => apiFetch<Usuario>('/users/me/foto', { method: 'DELETE', token });

// La propia, o la de cualquiera para PROFESIONAL y ADMIN. 404 si no tiene
export const getUserPhotoRequest = (token: string, id: number) => apiFetchBlob(`/users/${id}/foto`, token);

// Baja lógica de la propia cuenta: el token actual deja de funcionar
export const deactivateMeRequest = (token: string) =>
  apiFetch<{ message: string }>('/users/me', { method: 'DELETE', token });

// Clientes activos para cargarles un turno desde la agenda (PROFESIONAL). Busca en nombre, apellido y email
export const searchClientsRequest = (token: string, search: string) => {
  const params = new URLSearchParams();
  if (search) params.set('search', search);
  return apiFetch<Usuario[]>(`/users/clientes?${params}`, { token });
};
