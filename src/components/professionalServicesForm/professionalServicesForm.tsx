import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { agruparPorCategoria, formatDuration, formatPrice } from '../../api/services';
import type { Servicio } from '../../api/services';
import { Button } from '../button/button';
import { Form } from '../form/form';
import { Title } from '../title/title';

interface ProfessionalServicesFormProps {
  // Servicios activos del catálogo del salón (las opciones)
  services: Servicio[];
  // Ids de los que ya tiene
  assignedIds: number[];
  // Recibe los ids tildados; quien lo usa calcula qué sumar y qué quitar y llama a la API
  onSubmit: (selectedIds: number[]) => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Servicios que hace el profesional logueado: lista del catálogo para tildar o destildar
export const ProfessionalServicesForm = ({
  services,
  assignedIds,
  onSubmit,
  onCancel,
  isLoading = false,
  error,
}: ProfessionalServicesFormProps) => {
  const [selected, setSelected] = useState(() => new Set(assignedIds));
  const groupId = useId();
  // Categorías desplegadas: arrancan todas cerradas y cada profesional abre las que necesita
  const [abiertas, setAbiertas] = useState(() => new Set<number>());

  const toggleCategoria = (id: number) =>
    setAbiertas((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

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
        <Title as="h2">Mis servicios</Title>
        <p className="font-inter text-sm text-capilar-grey">
          Elegí qué servicios hacés. Los clientes solo van a poder reservarlos con vos si los tenés tildados.
        </p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        {services.length === 0 ? (
          <p className="text-center font-inter text-sm text-capilar-grey">
            Todavía no hay servicios en el catálogo del salón. Los carga la administración.
          </p>
        ) : (
          // Agrupados por categoría, desplegables para no scrollear de más
          <div className="max-h-96 divide-y divide-gray-200 overflow-y-auto rounded-[6px] border border-gray-200">
            {agruparPorCategoria(services).map(({ categoria, servicios }) => {
              const abierta = abiertas.has(categoria.id);
              const tildados = servicios.filter((s) => selected.has(s.id)).length;
              const panelId = `${groupId}-${categoria.id}`;
              return (
                <div key={categoria.id}>
                  <button
                    type="button"
                    onClick={() => toggleCategoria(categoria.id)}
                    aria-expanded={abierta}
                    aria-controls={panelId}
                    className="flex w-full items-center justify-between gap-3 bg-gray-50 px-4 py-3 text-left transition-colors hover:bg-gray-100"
                  >
                    <span className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{categoria.nombre}</span>
                    <span className="flex items-center gap-2 font-inter text-xs text-capilar-grey">
                      {tildados} de {servicios.length}
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className={`h-4 w-4 transition-transform ${abierta ? 'rotate-180' : ''}`}
                      >
                        <path d="m6 9 6 6 6-6" />
                      </svg>
                    </span>
                  </button>
                  {abierta && (
                    <div id={panelId} role="group" aria-label={categoria.nombre} className="divide-y divide-gray-200 border-t border-gray-200">
                      {servicios.map((servicio) => (
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
                            {formatDuration(servicio.tiempoDuracion)} · Desde {formatPrice(servicio.precio)}
                          </span>
                        </label>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading || services.length === 0}
            className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Form>
    </div>
  );
};
