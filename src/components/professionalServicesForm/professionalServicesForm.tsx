import { useState } from 'react';
import type { FormEvent } from 'react';
import { formatDuration, formatPrice } from '../../api/services';
import type { Servicio } from '../../api/services';
import { Button } from '../button/button';
import { Form } from '../form/form';
import { Title } from '../title/title';

interface ProfessionalServicesFormProps {
  // Nombre del profesional, para el título
  name: string;
  // Servicios activos del salón (las opciones)
  services: Servicio[];
  // Ids de los que ya tiene asignados
  assignedIds: number[];
  // Recibe los ids tildados; quien lo usa calcula qué asignar y qué quitar y llama a la API
  onSubmit: (selectedIds: number[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Servicios que hace un profesional (ADMIN): lista de servicios activos para tildar o destildar
export const ProfessionalServicesForm = ({
  name,
  services,
  assignedIds,
  onSubmit,
  onCancel,
  isLoading = false,
  error,
}: ProfessionalServicesFormProps) => {
  const [selected, setSelected] = useState(() => new Set(assignedIds));

  const toggle = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSubmit([...selected]);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Servicios</Title>
        <p className="font-inter text-sm text-capilar-grey">
          Elegí qué servicios hace <span className="font-semibold text-black">{name}</span>. Los clientes solo van a
          poder reservarlos con quien los tenga asignados.
        </p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        {services.length === 0 ? (
          <p className="text-center font-inter text-sm text-capilar-grey">
            Todavía no hay servicios cargados. Crealos desde Panel › Servicios.
          </p>
        ) : (
          <fieldset className="max-h-80 divide-y divide-gray-200 overflow-y-auto rounded-[6px] border border-gray-200">
            <legend className="sr-only">Servicios de {name}</legend>
            {services.map((servicio) => (
              <label
                key={servicio.id}
                className="flex cursor-pointer items-center gap-3 px-4 py-3 transition-colors hover:bg-capilar-violet/5"
              >
                <input
                  type="checkbox"
                  checked={selected.has(servicio.id)}
                  onChange={() => toggle(servicio.id)}
                  className="h-4 w-4 shrink-0 cursor-pointer accent-capilar-violet"
                />
                <span className="flex-1 font-inter text-sm text-black">{servicio.tipo}</span>
                <span className="shrink-0 font-inter text-xs text-capilar-grey">
                  {formatDuration(servicio.tiempoDuracion)} · {formatPrice(servicio.precio)}
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-3 uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading || services.length === 0}
            className="flex-1 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Form>
    </div>
  );
};
