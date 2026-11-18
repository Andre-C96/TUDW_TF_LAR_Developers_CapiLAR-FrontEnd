import { apiFetch } from './client';
import type { Pagina } from './client';
import type { UnidadInsumo } from './fichas';
import { fromIsoDate } from './turnos';

// Stock (F11). El ADMIN carga artículos y marcas; ADMIN y PROFESIONAL mueven el stock y manejan el envase abierto.
// El stock se cuenta en envases, con hasta 3 decimales. Los decimales llegan como texto sin ceros al final ("3.5", "15000").

export type UsoArticulo = 'SALON' | 'VENTA' | 'AMBOS';
export type TipoProducto =
  | 'TINTURA'
  | 'OXIDANTE'
  | 'DECOLORANTE'
  | 'PERMANENTE'
  | 'SHAMPOO'
  | 'ACONDICIONADOR'
  | 'MASCARA'
  | 'AMPOLLA'
  | 'SERUM'
  | 'PEINADO'
  | 'PROTECTOR_TERMICO'
  | 'KIT'
  | 'OTRO';
export type TipoDeposito = 'SALON' | 'DEPOSITO' | 'VITRINA';
// COMPRA llega con proveedores (F13) y CONSUMO lo genera la ficha: a mano solo se cargan los otros tres
export type TipoMovimiento = 'COMPRA' | 'INGRESO' | 'EGRESO' | 'AJUSTE' | 'CONSUMO';
export type TipoMovimientoManual = 'INGRESO' | 'EGRESO' | 'AJUSTE';

// Textos para la interfaz
export const USOS: Record<UsoArticulo, string> = { SALON: 'Salón', VENTA: 'Venta', AMBOS: 'Salón y venta' };
export const TIPOS_DE_PRODUCTO: Record<TipoProducto, string> = {
  TINTURA: 'Tintura',
  OXIDANTE: 'Oxidante',
  DECOLORANTE: 'Decolorante',
  PERMANENTE: 'Permanente',
  SHAMPOO: 'Shampoo',
  ACONDICIONADOR: 'Acondicionador',
  MASCARA: 'Máscara',
  AMPOLLA: 'Ampolla',
  SERUM: 'Sérum',
  PEINADO: 'Peinado',
  PROTECTOR_TERMICO: 'Protector térmico',
  KIT: 'Kit',
  OTRO: 'Otro',
};
export const DEPOSITOS: Record<TipoDeposito, string> = { SALON: 'Salón', DEPOSITO: 'Depósito', VITRINA: 'Vitrina' };
export const TIPOS_DE_MOVIMIENTO: Record<TipoMovimiento, string> = {
  COMPRA: 'Compra',
  INGRESO: 'Ingreso',
  EGRESO: 'Egreso',
  AJUSTE: 'Ajuste',
  CONSUMO: 'Consumo',
};

// Mismos límites que el back
export const ARTICULO_NOMBRE_MAX = 150;
export const ARTICULO_CODIGO_MAX = 30;
export const ARTICULO_TONALIDAD_MAX = 50;
export const MARCA_TEXTO_MAX = 100;
export const MOVIMIENTO_MOTIVO_MAX = 255;
export const MOVIMIENTO_COMPROBANTE_MAX = 30;
export const PRECIO_MAX = 99_999_999.99;
export const STOCK_MAX = 9_999_999.999;

export interface Marca {
  id: number;
  razonSocial: string;
  linea: string | null;
}

// Lo que queda en el envase abierto
export interface EnvaseEnUso {
  pesoActual: string;
  tipoPeso: UnidadInsumo;
}

export interface Articulo {
  id: number;
  nombre: string;
  // Código en la lista del proveedor
  codigo: string | null;
  uso: UsoArticulo;
  tipoProducto: TipoProducto;
  stock: string;
  stockMinAlert: string;
  // "YYYY-MM-DD"
  fechaVencimiento: string | null;
  precioCosto: string;
  precioVenta: string | null;
  // Contenido de un envase, en tipoPeso
  pesoInicial: string;
  tipoPeso: UnidadInsumo;
  tonalidad: string | null;
  tipoDeposito: TipoDeposito;
  // Texto del QR, lo genera el back (ej. "ART-7K2M9QXP"). La imagen se arma en el front
  qr: string;
  marcaId: number;
  marca: Marca;
  fechaAlta: string;
  fechaBaja: string | null;
  // Stock en el mínimo o debajo
  bajoStock: boolean;
  envaseEnUso: EnvaseEnUso | null;
}

