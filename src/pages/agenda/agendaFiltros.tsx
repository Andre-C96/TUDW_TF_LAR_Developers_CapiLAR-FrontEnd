import { useEffect, useId, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { addDays, fromIsoDate } from '../../api/turnos';
import { RangeDatePicker } from '../../components/datePicker/datePicker';
import type { DateRange } from '../../components/datePicker/datePicker';
import { useDismiss } from '../../customHooks/dismiss/useDismiss';

// Rango más largo que se puede pedir (la agenda se pide de a 31 días: son hasta 12 pedidos)
const MAX_DIAS_RANGO = 365;

const controlClass =
  'rounded-[6px] border border-gray-300 bg-white py-2 font-inter text-sm font-semibold text-black outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20';

const ChevronDown = ({ className = '' }: { className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2.5}
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
    className={`pointer-events-none h-3.5 w-3.5 text-capilar-grey ${className}`}
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

interface FilterSelectProps<T extends string> {
  label: string;
  value: T;
  options: [T, string][];
  onChange: (value: T) => void;
}

// Desplegable con etiqueta chica al lado (ej. "Fecha", "Estado"). Es propio y no un <select>: el menú del navegador
// no deja redondear las esquinas ni cambiar el color al pasar el mouse. Se maneja con flechas, Enter y Escape.
export const FilterSelect = <T extends string>({ label, value, options, onChange }: FilterSelectProps<T>) => {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const labelId = useId();
  useDismiss(ref, open, () => setOpen(false));

  // Al abrir, el foco va a la opción elegida
  useEffect(() => {
    if (open) listRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')?.focus();
  }, [open]);

  const choose = (option: T) => {
    onChange(option);
    setOpen(false);
    ref.current?.querySelector<HTMLElement>('button')?.focus();
  };

  // Flechas entre las opciones (de la última vuelve a la primera)
  const onListKeyDown = (event: KeyboardEvent<HTMLUListElement>) => {
    if (event.key === 'Tab') setOpen(false);
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    const items = [...(listRef.current?.querySelectorAll<HTMLElement>('[role="option"]') ?? [])];
    const index = items.indexOf(document.activeElement as HTMLElement);
    items[(index + (event.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
  };

  return (
    <div ref={ref} className="flex shrink-0 items-center gap-2">
      <span id={labelId} className="font-inter text-xs text-capilar-grey">
        {label}
      </span>
      <div className="relative">
        <button
          type="button"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-labelledby={labelId}
          onClick={() => setOpen((prev) => !prev)}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault();
              setOpen(true);
            }
          }}
          className={`flex cursor-pointer items-center gap-6 pr-3.5 pl-4 ${controlClass}`}
        >
          {options.find(([option]) => option === value)?.[1]}
          <ChevronDown className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {open && (
          <ul
            ref={listRef}
            role="listbox"
            aria-labelledby={labelId}
            onKeyDown={onListKeyDown}
            className="absolute top-full left-0 z-30 mt-1 min-w-full overflow-hidden rounded-[6px] border border-gray-200 bg-white py-1 shadow-lg"
          >
            {options.map(([option, text]) => {
              const selected = option === value;
              return (
                <li
                  key={option}
                  role="option"
                  aria-selected={selected}
                  tabIndex={-1}
                  onClick={() => choose(option)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      choose(option);
                    }
                  }}
                  className={`cursor-pointer px-4 py-2 font-inter text-sm whitespace-nowrap outline-none transition-colors hover:bg-purple-50 hover:text-capilar-violet focus:bg-purple-50 focus:text-capilar-violet ${
                    selected ? 'font-semibold text-capilar-violet' : 'text-black'
                  }`}
                >
                  {text}
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

// "12 oct" (con el año si no es el actual)
const formatCorta = (fecha: string) => {
  const date = fromIsoDate(fecha);
  return date.toLocaleDateString('es-AR', {
    day: 'numeric',
    month: 'short',
    year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
  });
};

interface RangoFieldProps {
  value: DateRange;
  onChange: (range: DateRange) => void;
}

// Botón con el rango elegido que despliega un calendario (un mes, con flechas). Se cierra al elegir "hasta",
// con Escape o tocando afuera. Arranca abierto si todavía no hay rango.
export const RangoField = ({ value, onChange }: RangoFieldProps) => {
  const [open, setOpen] = useState(!value.hasta);
  // Mientras se elige, el rango vive acá: la agenda se pide recién con las dos fechas
  const [draft, setDraft] = useState(value);
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(ref, open, () => setOpen(false));

  const select = (range: DateRange) => {
    setDraft(range);
    if (range.hasta) {
      onChange(range);
      setOpen(false);
    }
  };

  // Con "desde" elegido, "hasta" puede estar como mucho a un año
  const limite = draft.desde && !draft.hasta ? fromIsoDate(draft.desde) : null;

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        onClick={() => {
          setDraft(value);
          setOpen((prev) => !prev);
        }}
        aria-expanded={open}
        className={`flex items-center gap-2 px-4 ${controlClass}`}
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
          className="h-4 w-4 text-capilar-violet"
        >
          <rect x="3" y="5" width="18" height="16" rx="2" />
          <path d="M3 10h18M8 3v4M16 3v4" />
        </svg>
        {value.hasta ? (
          value.desde === value.hasta ? (
            formatCorta(value.desde)
          ) : (
            `${formatCorta(value.desde)} – ${formatCorta(value.hasta)}`
          )
        ) : (
          <span className="font-normal text-capilar-grey">Elegí desde y hasta</span>
        )}
        <ChevronDown />
      </button>

      {open && (
        <div className="absolute top-full left-0 z-30 mt-2 rounded-[6px] border border-gray-200 bg-white p-3 shadow-lg">
          <p className="px-2 font-inter text-xs text-capilar-grey">
            {draft.desde && !draft.hasta ? 'Ahora elegí hasta qué día.' : 'Elegí desde qué día.'}
          </p>
          <RangeDatePicker
            value={draft}
            onChange={select}
            min={limite ? addDays(limite, -MAX_DIAS_RANGO) : undefined}
            max={limite ? addDays(limite, MAX_DIAS_RANGO) : undefined}
            className="rdp-compact"
          />
        </div>
      )}
    </div>
  );
};
