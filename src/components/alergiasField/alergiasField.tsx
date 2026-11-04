import type { ChangeEvent } from 'react';
import type { AlergiaDeCliente } from '../../api/alergias';
import { ALERGIA_MAX } from '../../api/users';
import { FormField } from '../form/form';

interface AlergiasFieldProps {
  // Las de la lista del salón (y, en el perfil, las que ya tiene aunque se hayan dado de baja)
  opciones: AlergiaDeCliente[];
  elegidas: number[];
  onElegidasChange: (elegidas: number[]) => void;
  // Lo que no está en la lista
  otra: string;
  onOtraChange: (otra: string) => void;
  otraError?: string;
  // Más bajo, para el registro
  inputClassName?: string;
}

// Alergias de la clienta: elige de la lista tocando cada una y escribe el resto en "Otra"
export const AlergiasField = ({ opciones, elegidas, onElegidasChange, otra, onOtraChange, otraError, inputClassName }: AlergiasFieldProps) => {
  const alternar = (id: number) => onElegidasChange(elegidas.includes(id) ? elegidas.filter((x) => x !== id) : [...elegidas, id]);

  return (
    <div className="flex flex-col gap-3">
      {opciones.length > 0 && (
        <div role="group" aria-labelledby="alergias-titulo" className="flex flex-col gap-2">
          <span id="alergias-titulo" className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
            Alergias
          </span>
          <div className="flex flex-wrap gap-2">
            {opciones.map(({ id, nombre }) => {
              const elegida = elegidas.includes(id);
              return (
                <button
                  key={id}
                  type="button"
                  aria-pressed={elegida}
                  onClick={() => alternar(id)}
                  className={`rounded-[4px] border px-3 py-1.5 font-inter text-sm transition-colors ${
                    elegida
                      ? 'border-capilar-violet bg-capilar-violet text-white'
                      : 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
                  }`}
                >
                  {nombre}
                </button>
              );
            })}
          </div>
        </div>
      )}
      <FormField
        label={opciones.length > 0 ? 'Otra' : 'Alergias'}
        value={otra}
        onChange={(event: ChangeEvent<HTMLInputElement>) => onOtraChange(event.target.value)}
        maxLength={ALERGIA_MAX}
        placeholder="Lo que no esté en la lista"
        hint="Opcional. Nos ayuda a cuidarte en cada servicio."
        error={otraError}
        className={inputClassName}
      />
    </div>
  );
};
