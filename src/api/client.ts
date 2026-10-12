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

// Manda el pedido y convierte los errores del backend en ApiError
const request = async (path: string, { method = 'GET', body, token }: RequestOptions) => {
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
