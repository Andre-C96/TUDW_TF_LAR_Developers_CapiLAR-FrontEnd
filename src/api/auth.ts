import { apiFetch } from './client';
import type { RegisterData } from '../components/registerForm/registerForm';

export type Rol = 'CLIENTE' | 'PROFESIONAL' | 'ADMIN';

// Usuario tal como lo devuelve el backend (sin contraseña ni token de recupero)
export interface Usuario {
  id: number;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string | null;
  // "YYYY-MM-DD" (opcional)
  fechaNacimiento: string | null;
  rol: Rol;
  // null: todavía no abrió el enlace de verificación (el cliente no puede reservar solo)
  emailVerificadoEn: string | null;
  fechaAlta: string;
  fechaBaja: string | null;
  // Subtipo según el rol: alergia del cliente, legajo del profesional (null si no lo tiene).
  // foto: nombre del archivo en el back o null (la imagen se pide con getUserPhotoRequest)
  cliente?: { alergia: string | null; foto?: string | null } | null;
  profesional?: { legajo: number; foto?: string | null } | null;
}

export interface AuthResponse {
  accessToken: string;
  user: Usuario;
}

interface MessageResponse {
  message: string;
}

export const PASSWORD_HINT = 'Mínimo 8 caracteres, con al menos una letra y un número';

// Mismas reglas que el back: 8 a 72 caracteres, con letra y número. Devuelve el error o undefined
export const validatePassword = (contrasena: string) => {
  if (!contrasena) return 'Ingresá una contraseña';
  if (contrasena.length < 8 || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) return PASSWORD_HINT;
  if (contrasena.length > 72) return 'Máximo 72 caracteres';
  return undefined;
};

export const loginRequest = (email: string, contrasena: string) =>
  apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, contrasena } });

export const registerRequest = (data: RegisterData) =>
  apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: data });

// Invalida el refresh token y borra la cookie (responde 200 aunque la sesión ya no exista)
export const logoutRequest = () => apiFetch<MessageResponse>('/auth/logout', { method: 'POST' });

export const meRequest =(token: string) => apiFetch<Usuario>('/auth/me', { token });

export const forgotPasswordRequest = (email: string) =>
  apiFetch<MessageResponse>('/auth/forgot-password', { method: 'POST', body: { email } });

// Con la sesión iniciada. Devuelve una sesión nueva (como el login) y cierra la de los otros dispositivos.
// 400 si la actual no es correcta o la nueva es igual
export const changePasswordRequest = (token: string, actual: string, nueva: string) =>
  apiFetch<AuthResponse>('/auth/password', { method: 'PATCH', body: { actual, nueva }, token });

// Token del enlace del correo (/verificar-email?token=), sin sesión. Sirve una vez y dura 7 días
export const verifyEmailRequest = (token: string) =>
  apiFetch<MessageResponse>('/auth/verificar-email', { method: 'POST', body: { token } });

export const resetPasswordRequest =(token: string, contrasena: string) =>
  apiFetch<MessageResponse>('/auth/reset-password', { method: 'POST', body: { token, contrasena } });
