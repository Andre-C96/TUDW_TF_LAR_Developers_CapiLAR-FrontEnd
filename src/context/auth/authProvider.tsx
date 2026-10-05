import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { loginRequest, meRequest, registerRequest } from '../../api/auth';
import type { AuthResponse, Rol, Usuario } from '../../api/auth';
import { ApiError } from '../../api/client';
import type { RegisterData } from '../../components/registerForm/registerForm';
import { useLocalStorage } from '../../customHooks/localStorage/useLocalStorage';
import { AuthContext } from './authContext';

// Guarda la sesión (token + usuario) y la recupera al recargar la página con GET /auth/me
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  // Solo el token persiste; el usuario se vuelve a pedir al backend para tener los datos actualizados
  const [token, setToken] = useLocalStorage<string | null>('capilar_token', null);
  const [user, setUser] = useState<Usuario | null>(null);
  // Si al cargar hay un token guardado, todavía no se sabe si sigue siendo válido
  const [isCheckingSession, setIsCheckingSession] = useState(token !== null);

  useEffect(() => {
    if (!token || !isCheckingSession) return;

    let cancelled = false;
    meRequest(token)
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error) => {
        // 401: token vencido (dura 1 día) o usuario dado de baja. Si es un error de red se conserva el token
        if (!cancelled && error instanceof ApiError && error.status === 401) setToken(null);
      })
      .finally(() => {
        if (!cancelled) setIsCheckingSession(false);
      });

    return () => {
      cancelled = true;
    };
  }, [token, isCheckingSession, setToken]);

  const startSession = ({ accessToken, user }: AuthResponse) => {
    setToken(accessToken);
    setUser(user);
    return user;
  };

  const login = async (email: string, contrasena: string) => startSession(await loginRequest(email, contrasena));

  // El registro ya devuelve el token: el usuario queda logueado
  const register = async (data: RegisterData) => startSession(await registerRequest(data));

  const logout = () => {
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles: Rol[]) => user !== null && roles.includes(user.rol);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: user !== null, isCheckingSession, hasRole, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
};
