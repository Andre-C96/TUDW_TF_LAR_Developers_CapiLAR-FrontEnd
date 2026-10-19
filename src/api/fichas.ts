import { apiFetch, apiFetchBlob } from './client';
import { minutosHastaInicio } from './turnos';
import type { Turno, TurnoDetalle } from './turnos';

// Ficha técnica (F08): la carga el profesional de cada servicio del turno mientras está CONFIRMADO
// y se cierra cuando el turno se completa (ya no se edita). La clienta ve solo las cerradas.

export type NivelCapilar = 'BAJA' | 'MEDIA' | 'ALTA';
export type TipoDePelo = 'LISO' | 'ONDULADO' | 'RIZADO' | 'AFRO';
export type VolumenDePelo = 'FINO' | 'MEDIO' | 'GRUESO';
export type UnidadInsumo = 'G' | 'ML' | 'UNIDAD';
export type MomentoFoto = 'ANTES' | 'DESPUES';

// Textos para la interfaz
export const NIVELES: Record<NivelCapilar, string> = { BAJA: 'Baja', MEDIA: 'Media', ALTA: 'Alta' };
export const TIPOS_DE_PELO: Record<TipoDePelo, string> = { LISO: 'Liso', ONDULADO: 'Ondulado', RIZADO: 'Rizado', AFRO: 'Afro' };
export const VOLUMENES_DE_PELO: Record<VolumenDePelo, string> = { FINO: 'Fino', MEDIO: 'Medio', GRUESO: 'Grueso' };
export const UNIDADES: Record<UnidadInsumo, string> = { G: 'g', ML: 'ml', UNIDAD: 'u.' };

// Mismos límites que el back
export const FICHA_TEXTO_MAX = 1000;
export const FORMULA_DESCRIPCION_MAX = 500;
export const FORMULAS_MAX = 10;
export const INSUMOS_MAX = 20;
export const OXIDANTE_MAX = 60;
export const POSE_MAX_MIN = 240;
export const FOTOS_POR_MOMENTO = 5;

// Un producto de la mezcla
export interface Insumo {
  id: number;
  producto: string;
  marca: string | null;
  tono: string | null;
  // Decimal como texto ("30.00")
  cantidad: string | null;
  unidad: UnidadInsumo | null;
}

// Una mezcla aplicada, en el orden en que se aplicó
export interface Formula {
  id: number;
  orden: number;
  descripcion: string | null;
  oxidanteVolumen: number | null;
  tiempoPoseMin: number | null;
  insumos: Insumo[];
}

// La imagen se baja aparte, con token (getFichaPhotoRequest)
export interface FotoFicha {
  id: number;
  tipo: MomentoFoto;
  creadaEn: string;
}

// Ficha completa, para el salón
export interface Ficha {
  id: number;
  porosidad: NivelCapilar | null;
  elasticidad: NivelCapilar | null;
  porcentajeCanas: number | null;
  tipoDePelo: TipoDePelo | null;
  volumenDePelo: VolumenDePelo | null;
  tratamientosPrevios: string | null;
  // Solo para el salón
  observacionesInternas: string | null;
  // Cuidados para la clienta (es lo único que ve, junto con las fotos)
  indicacionesCliente: string | null;
  creadaEn: string;
  actualizadaEn: string;
  // Fecha en que se completó el turno: desde ahí no se edita
  cerradaEn: string | null;
  formulas: Formula[];
  fotos: FotoFicha[];
  turnoId: number;
  turnoDetalleId: number;
  clienteId: number;
  // "YYYY-MM-DD" y "HH:mm" del turno
  fecha: string;
  horaInicio: string;
  servicio: string;
  legajo: number;
  profesional: string;
}

// Lo que ve la clienta de sus fichas cerradas: sin diagnóstico, fórmulas ni observaciones internas
export interface FichaCliente {
  id: number;
  turnoId: number;
  fecha: string;
  horaInicio: string;
  servicio: string;
  profesional: string;
  indicacionesCliente: string | null;
  fotos: FotoFicha[];
}

export interface InsumoData {
  producto: string;
  marca: string | null;
  tono: string | null;
  cantidad: number | null;
  unidad: UnidadInsumo | null;
}

export interface FormulaData {
  descripcion: string | null;
  oxidanteVolumen: number | null;
  tiempoPoseMin: number | null;
  insumos: InsumoData[];
}

// Ningún campo es obligatorio; null borra el campo. Las fórmulas reemplazan a las anteriores
export interface FichaData {
  porosidad: NivelCapilar | null;
  elasticidad: NivelCapilar | null;
  porcentajeCanas: number | null;
  tipoDePelo: TipoDePelo | null;
  volumenDePelo: VolumenDePelo | null;
  tratamientosPrevios: string | null;
  observacionesInternas: string | null;
  indicacionesCliente: string | null;
  formulas: FormulaData[];
}

// La ficha se carga durante el servicio: con el turno CONFIRMADO y desde la hora en que empieza ese servicio
// (no antes). El back todavía solo pide CONFIRMADO: la regla de la hora está pedida en PWA-243
export const puedeCargarFicha = (turno: Turno, detalle: TurnoDetalle) =>
  turno.estado === 'CONFIRMADO' && minutosHastaInicio({ fecha: turno.fecha, horaInicio: detalle.horaInicio }) <= 0;

// Endpoints. Todos los del salón son solo para PROFESIONAL; editar, solo el de ese servicio.

// Un servicio del turno (turnoDetalleId) con el turno CONFIRMADO. 409 si ya tiene ficha
export const createFichaRequest = (token: string, turnoId: number, turnoDetalleId: number, data: FichaData) =>
  apiFetch<Ficha>(`/turnos/${turnoId}/fichas`, { method: 'POST', body: { turnoDetalleId, ...data }, token });

export const getFichaRequest = (token: string, id: number) => apiFetch<Ficha>(`/fichas/${id}`, { token });

// Solo mientras está abierta
export const updateFichaRequest = (token: string, id: number, data: FichaData) =>
  apiFetch<Ficha>(`/fichas/${id}`, { method: 'PATCH', body: data, token });

export const deleteFichaRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/fichas/${id}`, { method: 'DELETE', token });

// Historial de una clienta, de la más nueva a la más vieja (cualquier profesional)
export const getClientFichasRequest = (token: string, clienteId: number) =>
  apiFetch<Ficha[]>(`/clientes/${clienteId}/fichas`, { token });

// CLIENTE: sus fichas cerradas, de la más nueva a la más vieja
export const getMyFichasRequest = (token: string) => apiFetch<FichaCliente[]>('/fichas/mias', { token });

// Hasta 5 de antes y 5 de después, mientras la ficha está abierta (JPG, PNG o WEBP de hasta 2 MB). Devuelve la ficha
export const uploadFichaPhotoRequest = (token: string, id: number, tipo: MomentoFoto, file: File) => {
  const body = new FormData();
  body.append('tipo', tipo);
  body.append('foto', file);
  return apiFetch<Ficha>(`/fichas/${id}/fotos`, { method: 'POST', body, token });
};

export const deleteFichaPhotoRequest = (token: string, id: number, fotoId: number) =>
  apiFetch<Ficha>(`/fichas/${id}/fotos/${fotoId}`, { method: 'DELETE', token });

export const getFichaPhotoRequest = (token: string, id: number, fotoId: number) =>
  apiFetchBlob(`/fichas/${id}/fotos/${fotoId}`, token);
