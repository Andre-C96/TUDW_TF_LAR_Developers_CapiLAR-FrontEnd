import { createContext } from 'react';
import type { Rol, Usuario } from '../../api/auth';
import type { RegisterData } from '../../components/registerForm/registerForm';

export interface AuthContextValue {
  // Usuario logueado; null si no hay sesión
  user: Usuario | null;
  // JWT para las llamadas que requieren sesión
  token: string | null;
  isAuthenticated: boolean;
  // true mientras se valida con el backend la sesión guardada (al recargar la página)
  isCheckingSession: boolean;
  // Solo para mostrar u ocultar acciones: la seguridad real la valida el backend
  hasRole: (...roles: Rol[]) => boolean;
  // Devuelven el usuario logueado; lanzan ApiError con el mensaje del backend si fallan
  login: (email: string, contrasena: string) => Promise<Usuario>;
  register: (data: RegisterData) => Promise<Usuario>;
  logout: () => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);
