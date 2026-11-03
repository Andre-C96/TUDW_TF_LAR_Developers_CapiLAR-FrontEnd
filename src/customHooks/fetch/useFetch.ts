import { useEffect, useEffectEvent, useState } from 'react';
import { ApiError } from '../../api/client';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

interface Result<T> {
  key: string;
  data: T | null;
  error: string;
}

// Pide datos al back cada vez que cambia `key` (con null no pide nada).
// `key` tiene que resumir todo lo que usa la request (ej. `agenda-${desde}-${hasta}`).
// Devuelve los datos de esa key: mientras carga, data es null; al cambiar de key, no muestra los datos viejos.
export const useFetch = <T>(key: string | null, request: () => Promise<T>) => {
  const [result, setResult] = useState<Result<T> | null>(null);
  const [version, setVersion] = useState(0);
  const fullKey = key === null ? null : `${key}#${version}`;
  const run = useEffectEvent(request);

  useEffect(() => {
    if (fullKey === null) return;
    let ignore = false;
    run()
      .then((data) => {
        if (!ignore) setResult({ key: fullKey, data, error: '' });
      })
      .catch((err) => {
        if (!ignore) setResult({ key: fullKey, data: null, error: err instanceof ApiError ? err.message : unexpectedError });
      });
    return () => {
      ignore = true;
    };
  }, [fullKey]);

  const current = result && result.key === fullKey ? result : null;

  return {
    data: current?.data ?? null,
    error: current?.error ?? '',
    isLoading: fullKey !== null && current === null,
    // Vuelve a pedir los datos al back
    reload: () => setVersion((prev) => prev + 1),
    // Actualiza los datos en pantalla sin volver a pedirlos (ej. con lo que devolvió un PATCH)
    setData: (update: (prev: T) => T) =>
      setResult((prev) => (prev && prev.data !== null ? { ...prev, data: update(prev.data) } : prev)),
  };
};
