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
  body?: unknown;
  // JWT del usuario logueado
  token?: string | null;
}

// Wrapper de fetch: arma la URL, manda y recibe JSON y convierte los errores del backend en ApiError
export const apiFetch = async <T>(path: string, { method = 'GET', body, token }: RequestOptions = {}): Promise<T> => {
  const headers: Record<string, string> = {};
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new ApiError('No se pudo conectar con el servidor. Probá de nuevo en unos minutos.', 0);
  }

  const data = await response.json().catch(() => null);

  if (!response.ok) {
    // NestJS responde { message: string | string[] }; con varios mensajes se muestra el primero
    const message = Array.isArray(data?.message) ? data.message[0] : data?.message;
    throw new ApiError(message ?? 'Ocurrió un error inesperado. Probá de nuevo.', response.status);
  }

  return data as T;
};
