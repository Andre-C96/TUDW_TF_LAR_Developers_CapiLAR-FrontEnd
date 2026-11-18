import { TRATAMIENTOS } from '../../api/tratamientos';
import type { TratamientoPrevio } from '../../api/tratamientos';

export const OTRO = 'Otro';

// Una fila mientras se edita
export interface TratamientoDraft {
  key: number;
  // Uno de la lista, "Otro" o "" si todavía no se eligió
  opcion: string;
  // Lo que se escribe con "Otro"
  otro: string;
  frecuencia: string;
  // "01" a "12"
  mes: string;
  anio: string;
}

let nextKey = 0;
export const newTratamiento = (): TratamientoDraft => ({ key: nextKey++, opcion: '', otro: '', frecuencia: '', mes: '', anio: '' });

// Lo guardado -> fila: lo que no está en la lista va como "Otro"
export const toTratamientoDraft = ({ tratamiento, frecuencia, ultimaVez }: TratamientoPrevio): TratamientoDraft => {
  const [mes = '', anio = ''] = ultimaVez ? ultimaVez.split('/') : [];
  const deLaLista = TRATAMIENTOS.includes(tratamiento);
  return { key: nextKey++, opcion: deLaLista ? tratamiento : OTRO, otro: deLaLista ? '' : tratamiento, frecuencia, mes, anio };
};

export const filaVacia = ({ opcion, otro, frecuencia, mes, anio }: TratamientoDraft) => !opcion && !otro.trim() && !frecuencia && !mes && !anio;

// Mensaje de error de la fila, o undefined si está bien
export const validarTratamiento = (fila: TratamientoDraft) => {
  if (!fila.opcion) return 'Elegí el tratamiento';
  if (fila.opcion === OTRO && !fila.otro.trim()) return 'Escribí cuál fue el tratamiento';
  if (Boolean(fila.mes) !== Boolean(fila.anio)) return 'Elegí el mes y el año de la última vez';
  return undefined;
};

export const fromTratamientoDraft = ({ opcion, otro, frecuencia, mes, anio }: TratamientoDraft): TratamientoPrevio => ({
  tratamiento: opcion === OTRO ? otro : opcion,
  frecuencia,
  ultimaVez: mes && anio ? `${mes}/${anio}` : '',
});
