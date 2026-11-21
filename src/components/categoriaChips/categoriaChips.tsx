interface CategoriaChipsProps {
  categorias: { id: number; nombre: string }[];
  // La elegida; null: todas
  value: number | null;
  onChange: (id: number | null) => void;
}

// Filtro de servicios por categoría (reserva y alta de turno): "Todas" y un chip por categoría.
// Mismo redondeado que los botones; el elegido, con borde violeta y fondo lila (como el servicio elegido)
export const CategoriaChips = ({ categorias, value, onChange }: CategoriaChipsProps) => (
  <div role="group" aria-label="Filtrar por categoría" className="flex flex-wrap gap-2">
    {[{ id: null, nombre: 'Todas' }, ...categorias].map((categoria) => {
      const active = categoria.id === value;
      return (
        <button
          key={categoria.id ?? 'todas'}
          type="button"
          aria-pressed={active}
          onClick={() => onChange(categoria.id)}
          className={`rounded-[4px] border px-4 py-1.5 font-inter text-sm transition-colors ${
            active
              ? 'border-capilar-violet bg-capilar-violet/10 font-semibold text-black'
              : 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
          }`}
        >
          {categoria.nombre}
        </button>
      );
    })}
  </div>
);
