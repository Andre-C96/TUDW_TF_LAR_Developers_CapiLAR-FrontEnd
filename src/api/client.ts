const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Error con el mensaje que devuelve el backend
export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  // Objeto (va como JSON) o FormData (multipart, ej. una foto)
  body?: unknown;
  // JWT del usuario logueado
  token?: string | null;
}

// Cómo el AuthProvider guarda y corta la sesión; client.ts lo usa para renovar el token vencido
export interface SessionHandlers {
  // Token guardado ahora (otra pestaña pudo haberlo renovado)
  getStoredToken: () => string | null;
  // Sesión nueva que devolvió POST /auth/refresh
  onRefreshed: (session: { accessToken: string }) => void;
  // El refresh token venció o se revocó (otro dispositivo, cambio de contraseña, baja): hay que iniciar sesión
  onExpired: () => void;
}

let sessionHandlers: SessionHandlers | null = null;

export const setSessionHandlers = (handlers: SessionHandlers | null) => {
  sessionHandlers = handlers;
};

// Pide un accessToken nuevo con el refresh token de la cookie httpOnly. Devuelve null si no hay sesión.
const runRefresh = async (failedToken: string): Promise<string | null> => {
  // Otra pestaña ya renovó: usar ese token, porque reusar el refresh token viejo cierra la sesión
  const stored = sessionHandlers?.getStoredToken() ?? null;
  if (stored && stored !== failedToken) return stored;

  let response: Response;
  try {
    response = await fetch(`${API_URL}/auth/refresh`, { method: 'POST', credentials: 'include' });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Probá de nuevo en unos minutos.', 0);
  }
  if (response.status === 401) return null;
  if (!response.ok) throw new ApiError('Ocurrió un error inesperado. Probá de nuevo.', response.status);

  const session = (await response.json()) as { accessToken: string };
  sessionHandlers?.onRefreshed(session);
  return session.accessToken;
};

let refreshing: Promise<string | null> | null = null;

// Un solo refresh aunque fallen varios pedidos a la vez. Entre pestañas se ordena con Web Locks
// (cada refresh rota la cookie: dos pestañas renovando juntas cerrarían la sesión).
const refreshSession = (failedToken: string) => {
  refreshing ??= (
    navigator.locks
      ? navigator.locks.request('capilar-refresh', () => runRefresh(failedToken))
      : runRefresh(failedToken)
  ).finally(() => {
    refreshing = null;
  });
  return refreshing;
};

// Manda el pedido; si el token venció (401), renueva la sesión una vez y lo reintenta
const request = async (path: string, options: RequestOptions) => {
  try {
    return await send(path, options);
  } catch (error) {
    if (!(error instanceof ApiError && error.status === 401 && options.token)) throw error;
    const newToken = await refreshSession(options.token);
    if (!newToken) {
      sessionHandlers?.onExpired();
      throw new ApiError('Tu sesión se cerró. Iniciá sesión de nuevo.', 401);
    }
    return send(path, { ...options, token: newToken });
  }
};

// Manda el pedido y convierte los errores del backend en ApiError
const send = async (path: string, { method = 'GET', body, token }: RequestOptions) => {
  const isFormData = body instanceof FormData;
  const headers: Record<string, string> = {};
  // Con FormData el navegador arma el Content-Type (con el boundary del multipart)
  if (body !== undefined && !isFormData) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      // Manda y recibe la cookie del refresh token (el back solo la usa en /auth)
      credentials: 'include',
      body: body === undefined ? undefined : isFormData ? body : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Probá de nuevo en unos minutos.', 0);
  }

  if (!response.ok) {
    // NestJS responde { message: string | string[] }; con varios mensajes se muestra el primero
    const data = await response.json().catch(() => null);
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(message ?? 'Ocurrió un error inesperado. Probá de nuevo.', response.status);
  }

  return response;
};

// Wrapper de fetch: arma la URL, manda y recibe JSON
export const apiFetch = async <T>(path: string, options: RequestOptions = {}): Promise<T> => {
  const response = await request(path, options);
  return (await response.json().catch(() => null)) as T;
};

// Para archivos que piden token (ej. fotos de perfil): no van directo en un <img>, se bajan y se muestran con URL.createObjectURL
export const apiFetchBlob = async (path: string, token: string): Promise<Blob> => (await request(path, { token })).blob();
