import { useCallback, useState } from 'react';

// Lee un valor guardado; si no existe o no se puede leer (modo privado, JSON inválido) devuelve el inicial
const readValue = <T,>(key: string, initialValue: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return stored !== null ? (JSON.parse(stored) as T) : initialValue;
  } catch {
    return initialValue;
  }
};

// Como useState, pero el valor se guarda en localStorage y sobrevive a recargar la página.
// Guardar null lo borra del almacenamiento.
export const useLocalStorage = <T,>(key: string, initialValue: T) => {
  const [value, setValue] = useState<T>(() => readValue(key, initialValue));

  // useCallback: la función no cambia entre renders, así se puede usar en dependencias de useEffect
  const setStoredValue = useCallback(
    (newValue: T) => {
      setValue(newValue);
      try {
        if (newValue === null) localStorage.removeItem(key);
        else localStorage.setItem(key, JSON.stringify(newValue));
      } catch {
        // Sin almacenamiento disponible: el valor dura hasta recargar
      }
    },
    [key],
  );

  return [value, setStoredValue] as const;
};
