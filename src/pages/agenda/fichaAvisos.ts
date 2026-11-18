import { toast } from 'sonner';
import type { ArticuloSinStock } from '../../api/articulos';

// El stock se descuenta igual aunque no alcance: es un aviso para revisarlo
export const avisarSinStock = (sinStock: ArticuloSinStock[] = []) => {
  if (sinStock.length > 0) {
    toast.warning('Hay artículos con stock negativo', { description: sinStock.map((articulo) => articulo.nombre).join(', ') });
  }
};