// Lo que se manda al crear; al editar, solo los campos que cambiaron (y nunca el stock)
export interface ArticuloData {
  nombre: string;
  codigo: string | null;
  uso: UsoArticulo;
  tipoProducto: TipoProducto;
  marcaId: number;
  precioCosto: number;
  // Solo para VENTA y AMBOS: con SALON no se manda (el back lo borra solo)
  precioVenta?: number;
  pesoInicial: number;
  tipoPeso: UnidadInsumo;
  tonalidad: string | null;
  tipoDeposito: TipoDeposito;
  stockMinAlert: number;
  fechaVencimiento: string | null;
  // Stock inicial, solo al crear
  stock?: number;
}

export interface MarcaData {
  razonSocial: string;
  // null o "" la borra
  linea: string | null;
}

export interface Movimiento {
  id: number;
  remitoId: number;
  fecha: string;
  tipo: TipoMovimiento;
  estado: 'PENDIENTE' | 'APLICADO' | 'ANULADO';
  // Con signo: lo que cambió el stock (en EGRESO y en un AJUSTE que baja, negativa)
  cantidad: string;
  motivo: string | null;
  numComprobante: string | null;
  usuario: { id: number; nombre: string; apellido: string };
}

export interface MovimientoData {
  tipo: TipoMovimientoManual;
  // INGRESO y EGRESO: cuánto entra o sale. AJUSTE: el stock que contaron (el back calcula la diferencia)
  cantidad: number;
  // Obligatorio en EGRESO y AJUSTE
  motivo?: string;
  numComprobante?: string;
}

// Artículo que quedó por debajo de 0 al descontar lo que usó una ficha (se descuenta igual)
export interface ArticuloSinStock {
  id: number;
  nombre: string;
  stock: string;
}

export interface MovimientoCreado {
  movimiento: Movimiento;
  articulo: Articulo;
  stockNegativo: boolean;
}

// Hasta 2 o 3 decimales, con punto o coma
export const DOS_DECIMALES = /^\d+([.,]\d{1,2})?$/;
export const TRES_DECIMALES = /^\d+([.,]\d{1,3})?$/;
export const parseDecimal = (text: string) => Number(text.trim().replace(',', '.'));

// Para los campos numéricos: deja solo dígitos y una coma o punto, con hasta esos decimales (también al pegar)
export const limitarDecimal = (text: string, decimales: number) => {
  const limpio = text.replace(/[^\d.,]/g, '');
  const separador = limpio.search(/[.,]/);
  if (separador < 0) return limpio;
  return limpio.slice(0, separador + 1) + limpio.slice(separador + 1).replace(/[.,]/g, '').slice(0, decimales);
};

// "Fidelité · Argán" o "Fidelité"
export const formatMarca = ({ razonSocial, linea }: Marca) => (linea ? `${razonSocial} · ${linea}` : razonSocial);

// Para sumar una marca nueva a la lista, en orden
export const porMarca = (a: Marca, b: Marca) => formatMarca(a).localeCompare(formatMarca(b), 'es');

// "3,5" (también negativo)
export const formatCantidad = (cantidad: string | number) =>
  new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 }).format(Number(cantidad));

// "1 envase", "3,5 envases"
export const formatEnvases = (cantidad: string | number) =>
  `${formatCantidad(cantidad)} ${Number(cantidad) === 1 ? 'envase' : 'envases'}`;

// Días antes del vencimiento en los que se avisa "Vence pronto"
export const DIAS_VENCE_PRONTO = 30;

// La fecha es una sola por artículo (no por envase). El mismo día del vencimiento todavía no está vencido
export const estadoVencimiento = ({ fechaVencimiento }: Pick<Articulo, 'fechaVencimiento'>) => {
  if (!fechaVencimiento) return null;
  const hoy = new Date();
  hoy.setHours(0, 0, 0, 0);
  const dias = Math.round((fromIsoDate(fechaVencimiento).getTime() - hoy.getTime()) / 86_400_000);
  if (dias < 0) return 'VENCIDO';
  return dias <= DIAS_VENCE_PRONTO ? 'VENCE_PRONTO' : null;
};

export const ESTADOS_VENCIMIENTO = { VENCIDO: 'Vencido', VENCE_PRONTO: 'Vence pronto' };

