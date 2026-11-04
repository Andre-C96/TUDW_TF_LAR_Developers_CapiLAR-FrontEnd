// Tratamientos previos de la ficha. El back guarda un solo texto (tratamientosPrevios, hasta 1000 caracteres),
// así que cada fila va en una línea con formato fijo: "Decoloración | Cada 6 meses | 03/2026" ("-" si falta el dato).
// Las líneas que no tienen ese formato (fichas viejas, texto libre) se conservan como notas.

export const TRATAMIENTOS = ['Coloración', 'Decoloración', 'Mechas o reflejos', 'Alisado', 'Keratina', 'Permanente', 'Botox capilar', 'Henna'];
export const FRECUENCIAS_TRATAMIENTO = ['Una sola vez', 'Cada mes', 'Cada 2 meses', 'Cada 3 meses', 'Cada 6 meses', 'Una vez al año'];

export interface TratamientoPrevio {
  tratamiento: string;
  // "" si no se cargó
  frecuencia: string;
  // "MM/AAAA", o "" si no se cargó
  ultimaVez: string;
}

export interface TratamientosPrevios {
  filas: TratamientoPrevio[];
  notas: string;
}

const SEPARADOR = ' | ';
const VACIO = '-';
const ULTIMA_VEZ = /^\d{2}\/\d{4}$/;

// El separador y los saltos de línea romperían el formato si aparecen en lo que se escribe en "Otro"
const limpiar = (texto: string) => texto.replace(/\|/g, '/').replace(/\s+/g, ' ').trim();

export const parseTratamientos = (texto: string | null): TratamientosPrevios => {
  const filas: TratamientoPrevio[] = [];
  const notas: string[] = [];

  for (const linea of (texto ?? '').split('\n')) {
    const partes = linea.split(SEPARADOR).map((parte) => parte.trim());
    if (partes.length === 3 && partes[0] && partes[0] !== VACIO && (partes[2] === VACIO || ULTIMA_VEZ.test(partes[2]))) {
      filas.push({
        tratamiento: partes[0],
        frecuencia: partes[1] === VACIO ? '' : partes[1],
        ultimaVez: partes[2] === VACIO ? '' : partes[2],
      });
    } else {
      notas.push(linea);
    }
  }

  return { filas, notas: notas.join('\n').trim() };
};

export const serializeTratamientos = ({ filas, notas }: TratamientosPrevios) => {
  const lineas = filas.map(({ tratamiento, frecuencia, ultimaVez }) =>
    [limpiar(tratamiento), limpiar(frecuencia) || VACIO, ultimaVez || VACIO].join(SEPARADOR),
  );
  return [...lineas, notas.trim()].filter(Boolean).join('\n');
};
