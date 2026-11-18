import { textoSinPrecio } from '../../api/fichas';
import type { TotalDeProductos } from '../../api/fichas';
import { formatPrice } from '../../api/services';

// Total de los productos de una ficha, al final de la lista. Sin productos no muestra nada
export const TotalProductos = ({ total, sinPrecio, estimado }: TotalDeProductos) => {
  if (total === 0 && sinPrecio === 0) return null;
  return (
    <div className="flex flex-col gap-0.5 border-t border-gray-200 pt-3 font-inter">
      <p className="flex items-baseline justify-between gap-4 text-sm font-semibold text-black">
        <span>Total de productos{estimado && <span className="font-normal text-capilar-grey"> (estimado)</span>}</span>
        <span className="shrink-0">{formatPrice(total)}</span>
      </p>
      {sinPrecio > 0 && <p className="text-xs text-capilar-grey">{textoSinPrecio(sinPrecio)}</p>}
    </div>
  );
};
