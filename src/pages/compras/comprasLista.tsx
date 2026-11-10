import { Link } from 'react-router-dom';
import { ESTADOS_COMPRA } from '../../api/compras';
import type { Compra } from '../../api/compras';
import { formatPrice } from '../../api/services';
import { List, ListItem } from '../../components/list/list';

interface ComprasListaProps {
  compras: Compra[];
  emptyMessage: string;
}

// Una fila por compra, con link a su detalle. La usan Compras y el detalle del proveedor
export const ComprasLista = ({ compras, emptyMessage }: ComprasListaProps) => (
  <List
    items={compras}
    getKey={(compra) => compra.id}
    emptyMessage={emptyMessage}
    renderItem={(compra) => {
      const anulada = compra.estado === 'ANULADO';
      return (
        <ListItem
          title={
            <Link to={`/panel/compras/${compra.id}`} className="hover:text-capilar-violet">
              {compra.proveedor.razonSocial}
            </Link>
          }
          description={`${new Date(compra.fecha).toLocaleDateString('es-AR')} · Comprobante ${compra.numComprobante}`}
          className={anulada ? 'bg-gray-50 opacity-60' : ''}
          trailing={
            <span className="flex flex-col items-end font-inter text-sm">
              <span className="font-semibold text-black">{formatPrice(compra.total)}</span>
              <span className={`text-xs font-semibold ${anulada ? 'text-red-600' : 'text-capilar-grey'}`}>{ESTADOS_COMPRA[compra.estado]}</span>
            </span>
          }
        />
      );
    }}
  />
);
