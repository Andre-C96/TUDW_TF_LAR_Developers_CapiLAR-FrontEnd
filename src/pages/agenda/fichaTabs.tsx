interface FichaTabsProps<T extends string> {
  tabs: [T, string][];
  value: T;
  onChange: (value: T) => void;
}

// Pestañas de la ficha, como las del navegador: la elegida queda unida a la línea de abajo
export const FichaTabs = <T extends string>({ tabs, value, onChange }: FichaTabsProps<T>) => (
  <div role="tablist" aria-label="Secciones de la ficha" className="flex flex-wrap gap-1 border-b border-gray-300">
    {tabs.map(([tab, label]) => (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={value === tab}
        onClick={() => onChange(tab)}
        className={`-mb-px rounded-t-[4px] border px-4 py-2 font-inter text-sm font-medium transition-colors ${
          value === tab ? 'border-gray-300 border-b-white bg-white text-black' : 'border-transparent bg-gray-50 text-capilar-grey hover:text-capilar-violet'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);
