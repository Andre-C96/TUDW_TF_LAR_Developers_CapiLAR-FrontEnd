import type { Ficha, FichaData, FormulaData, InsumoData } from './fichas';

// Las fórmulas guardadas, en el mismo formato en que las arma el formulario
const formulasComoData = (ficha: Pick<Ficha, 'formulas'>): FormulaData[] =>
  ficha.formulas.map(({ descripcion, oxidanteVolumen, tiempoPoseMin, insumos }) => ({
    descripcion,
    oxidanteVolumen,
    tiempoPoseMin,
    insumos: insumos.map(({ articuloId, producto, marca, tono, cantidad, unidad }): InsumoData =>
      articuloId !== null
        ? { articuloId, cantidad: Number(cantidad) }
        : { producto, marca, tono, cantidad: cantidad ? Number(cantidad) : null, unidad: cantidad ? unidad : null },
    ),
  }));

// Lo que se manda al guardar. En una ficha cerrada, las fórmulas van solo si cambiaron: al recibirlas, el back
// recalcula el costo de los insumos con el precio actual, y corregir una indicación no debe tocar el costo histórico
export const datosParaGuardar = (ficha: Pick<Ficha, 'cerradaEn' | 'formulas'>, data: FichaData): Partial<FichaData> => {
  if (!ficha.cerradaEn || JSON.stringify(formulasComoData(ficha)) !== JSON.stringify(data.formulas)) return data;
  const resto: Partial<FichaData> = { ...data };
  delete resto.formulas;
  return resto;
};
