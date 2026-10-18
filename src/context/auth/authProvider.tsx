import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { changePasswordRequest, loginRequest, logoutRequest, meRequest, registerRequest } from '../../api/auth';
import type { AuthResponse, Rol, Usuario } from '../../api/auth';
import { ApiError, setSessionHandlers } from '../../api/client';
import type { AuthView } from '../../components/authModal/authModal';
import type { RegisterData } from '../../components/registerForm/registerForm';
import { readValue, useLocalStorage } from '../../customHooks/localStorage/useLocalStorage';
import { AuthContext } from './authContext';

const TOKEN_KEY = 'capilar_token';

// Guarda la sesión (token + usuario) y la recupera al recargar la página con GET /auth/me.
// El accessToken dura 15 min; el refresh token (7 días) va en una cookie httpOnly que el front no ve:
// client.ts renueva el token vencido y avisa acá con los handlers.
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const navigate = useNavigate();
  // Solo el token persiste; el usuario se vuelve a pedir al backend para tener los datos actualizados
  const [token, setToken] = useLocalStorage<string | null>(TOKEN_KEY, null);
  const [user, setUser] = useState<Usuario | null>(null);
  // Si al cargar hay un token guardado, todavía no se sabe si sigue siendo válido
  const [isCheckingSession, setIsCheckingSession] = useState(token !== null);

  // Va antes del efecto de /auth/me: ese pedido ya puede necesitar renovar el token
  useEffect(() => {
    setSessionHandlers({
      getStoredToken: () => readValue<string | null>(TOKEN_KEY, null),
      onRefreshed: ({ accessToken }) => setToken(accessToken),
      onExpired: () => {
        setToken(null);
        setUser(null);
        // Sin token, el efecto de /auth/me ya no corre: si se estaba chequeando la sesión, termina acá
        setIsCheckingSession(false);
        // Si había sesión en pantalla (no al recargar), avisar y abrir el login
        if (user) {
          toast.error('Tu sesión se cerró', { description: 'Iniciá sesión de nuevo para continuar.' });
          navigate('/', { state: { authView: 'login' satisfies AuthView } });
        }
      },
    });
    return () => setSessionHandlers(null);
  }, [user, setToken, navigate]);

  // Otra pestaña cerró sesión, renovó el token o inició sesión
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key !== TOKEN_KEY) return;
      const newToken = readValue<string | null>(TOKEN_KEY, null);
      setToken(newToken);
      if (newToken === null) {
        setUser(null);
        setIsCheckingSession(false);
      } else if (user === null) setIsCheckingSession(true);
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [user, setToken]);

  useEffect(() => {
    if (!token || !isCheckingSession) return;

    let cancelled = false;
    meRequest(token)
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .catch((error) => {
        // 401: no se pudo renovar la sesión o el usuario está dado de baja. Si es un error de red se conserva el token
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

  // El back cierra la sesión en los otros dispositivos y devuelve una nueva para este
  const changePassword = async (actual: string, nueva: string) => {
    if (!token) throw new ApiError('Tu sesión se cerró. Iniciá sesión de nuevo.', 401);
    return startSession(await changePasswordRequest(token, actual, nueva));
  };

  const logout = () => {
    // Invalida el refresh token en el back; si falla (sin conexión), igual se cierra en este navegador
    logoutRequest().catch(() => {});
    setToken(null);
    setUser(null);
  };

  const hasRole = (...roles: Rol[]) => user !== null && roles.includes(user.rol);

  return (
    <AuthContext.Provider
      value={{ user, token, isAuthenticated: user !== null, isCheckingSession, hasRole, login, register, changePassword, logout, updateUser: setUser }}
    >
      {children}
    </AuthContext.Provider>
  );
};
