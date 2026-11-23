interface TabsProps<T extends string> {
  tabs: [T, string][];
  value: T;
  onChange: (value: T) => void;
  // Para lectores de pantalla (ej. "Secciones de la ficha")
  ariaLabel: string;
}

// Pestañas para cambiar de sección sin salir de la página: en mayúsculas, con la elegida subrayada en el color del rol
// (como en la agenda, Rentabilidad y el perfil de la clienta)
export const Tabs = <T extends string>({ tabs, value, onChange, ariaLabel }: TabsProps<T>) => (
  <div role="tablist" aria-label={ariaLabel} className="flex flex-wrap gap-x-6 gap-y-2 border-b border-gray-200">
    {tabs.map(([tab, label]) => (
      <button
        key={tab}
        type="button"
        role="tab"
        aria-selected={value === tab}
        onClick={() => onChange(tab)}
        className={`-mb-px border-b-2 pb-3 font-inter text-sm font-semibold uppercase tracking-widest transition-colors ${
          value === tab ? 'border-capilar-violet text-black' : 'border-transparent text-capilar-grey hover:text-capilar-violet'
        }`}
      >
        {label}
      </button>
    ))}
  </div>
);
