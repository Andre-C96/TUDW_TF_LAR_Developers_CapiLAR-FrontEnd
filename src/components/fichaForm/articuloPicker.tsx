import { useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { TIPOS_DE_PRODUCTO, formatEnvases, formatMarca } from '../../api/articulos';
import type { Articulo } from '../../api/articulos';
import { useDismiss } from '../../customHooks/dismiss/useDismiss';

const MAX_RESULTADOS = 8;

// Ignora mayúsculas y tildes
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase();

interface ArticuloPickerProps {
  value: string;
  onChange: (value: string) => void;
  // Los que se pueden usar en una ficha (activos, de uso salón)
  articulos: Articulo[];
  onSelect: (articulo: Articulo) => void;
  // Si viene, ofrece crear un artículo con lo que se escribió
  onCrear?: (nombre: string) => void;
  'aria-label': string;
  invalid?: boolean;
  className?: string;
}

// Buscador de artículos del stock para un insumo de la ficha: se escribe y se elige de la lista
export const ArticuloPicker = ({ value, onChange, articulos, onSelect, onCrear, 'aria-label': ariaLabel, invalid, className = '' }: ArticuloPickerProps) => {
  const [open, setOpen] = useState(false);
  const [activo, setActivo] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(ref, open, () => setOpen(false));

  const query = normalize(value.trim());
  const resultados = query
    ? articulos
        .filter((a) => normalize([a.nombre, a.codigo, a.tonalidad, formatMarca(a.marca)].filter(Boolean).join(' ')).includes(query))
        .slice(0, MAX_RESULTADOS)
    : [];
  const visible = open && query !== '';
  // "Crear artículo" va siempre al final, también con resultados: puede faltar justo otro tono del mismo producto
  const opciones = resultados.length + (onCrear ? 1 : 0);

  const elegir = (articulo: Articulo) => {
    onSelect(articulo);
    setOpen(false);
  };

  const crear = () => {
    onCrear?.(value.trim());
    setOpen(false);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (!visible || opciones === 0) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setActivo((prev) => (prev + (event.key === 'ArrowDown' ? 1 : -1) + opciones) % opciones);
    }
    // Enter elige la opción en lugar de guardar la ficha
    if (event.key === 'Enter') {
      event.preventDefault();
      const indice = Math.min(activo, opciones - 1);
      if (indice < resultados.length) elegir(resultados[indice]);
      else crear();
    }
  };

  return (
    <div ref={ref} className="relative">
      <input
        role="combobox"
        aria-expanded={visible}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-label={ariaLabel}
        aria-invalid={invalid ? true : undefined}
        autoComplete="off"
        value={value}
        placeholder="Buscar en el stock"
        onChange={(event) => {
          onChange(event.target.value);
          setOpen(true);
          setActivo(0);
        }}
        onKeyDown={onKeyDown}
        className={className}
      />
      {visible && (
        <ul
          id={listId}
          role="listbox"
          className="absolute top-full left-0 z-30 mt-1 max-h-72 w-80 max-w-[80vw] overflow-y-auto rounded-[6px] border border-gray-200 bg-white py-1 shadow-lg"
        >
          {resultados.length === 0 && <li className="px-3 py-2 font-inter text-sm text-capilar-grey">No hay artículos en el stock con ese nombre.</li>}
          {resultados.map((articulo, index) => (
            <li
              key={articulo.id}
              role="option"
              aria-selected={index === activo}
              // mouseDown: para elegir antes de que el input pierda el foco
              onMouseDown={(event) => {
                event.preventDefault();
                elegir(articulo);
              }}
              onMouseEnter={() => setActivo(index)}
              className={`flex cursor-pointer flex-col px-3 py-2 font-inter text-sm ${index === activo ? 'bg-purple-50 text-capilar-violet' : 'text-black'}`}
            >
              <span className="font-semibold">
                {articulo.nombre}
                {articulo.tonalidad && ` · ${articulo.tonalidad}`}
              </span>
              <span className="text-xs text-capilar-grey">
                {formatMarca(articulo.marca)} · {TIPOS_DE_PRODUCTO[articulo.tipoProducto]} ·{' '}
                <span className={articulo.bajoStock ? 'font-semibold text-amber-700' : ''}>{formatEnvases(articulo.stock)}</span>
              </span>
            </li>
          ))}
          {onCrear && (
            <li
              role="option"
              aria-selected={activo === resultados.length}
              onMouseDown={(event) => {
                event.preventDefault();
                crear();
              }}
              onMouseEnter={() => setActivo(resultados.length)}
              className={`cursor-pointer border-t border-gray-100 px-3 py-2 font-inter text-sm font-semibold text-capilar-violet ${activo === resultados.length ? 'bg-purple-50' : ''}`}
            >
              + Crear artículo "{value.trim()}"
            </li>
          )}
        </ul>
      )}
    </div>
  );
};
