import { useEffect, useEffectEvent } from 'react';
import type { RefObject } from 'react';

// Mientras `open`, llama a onClose al tocar fuera de `ref` o al apretar Escape (ej. desplegables)
export const useDismiss = (ref: RefObject<HTMLElement | null>, open: boolean, onClose: () => void) => {
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) close();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') close();
    };
    document.addEventListener('mousedown', onMouseDown);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onMouseDown);
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [ref, open]);
};
