import { useId } from 'react';
import type { ComponentProps, FormEvent } from 'react';

interface SearchBoxProps extends Omit<ComponentProps<'input'>, 'value' | 'onChange' | 'type'> {
  value: string;
  // Devuelve el texto ya extraído del evento, listo para guardarlo en un estado
  onChange: (value: string) => void;
  // Se llama al apretar Enter (opcional; para filtrar en vivo alcanza con onChange)
  onSearch?: (value: string) => void;
  // Texto para lectores de pantalla (no se ve en pantalla)
  label?: string;
}

// Buscador controlado con ícono de lupa y ✕ para limpiar el texto
export const SearchBox = ({
  value,
  onChange,
  onSearch,
  label = 'Buscar',
  placeholder = 'Buscar...',
  id,
  className = '',
  ...props
}: SearchBoxProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSearch?.(value.trim());
  };

  return (
    <form role="search" onSubmit={handleSubmit} className={`relative w-full ${className}`}>
      <label htmlFor={inputId} className="sr-only">
        {label}
      </label>
      {/* Lupa */}
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-capilar-grey"
      >
        <circle cx="11" cy="11" r="7" />
        <path d="m20 20-3.5-3.5" />
      </svg>
      <input
        id={inputId}
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        autoComplete="off"
        className="w-full rounded-[6px] border border-gray-300 py-3 pl-11 pr-10 font-inter text-sm text-black placeholder:text-gray-400 outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 [&::-webkit-search-cancel-button]:appearance-none"
        {...props}
      />
      {/* Franja izquierda con degradado de marca (como la Ficha Técnica); va encima del borde */}
      <span
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 left-0 w-1 rounded-l-[6px] bg-linear-to-b from-capilar-violet to-capilar-peach"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange('')}
          aria-label="Limpiar búsqueda"
          className="absolute right-3 top-1/2 -translate-y-1/2 px-1 leading-none text-capilar-grey opacity-60 transition-opacity hover:opacity-100"
        >
          ✕
        </button>
      )}
    </form>
  );
};
