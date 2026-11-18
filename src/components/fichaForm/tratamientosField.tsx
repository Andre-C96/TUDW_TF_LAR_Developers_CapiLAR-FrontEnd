import { FRECUENCIAS_TRATAMIENTO, TRATAMIENTOS } from '../../api/tratamientos';
import { OTRO } from './tratamientoDraft';
import type { TratamientoDraft } from './tratamientoDraft';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const ANIOS_ATRAS = 15;
const TRATAMIENTO_MAX = 60;

interface TratamientosFieldProps {
  filas: TratamientoDraft[];
  onChange: (filas: TratamientoDraft[]) => void;
  // Error de cada fila, por su key
  errores: Record<number, string | undefined>;
  // Clase de los campos, la misma de las fórmulas
  inputClass: string;
}

// Filas de tratamientos previos: tratamiento (lista + "Otro"), frecuencia y última vez (mes y año)
export const TratamientosField = ({ filas, onChange, errores, inputClass }: TratamientosFieldProps) => {
  const actualizar = (key: number, cambios: Partial<TratamientoDraft>) =>
    onChange(filas.map((fila) => (fila.key === key ? { ...fila, ...cambios } : fila)));

  const anioActual = new Date().getFullYear();
  const anios = Array.from({ length: ANIOS_ATRAS + 1 }, (_, index) => String(anioActual - index));
  const selectClass = `${inputClass} border-gray-300 bg-white`;

  return (
    <div className="flex flex-col gap-2">
      {filas.map((fila, index) => {
        const error = errores[fila.key];
        // Un año cargado hace mucho tiene que seguir apareciendo en la lista
        const opcionesAnio = fila.anio && !anios.includes(fila.anio) ? [fila.anio, ...anios] : anios;
        return (
          <div key={fila.key} className="flex flex-col gap-1">
            <div className="grid grid-cols-2 items-start gap-2 sm:grid-cols-[1.5fr_1.2fr_5rem_5rem_auto]">
              <div className="col-span-2 flex flex-col gap-2 sm:col-span-1">
                <select
                  value={fila.opcion}
                  onChange={(event) => actualizar(fila.key, { opcion: event.target.value })}
                  aria-label={`Tratamiento ${index + 1}`}
                  aria-invalid={error ? true : undefined}
                  className={selectClass}
                >
                  <option value="">Tratamiento</option>
                  {TRATAMIENTOS.map((tratamiento) => (
                    <option key={tratamiento} value={tratamiento}>
                      {tratamiento}
                    </option>
                  ))}
                  <option value={OTRO}>{OTRO}</option>
                </select>
                {fila.opcion === OTRO && (
                  <input
                    value={fila.otro}
                    onChange={(event) => actualizar(fila.key, { otro: event.target.value })}
                    maxLength={TRATAMIENTO_MAX}
                    placeholder="¿Cuál?"
                    aria-label={`Otro tratamiento ${index + 1}`}
                    className={`${inputClass} border-gray-300`}
                  />
                )}
              </div>
              <select
                value={fila.frecuencia}
                onChange={(event) => actualizar(fila.key, { frecuencia: event.target.value })}
                aria-label={`Frecuencia del tratamiento ${index + 1}`}
                className={`${selectClass} col-span-2 sm:col-span-1`}
              >
                <option value="">Frecuencia</option>
                {/* Una frecuencia que ya no está en la lista se conserva */}
                {[...(fila.frecuencia && !FRECUENCIAS_TRATAMIENTO.includes(fila.frecuencia) ? [fila.frecuencia] : []), ...FRECUENCIAS_TRATAMIENTO].map((frecuencia) => (
                  <option key={frecuencia} value={frecuencia}>
                    {frecuencia}
                  </option>
                ))}
              </select>
              <select
                value={fila.mes}
                onChange={(event) => actualizar(fila.key, { mes: event.target.value })}
                aria-label={`Mes de la última vez del tratamiento ${index + 1}`}
                className={selectClass}
              >
                <option value="">Mes</option>
                {MESES.map((mes, numero) => (
                  <option key={mes} value={String(numero + 1).padStart(2, '0')}>
                    {mes}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-2 sm:contents">
                <select
                  value={fila.anio}
                  onChange={(event) => actualizar(fila.key, { anio: event.target.value })}
                  aria-label={`Año de la última vez del tratamiento ${index + 1}`}
                  className={selectClass}
                >
                  <option value="">Año</option>
                  {opcionesAnio.map((anio) => (
                    <option key={anio} value={anio}>
                      {anio}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => onChange(filas.filter((x) => x.key !== fila.key))}
                  aria-label={`Quitar el tratamiento ${index + 1}`}
                  className="flex items-center justify-center self-center rounded-lg px-2 text-capilar-grey hover:text-red-500"
                >
                  ✕
                </button>
              </div>
            </div>
            {error && <p className="font-inter text-xs text-red-500">{error}</p>}
          </div>
        );
      })}
    </div>
  );
};
