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
  rol: Rol;
  fechaAlta: string;
  fechaBaja: string | null;
  // Subtipo según el rol: alergia del cliente, legajo del profesional (null si no lo tiene)
  cliente?: { alergia: string | null } | null;
  profesional?: { legajo: number } | null;
}

export interface AuthResponse {
  accessToken: string;
  user: Usuario;
}

interface MessageResponse {
  message: string;
}

export const loginRequest = (email: string, contrasena: string) =>
  apiFetch<AuthResponse>('/auth/login', { method: 'POST', body: { email, contrasena } });

export const registerRequest = (data: RegisterData) =>
  apiFetch<AuthResponse>('/auth/register', { method: 'POST', body: data });

export const meRequest = (token: string) => apiFetch<Usuario>('/auth/me', { token });

export const forgotPasswordRequest = (email: string) =>
  apiFetch<MessageResponse>('/auth/forgot-password', { method: 'POST', body: { email } });

export const resetPasswordRequest = (token: string, contrasena: string) =>
  apiFetch<MessageResponse>('/auth/reset-password', { method: 'POST', body: { token, contrasena } });
