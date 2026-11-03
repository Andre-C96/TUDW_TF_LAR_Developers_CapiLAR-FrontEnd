import { useEffect, useEffectEvent, useState } from 'react';

interface Result {
  key: string;
  url: string | null;
  failed: boolean;
}

// Para imágenes que piden token (no van directo en un <img>): las baja cada vez que cambia `key`
// (con null no pide nada) y devuelve una URL local, que se libera al cambiar de key o al desmontar.
export const useBlobUrl = (key: string | null, request: () => Promise<Blob>) => {
  const [result, setResult] = useState<Result | null>(null);
  const run = useEffectEvent(request);

  useEffect(() => {
    if (key === null) return;
    let ignore = false;
    let url = '';
    run()
      .then((blob) => {
        if (ignore) return;
        url = URL.createObjectURL(blob);
        setResult({ key, url, failed: false });
      })
      .catch(() => {
        if (!ignore) setResult({ key, url: null, failed: true });
      });
    return () => {
      ignore = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [key]);

  const current = result && result.key === key ? result : null;

  return {
    url: current?.url ?? null,
    failed: current?.failed ?? false,
    isLoading: key !== null && current === null,
  };
};
