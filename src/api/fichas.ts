import { apiFetch, apiFetchBlob } from './client';
import { fromIsoDate, minutosHastaInicio } from './turnos';
import type { Turno, TurnoDetalle } from './turnos';
import type { Articulo, ArticuloSinStock } from './articulos';

// Ficha técnica (F08): la carga el profesional de cada servicio del turno mientras está CONFIRMADO y se cierra
// cuando el turno se completa. Después la puede seguir editando desde el historial. La clienta ve solo las cerradas.

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
export const POSE_MAX_MIN = 240;
export const FOTOS_POR_MOMENTO = 5;

// Dónde se aplica una fórmula. Se guarda como texto en `descripcion`: lo que no esté en la lista va como "Otra"
export const ZONAS_FORMULA = ['Raíz', 'Medios', 'Puntas', 'Medios y puntas', 'Total', 'Mechas', 'Flequillo'];

// Un producto de la mezcla
export interface Insumo {
  id: number;
  producto: string;
  marca: string | null;
  tono: string | null;
  // Decimal como texto ("30.00")
  cantidad: string | null;
  unidad: UnidadInsumo | null;
  // Artículo del stock; null en los insumos viejos cargados como texto (esos no descuentan)
  articuloId: number | null;
  // Costo de lo usado: se calcula al completar el turno (hasta ahí, null)
  costoSubtotal: string | null;
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

// Lo que dice el texto alternativo de cada foto, después del momento: "Coloración, 12/10/2026"
export const contextoDeFoto = (servicio: string, fecha: string) =>
  `${servicio}, ${fromIsoDate(fecha).toLocaleDateString('es-AR')}`;

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
  // Fecha en que se completó el turno: desde ahí descuenta stock y solo se edita desde el historial
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

// Del stock: alcanza con el artículo y la cantidad (en su unidad); el resto lo completa el back.
// Como texto: solo para conservar los que ya estaban. Al editar hay que reenviar el articuloId que vino:
// sin él, el back lo toma como texto y deja de descontarlo
export type InsumoData =
  | { articuloId: number; cantidad: number }
  | { producto: string; marca: string | null; tono: string | null; cantidad: number | null; unidad: UnidadInsumo | null };

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
// (no antes)
export const puedeCargarFicha = (turno: Turno, detalle: TurnoDetalle) =>
  turno.estado === 'CONFIRMADO' && minutosHastaInicio({ fecha: turno.fecha, horaInicio: detalle.horaInicio }) <= 0;

// Lo que cuesta lo usado de un artículo: la misma cuenta que hace el back al completar el turno
export const costoDeInsumo = ({ precioCosto, pesoInicial }: Pick<Articulo, 'precioCosto' | 'pesoInicial'>, cantidad: number) =>
  Math.round((Number(precioCosto) / Number(pesoInicial)) * cantidad * 100) / 100;

export interface TotalDeProductos {
  total: number;
  // Productos que no suman: los cargados como texto no tienen precio
  sinPrecio: number;
  // Con el precio de hoy: el costo real se guarda al completar el turno
  estimado: boolean;
}

type InsumoConCosto = { articuloId: number | null; cantidad: string | null; costoSubtotal?: string | null };

// Usa el costo guardado y, si todavía no hay, lo calcula con los artículos del stock
export const totalDeProductos = (insumos: InsumoConCosto[], articulos: Articulo[] = []): TotalDeProductos =>
  insumos.reduce<TotalDeProductos>(
    (acumulado, insumo) => {
      if (insumo.costoSubtotal != null) return { ...acumulado, total: acumulado.total + Number(insumo.costoSubtotal) };
      const articulo = articulos.find((a) => a.id === insumo.articuloId);
      if (!articulo) return { ...acumulado, sinPrecio: acumulado.sinPrecio + 1 };
      return { ...acumulado, total: acumulado.total + costoDeInsumo(articulo, Number(insumo.cantidad) || 0), estimado: true };
    },
    { total: 0, sinPrecio: 0, estimado: false },
  );

export const insumosDeFicha = (ficha: Ficha) => ficha.formulas.flatMap((formula) => formula.insumos);

export const textoSinPrecio = (cantidad: number) => `No incluye ${cantidad} ${cantidad === 1 ? 'producto' : 'productos'} sin precio`;

// Endpoints. Todos los del salón son solo para PROFESIONAL; editar, solo el de ese servicio.

// Un servicio del turno (turnoDetalleId) con el turno CONFIRMADO. 409 si ya tiene ficha
export const createFichaRequest = (token: string, turnoId: number, turnoDetalleId: number, data: FichaData) =>
  apiFetch<Ficha>(`/turnos/${turnoId}/fichas`, { method: 'POST', body: { turnoDetalleId, ...data }, token });

export const getFichaRequest = (token: string, id: number) => apiFetch<Ficha>(`/fichas/${id}`, { token });

// También cerrada. Con las fórmulas, en una cerrada se corrige el stock con la diferencia y sinStock trae los artículos
// que quedaron por debajo de 0. Ver datosParaGuardar en fichaCambios.ts
export const updateFichaRequest = (token: string, id: number, data: Partial<FichaData>) =>
  apiFetch<Ficha & { sinStock?: ArticuloSinStock[] }>(`/fichas/${id}`, { method: 'PATCH', body: data, token });

// Solo mientras está abierta
export const deleteFichaRequest = (token: string, id: number) =>
  apiFetch<{ message: string }>(`/fichas/${id}`, { method: 'DELETE', token });

// Historial de una clienta, de la más nueva a la más vieja (cualquier profesional)
export const getClientFichasRequest = (token: string, clienteId: number) =>
  apiFetch<Ficha[]>(`/clientes/${clienteId}/fichas`, { token });

// CLIENTE: sus fichas cerradas, de la más nueva a la más vieja
export const getMyFichasRequest = (token: string) => apiFetch<FichaCliente[]>('/fichas/mias', { token });

// Hasta 5 de antes y 5 de después, también con la ficha cerrada (JPG, PNG o WEBP de hasta 2 MB). Devuelve la ficha
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

// --- F14/F15: sugerencia de la IA (Gemini) y diagnóstico anterior. Mismos nombres que en mobile ---

// Diagnóstico de la ficha: los 5 campos que la IA sugiere y que se precargan de la ficha anterior
export type Diagnostico = Pick<FichaData, 'porosidad' | 'elasticidad' | 'porcentajeCanas' | 'tipoDePelo' | 'volumenDePelo'>;

export interface InsumoSugerido {
  // Siempre un artículo del stock con existencias: el back completa producto, marca, tono y unidad
  articuloId: number;
  producto: string;
  marca: string;
  tono: string | null;
  cantidad: number;
  unidad: UnidadInsumo;
}

export interface FormulaSugerida {
  descripcion?: string;
  oxidanteVolumen?: number;
  tiempoPoseMin?: number;
  insumos: InsumoSugerido[];
}

// Los campos de diagnóstico que la IA no pudo ver no vienen
export interface SugerenciaIA extends Partial<{ [K in keyof Diagnostico]: NonNullable<Diagnostico[K]> }> {
  analisis: {
    evolucion?: string;
    // F15: lo que hay que tener en cuenta antes de trabajar (alergias, procesos químicos seguidos, daño)
    alertas: string[];
    recomendacion?: string;
  };
  // Misma forma que las fórmulas de la ficha. Vacía si el servicio no lleva (ej. un corte)
  formulas: FormulaSugerida[];
  // true en GEMINI_MODO=simulado: respuesta fija, sin llamar a Gemini
  simulado: boolean;
}

export interface DiagnosticoAnterior extends Diagnostico {
  fichaId: number;
  // "YYYY-MM-DD" del turno de esa ficha
  fecha: string;
  servicio: string;
}

// Solo el profesional de ese servicio con la ficha guardada y abierta. Usa las últimas 5 fichas cerradas de la clienta,
// sus alergias, lo guardado en esta ficha, el stock y la foto de ANTES si hay. No guarda nada: se revisa y se guarda
// con PATCH. 400 si no hay foto de ANTES ni fichas anteriores, 429 después de 20 por hora, 502/503/504 si la IA falla
export const sugerirFichaRequest = (token: string, fichaId: number) =>
  apiFetch<SugerenciaIA>(`/fichas/${fichaId}/diagnostico`, { method: 'POST', token });

// Sin IA: el diagnóstico de la última ficha cerrada que lo tenga (null si no hay), para arrancar una ficha nueva
export const getUltimoDiagnosticoRequest = (token: string, clienteId: number) =>
  apiFetch<{ diagnostico: DiagnosticoAnterior | null }>(`/clientes/${clienteId}/fichas/ultimo-diagnostico`, { token }).then(
    (res) => res.diagnostico,
  );

// Si tiene al menos un dato de diagnóstico cargado
export const tieneDiagnostico = (d: Partial<Diagnostico>) =>
  d.porosidad != null || d.elasticidad != null || d.porcentajeCanas != null || d.tipoDePelo != null || d.volumenDePelo != null;

// Texto del análisis para guardarlo en las observaciones internas: el back no lo guarda solo
export const analisisComoTexto = ({ analisis }: SugerenciaIA) =>
  [
    analisis.evolucion && `Evolución: ${analisis.evolucion}`,
    analisis.alertas.length > 0 && `Alertas: ${analisis.alertas.join(' ')}`,
    analisis.recomendacion && `Recomendación: ${analisis.recomendacion}`,
  ]
    .filter(Boolean)
    .join('\n');