// Solo los campos que cambiaron respecto del artículo guardado
export const cambiosDeArticulo = (data: ArticuloData, actual: Articulo) => {
  const changes: Partial<ArticuloData> = {};
  if (data.nombre !== actual.nombre) changes.nombre = data.nombre;
  if (data.codigo !== actual.codigo) changes.codigo = data.codigo;
  if (data.uso !== actual.uso) changes.uso = data.uso;
  if (data.tipoProducto !== actual.tipoProducto) changes.tipoProducto = data.tipoProducto;
  if (data.marcaId !== actual.marcaId) changes.marcaId = data.marcaId;
  if (data.precioCosto !== Number(actual.precioCosto)) changes.precioCosto = data.precioCosto;
  if (data.precioVenta !== undefined && data.precioVenta !== Number(actual.precioVenta)) changes.precioVenta = data.precioVenta;
  if (data.pesoInicial !== Number(actual.pesoInicial)) changes.pesoInicial = data.pesoInicial;
  if (data.tipoPeso !== actual.tipoPeso) changes.tipoPeso = data.tipoPeso;
  if (data.tonalidad !== actual.tonalidad) changes.tonalidad = data.tonalidad;
  if (data.tipoDeposito !== actual.tipoDeposito) changes.tipoDeposito = data.tipoDeposito;
  if (data.stockMinAlert !== Number(actual.stockMinAlert)) changes.stockMinAlert = data.stockMinAlert;
  if (data.fechaVencimiento !== actual.fechaVencimiento) changes.fechaVencimiento = data.fechaVencimiento;
  return changes;
};

// Endpoints de artículos. Ver, crear y mover stock: ADMIN y PROFESIONAL. Editar y dar de baja: solo ADMIN.

// El listado no viene paginado: se filtra en el navegador. incluirBajas: para que el ADMIN los pueda volver a dar de alta
export const getArticulosRequest = (token: string, incluirBajas = false) =>
  apiFetch<Articulo[]>(`/articulos${incluirBajas ? '?incluirBajas=true' : ''}`, { token });

// Los que se pueden usar en una ficha: activos, de uso SALON o AMBOS
export const getArticulosSalonRequest = (token: string) => apiFetch<Articulo[]>('/articulos?uso=SALON', { token });

// También uno dado de baja (fechaBaja con fecha). 404 si no existe
export const getArticuloRequest = (token: string, id: number) => apiFetch<Articulo>(`/articulos/${id}`, { token });

// Busca por el texto del QR. Devuelve lo mismo que el anterior
export const getArticuloByQrRequest = (token: string, codigo: string) =>
  apiFetch<Articulo>(`/articulos/qr/${encodeURIComponent(codigo)}`, { token });

export const createArticuloRequest = (token: string, data: ArticuloData) =>
  apiFetch<Articulo>('/articulos', { method: 'POST', body: data, token });

export const updateArticuloRequest = (token: string, id: number, data: Partial<ArticuloData>) =>
  apiFetch<Articulo>(`/articulos/${id}`, { method: 'PATCH', body: data, token });

// Baja lógica: deja de ofrecerse, pero las fichas y los movimientos lo siguen mostrando
export const deactivateArticuloRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/articulos/${id}`, { method: 'DELETE', token });

export const reactivateArticuloRequest = (token: string, id: number) =>
  apiFetch<Articulo>(`/articulos/${id}/alta`, { method: 'PATCH', token });

// Movimientos: 404 si el artículo no existe o, al registrar, si está dado de baja

export const getMovimientosRequest = (token: string, id: number, pagina: number) =>
  apiFetch<Pagina<Movimiento>>(`/articulos/${id}/movimientos?${new URLSearchParams({ pagina: String(pagina) })}`, { token });

export const createMovimientoRequest = (token: string, id: number, data: MovimientoData) =>
  apiFetch<MovimientoCreado>(`/articulos/${id}/movimientos`, { method: 'POST', body: data, token });

// Envase abierto: ninguna de las tres mueve el stock

// Abre uno lleno; si ya había uno abierto, lo reemplaza
export const openEnvaseRequest = (token: string, id: number) =>
  apiFetch<Articulo>(`/articulos/${id}/envase-en-uso`, { method: 'POST', token });

// Lo que queda, de 0 al contenido del envase
export const updateEnvaseRequest = (token: string, id: number, pesoActual: number) =>
  apiFetch<Articulo>(`/articulos/${id}/envase-en-uso`, { method: 'PATCH', body: { pesoActual }, token });

export const finishEnvaseRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/articulos/${id}/envase-en-uso`, { method: 'DELETE', token });

// Marcas: cada una es marca + línea. Ver y crear: ADMIN y PROFESIONAL. El resto: solo ADMIN.

export const getMarcasRequest = (token: string) => apiFetch<Marca[]>('/marcas', { token });

// 409 si ya existe esa marca con esa línea
export const createMarcaRequest = (token: string, data: MarcaData) =>
  apiFetch<Marca>('/marcas', { method: 'POST', body: data, token });

export const updateMarcaRequest = (token: string, id: number, data: Partial<MarcaData>) =>
  apiFetch<Marca>(`/marcas/${id}`, { method: 'PATCH', body: data, token });

// 409 si algún artículo la usa, aunque esté dado de baja
export const deleteMarcaRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/marcas/${id}`, { method: 'DELETE', token });
