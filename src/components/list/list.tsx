import type { HTMLAttributes, Key, ReactNode } from 'react';

interface ListProps<T> extends Omit<HTMLAttributes<HTMLUListElement>, 'children'> {
  items: T[];
  // Cómo se dibuja cada elemento (normalmente con <ListItem />)
  renderItem: (item: T, index: number) => ReactNode;
  // Clave única de cada elemento (ej. el id que viene de la API)
  getKey: (item: T, index: number) => Key;
  // Texto que se muestra cuando no hay elementos
  emptyMessage?: ReactNode;
  // 'filas': una debajo de otra con divisores (usar <ListItem />)
  // 'grilla': cards en columnas, 1 en celular, 2 en tablet y 3 en escritorio (usar <Card />)
  variant?: 'filas' | 'grilla';
}

const variantClasses = {
  filas: 'divide-y divide-gray-200 bg-white border border-gray-200 rounded-[6px] shadow-md',
  grilla: 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6',
};

// Lista genérica: turnos, servicios, clientes, historial, etc.
export const List = <T,>({
  items,
  renderItem,
  getKey,
  emptyMessage = 'No hay elementos para mostrar.',
  variant = 'filas',
  className = '',
  ...props
}: ListProps<T>) => {
  if (items.length === 0) {
    return (
      <p className="py-8 text-center font-inter text-sm text-capilar-grey">
        {emptyMessage}
      </p>
    );
  }

  return (
    <ul className={`${variantClasses[variant]} ${className}`} {...props}>
      {items.map((item, index) => (
        // En la grilla, la card ocupa todo el ancho de su columna y todas las de una fila tienen el mismo alto
        <li key={getKey(item, index)} className={variant === 'grilla' ? 'flex *:flex-1' : undefined}>
          {renderItem(item, index)}
        </li>
      ))}
    </ul>
  );
};

interface ListItemProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  // Elemento a la izquierda (ícono, avatar, foto)
  leading?: ReactNode;
  title: ReactNode;
  // Texto secundario debajo del título (ej. fecha y hora del turno)
  description?: ReactNode;
  // Elemento a la derecha (botones, estado, precio)
  trailing?: ReactNode;
}

// Fila estándar de la lista: [leading] título + descripción [trailing]
export const ListItem = ({
  leading,
  title,
  description,
  trailing,
  className = '',
  ...props
}: ListItemProps) => {
  return (
    <div className={`flex items-center gap-4 px-5 py-4 ${className}`} {...props}>
      {leading && <div className="shrink-0">{leading}</div>}
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <span className="truncate font-inter font-semibold text-black">{title}</span>
        {description && (
          <span className="font-inter text-sm text-capilar-grey">{description}</span>
        )}
      </div>
      {trailing && <div className="flex shrink-0 items-center gap-2">{trailing}</div>}
    </div>
  );
};
