import { apiFetch } from './client';
import type { Pagina } from './client';
import type { ArticuloSinStock, Marca } from './articulos';
import type { UnidadInsumo } from './fichas';

// Compras a proveedores (F13), solo ADMIN. Al cargarla suma el stock y el costo de cada línea pasa a ser el precio de costo
// del artículo. Al anularla el stock vuelve atrás, pero el precio de costo no.

export type EstadoCompra = 'APLICADO' | 'ANULADO';

export const ESTADOS_COMPRA: Record<EstadoCompra, string> = { APLICADO: 'Aplicada', ANULADO: 'Anulada' };

export interface LineaCompra {
  id: number;
  articulo: { id: number; nombre: string; codigo: string | null; tipoPeso: UnidadInsumo; pesoInicial: string; marca: Marca };
  // En envases
  cantidad: string;
  costoUnitario: string;
  subtotal: string;
}

export interface Compra {
  id: number;
  fecha: string;
  estado: EstadoCompra;
  numComprobante: string;
  // Por qué se anuló
  motivo: string | null;
  proveedor: { id: number; cuit: string; razonSocial: string };
  usuario: { id: number; nombre: string; apellido: string };
  lineas: LineaCompra[];
  total: string;
}

export interface CompraData {
  proveedorId: number;
  numComprobante: string;
  lineas: { articuloId: number; cantidad: number; costoUnitario: number }[];
}

export interface FiltrosCompras {
  proveedorId?: number;
  estado?: EstadoCompra;
  desde?: string;
  hasta?: string;
  numComprobante?: string;
}

// Mismos límites que el back
export const COMPROBANTE_MAX = 30;
export const LINEAS_COMPRA_MAX = 50;

// De la más nueva a la más vieja
export const getComprasRequest = (token: string, pagina: number, porPagina: number, filtros: FiltrosCompras = {}) => {
  const params = new URLSearchParams({ pagina: String(pagina), porPagina: String(porPagina) });
  for (const [clave, valor] of Object.entries(filtros)) {
    if (valor) params.set(clave, String(valor));
  }
  return apiFetch<Pagina<Compra>>(`/compras?${params}`, { token });
};

export const getCompraRequest = (token: string, id: number) => apiFetch<Compra>(`/compras/${id}`, { token });

// 409 si ese proveedor ya tiene una compra no anulada con el mismo comprobante
export const createCompraRequest = (token: string, data: CompraData) => apiFetch<Compra>('/compras', { method: 'POST', body: data, token });

// sinStock: los artículos que quedaron por debajo de 0, si lo comprado ya se usó
export const anularCompraRequest = (token: string, id: number, motivo: string) =>
  apiFetch<{ compra: Compra; sinStock: ArticuloSinStock[] }>(`/compras/${id}/anular`, { method: 'PATCH', body: { motivo }, token });
