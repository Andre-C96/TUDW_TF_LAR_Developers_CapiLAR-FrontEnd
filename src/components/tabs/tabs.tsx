interface TabsProps<T extends string> {
  tabs: [T, string][];
  value: T;
  onChange: (value: T) => void;
  // Para lectores de pantalla (ej. "Secciones de la ficha")
  ariaLabel: string;
  // 'carpeta': como las del navegador, la elegida queda unida a la línea de abajo (ficha técnica).
  // 'subrayado': en mayúsculas con la elegida subrayada en violeta, como en Rentabilidad (secciones de una página)
  variant?: 'carpeta' | 'subrayado';
}

const variantes = {
  carpeta: {
    lista: 'flex flex-wrap gap-1 border-b border-gray-300',
    tab: '-mb-px rounded-t-[4px] border px-4 py-2 font-inter text-sm font-medium transition-colors',
    activa: 'border-gray-300 border-b-white bg-white text-black',
    inactiva: 'border-transparent bg-gray-50 text-capilar-grey hover:text-capilar-violet',
  },
  subrayado: {
    lista: 'flex gap-6 border-b border-gray-200',
    tab: '-mb-px border-b-2 pb-3 font-inter text-sm font-semibold uppercase tracking-widest transition-colors',
    activa: 'border-capilar-violet text-black',
    inactiva: 'border-transparent text-capilar-grey hover:text-capilar-violet',
  },
};

// Pestañas para cambiar de sección sin salir de la página
export const Tabs = <T extends string>({ tabs, value, onChange, ariaLabel, variant = 'carpeta' }: TabsProps<T>) => {
  const estilos = variantes[variant];
  return (
    <div role="tablist" aria-label={ariaLabel} className={estilos.lista}>
      {tabs.map(([tab, label]) => (
        <button
          key={tab}
          type="button"
          role="tab"
          aria-selected={value === tab}
          onClick={() => onChange(tab)}
          className={`${estilos.tab} ${value === tab ? estilos.activa : estilos.inactiva}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
};
