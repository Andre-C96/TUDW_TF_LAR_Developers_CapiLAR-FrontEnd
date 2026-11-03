import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import {
  FICHA_TEXTO_MAX,
  FORMULAS_MAX,
  FORMULA_DESCRIPCION_MAX,
  INSUMOS_MAX,
  NIVELES,
  OXIDANTE_MAX,
  POSE_MAX_MIN,
  TIPOS_DE_PELO,
  UNIDADES,
  VOLUMENES_DE_PELO,
} from '../../api/fichas';
import type { Ficha, FichaData, NivelCapilar, TipoDePelo, UnidadInsumo, VolumenDePelo } from '../../api/fichas';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';

// Borradores: los números se escriben como texto y se convierten al guardar
interface InsumoDraft {
  key: number;
  producto: string;
  marca: string;
  tono: string;
  cantidad: string;
  unidad: UnidadInsumo | '';
}

interface FormulaDraft {
  key: number;
  descripcion: string;
  oxidanteVolumen: string;
  tiempoPoseMin: string;
  insumos: InsumoDraft[];
}

// Clave estable para las filas que se agregan y quitan
let nextKey = 0;
const newInsumo = (): InsumoDraft => ({ key: nextKey++, producto: '', marca: '', tono: '', cantidad: '', unidad: 'G' });
const newFormula = (): FormulaDraft => ({ key: nextKey++, descripcion: '', oxidanteVolumen: '', tiempoPoseMin: '', insumos: [newInsumo()] });

const toDraft = (ficha: Ficha): FormulaDraft[] =>
  ficha.formulas.map((formula) => ({
    key: nextKey++,
    descripcion: formula.descripcion ?? '',
    oxidanteVolumen: formula.oxidanteVolumen?.toString() ?? '',
    tiempoPoseMin: formula.tiempoPoseMin?.toString() ?? '',
    insumos: formula.insumos.map((insumo) => ({
      key: nextKey++,
      producto: insumo.producto,
      marca: insumo.marca ?? '',
      tono: insumo.tono ?? '',
      cantidad: insumo.cantidad ? String(Number(insumo.cantidad)) : '',
      unidad: insumo.unidad ?? '',
    })),
  }));

// Hasta 2 decimales, con punto o coma
const CANTIDAD_REGEX = /^\d+([.,]\d{1,2})?$/;

const labelClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';
const smallInputClass =
  'w-full rounded-lg border px-3 py-2 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20';

// Una opción por chip; tocar la elegida la deselecciona (ningún dato es obligatorio)
const Opciones = <T extends string>({
  label,
  opciones,
  value,
  onChange,
}: {
  label: string;
  opciones: Record<T, string>;
  value: T | '';
  onChange: (value: T | '') => void;
}) => {
  const labelId = useId();
  return (
    <div role="group" aria-labelledby={labelId} className="flex flex-col gap-2">
      <span id={labelId} className={labelClass}>
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {(Object.keys(opciones) as T[]).map((opcion) => (
          <button
            key={opcion}
            type="button"
            aria-pressed={value === opcion}
            onClick={() => onChange(value === opcion ? '' : opcion)}
            className={`rounded-full border px-3 py-1.5 font-inter text-sm transition-colors ${
              value === opcion
                ? 'border-capilar-violet bg-capilar-violet text-white'
                : 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
            }`}
          >
            {opciones[opcion]}
          </button>
        ))}
      </div>
    </div>
  );
};

const TextArea = ({ label, hint, value, onChange }: { label: string; hint?: string; value: string; onChange: (value: string) => void }) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        maxLength={FICHA_TEXTO_MAX}
        rows={3}
        className="w-full resize-y rounded-lg border border-gray-300 px-4 py-3 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20"
      />
      <div className="flex justify-between gap-4 font-inter text-xs text-capilar-grey">
        <span>{hint}</span>
        <span className="shrink-0">
          {value.length}/{FICHA_TEXTO_MAX}
        </span>
      </div>
    </div>
  );
};

const FieldError = ({ message }: { message?: string }) =>
  message ? <p className="font-inter text-xs text-red-500">{message}</p> : null;

interface FichaFormProps {
  // Ficha a editar; sin ella, el formulario es de alta
  ficha?: Ficha | null;
  // Recibe los datos ya validados; quien lo usa llama a la API
  onSubmit: (data: FichaData) => void;
  onCancel: () => void;
  // Si viene, suma "Quitar ficha"
  onDelete?: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Ficha técnica de un servicio: diagnóstico, tratamientos previos, fórmulas con sus productos e indicaciones.
// Ningún campo es obligatorio: se completa durante el servicio y se puede guardar varias veces.
export const FichaForm = ({ ficha, onSubmit, onCancel, onDelete, isLoading = false, error }: FichaFormProps) => {
  const [porosidad, setPorosidad] = useState<NivelCapilar | ''>(ficha?.porosidad ?? '');
  const [elasticidad, setElasticidad] = useState<NivelCapilar | ''>(ficha?.elasticidad ?? '');
  const [tipoDePelo, setTipoDePelo] = useState<TipoDePelo | ''>(ficha?.tipoDePelo ?? '');
  const [volumenDePelo, setVolumenDePelo] = useState<VolumenDePelo | ''>(ficha?.volumenDePelo ?? '');
  const [porcentajeCanas, setPorcentajeCanas] = useState(ficha?.porcentajeCanas?.toString() ?? '');
  const [tratamientosPrevios, setTratamientosPrevios] = useState(ficha?.tratamientosPrevios ?? '');
  const [indicacionesCliente, setIndicacionesCliente] = useState(ficha?.indicacionesCliente ?? '');
  const [observacionesInternas, setObservacionesInternas] = useState(ficha?.observacionesInternas ?? '');
  const [formulas, setFormulas] = useState<FormulaDraft[]>(() => (ficha ? toDraft(ficha) : []));
  // Errores por campo: "canas", "f0.oxidante", "f0.i1.producto", etc.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  const updateFormula = (key: number, changes: Partial<FormulaDraft>) =>
    setFormulas((prev) => prev.map((f) => (f.key === key ? { ...f, ...changes } : f)));

  const updateInsumo = (formula: FormulaDraft, key: number, changes: Partial<InsumoDraft>) =>
    updateFormula(formula.key, { insumos: formula.insumos.map((i) => (i.key === key ? { ...i, ...changes } : i)) });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const errors: Record<string, string> = {};
    // Entero entre min y max, o null si está vacío
    const entero = (value: string, min: number, max: number, errorKey: string, mensaje: string) => {
      if (!value.trim()) return null;
      const n = Number(value);
      if (!Number.isInteger(n) || n < min || n > max) errors[errorKey] = mensaje;
      return n;
    };

    const canas = entero(porcentajeCanas, 0, 100, 'canas', 'Un número entero entre 0 y 100');
    const data: FichaData = {
      porosidad: porosidad || null,
      elasticidad: elasticidad || null,
      tipoDePelo: tipoDePelo || null,
      volumenDePelo: volumenDePelo || null,
      porcentajeCanas: canas,
      tratamientosPrevios: tratamientosPrevios.trim() || null,
      indicacionesCliente: indicacionesCliente.trim() || null,
      observacionesInternas: observacionesInternas.trim() || null,
      formulas: formulas.map((formula, f) => ({
        descripcion: formula.descripcion.trim() || null,
        oxidanteVolumen: entero(formula.oxidanteVolumen, 1, OXIDANTE_MAX, `f${f}.oxidante`, `Entre 1 y ${OXIDANTE_MAX} vol`),
        tiempoPoseMin: entero(formula.tiempoPoseMin, 1, POSE_MAX_MIN, `f${f}.pose`, `Entre 1 y ${POSE_MAX_MIN} minutos`),
        // Las filas vacías no se mandan
        insumos: formula.insumos
          .map((insumo, i) => ({ insumo, i }))
          .filter(({ insumo }) => insumo.producto.trim() || insumo.marca.trim() || insumo.tono.trim() || insumo.cantidad.trim())
          .map(({ insumo, i }) => {
            if (!insumo.producto.trim()) errors[`f${f}.i${i}.producto`] = 'Indicá el producto';
            const cantidad = insumo.cantidad.trim().replace(',', '.');
            if (cantidad && (!CANTIDAD_REGEX.test(insumo.cantidad.trim()) || Number(cantidad) <= 0)) {
              errors[`f${f}.i${i}.cantidad`] = 'La cantidad tiene que ser mayor a 0, con hasta 2 decimales';
            }
            return {
              producto: insumo.producto.trim(),
              marca: insumo.marca.trim() || null,
              tono: insumo.tono.trim() || null,
              cantidad: cantidad ? Number(cantidad) : null,
              unidad: cantidad ? insumo.unidad || null : null,
            };
          }),
      })),
    };
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;
    onSubmit(data);
  };

  return (
    <Form onSubmit={handleSubmit} noValidate className="gap-8!">
      <section className="flex flex-col gap-5">
        <h3 className="font-inter text-sm font-semibold text-black">Diagnóstico</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Opciones label="Porosidad" opciones={NIVELES} value={porosidad} onChange={setPorosidad} />
          <Opciones label="Elasticidad" opciones={NIVELES} value={elasticidad} onChange={setElasticidad} />
          <Opciones label="Tipo de pelo" opciones={TIPOS_DE_PELO} value={tipoDePelo} onChange={setTipoDePelo} />
          <Opciones label="Volumen" opciones={VOLUMENES_DE_PELO} value={volumenDePelo} onChange={setVolumenDePelo} />
        </div>
        <div className="sm:w-1/2">
          <FormField
            label="% de canas"
            type="number"
            inputMode="numeric"
            min={0}
            max={100}
            value={porcentajeCanas}
            onChange={(event) => setPorcentajeCanas(event.target.value)}
            placeholder="Ej.: 30"
            error={fieldErrors.canas}
          />
        </div>
        <TextArea
          label="Tratamientos previos"
          value={tratamientosPrevios}
          onChange={setTratamientosPrevios}
          hint="Ej.: decoloración hace 6 meses, alisado, henna."
        />
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="font-inter text-sm font-semibold text-black">Fórmulas</h3>
          {formulas.length < FORMULAS_MAX && (
            <button
              type="button"
              onClick={() => setFormulas((prev) => [...prev, newFormula()])}
              className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-violet hover:underline"
            >
              + Agregar fórmula
            </button>
          )}
        </div>
        {formulas.length === 0 && (
          <p className="font-inter text-sm text-capilar-grey">Sin fórmulas. Sumá una por cada mezcla que apliques, en orden.</p>
        )}
        {formulas.map((formula, f) => (
          <fieldset
            key={formula.key}
            aria-label={`Fórmula ${f + 1}`}
            className="flex flex-col gap-4 rounded-[6px] border border-gray-200 bg-gray-50 p-4"
          >
            <div className="flex items-center justify-between gap-4">
              <h4 className="font-inter text-sm font-semibold text-black">Fórmula {f + 1}</h4>
              <button
                type="button"
                onClick={() => setFormulas((prev) => prev.filter((x) => x.key !== formula.key))}
                className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-red-500"
              >
                Quitar
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr_1fr]">
              <div className="flex flex-col gap-1">
                <label className={labelClass}>
                  Zona o descripción
                  <input
                    value={formula.descripcion}
                    onChange={(event) => updateFormula(formula.key, { descripcion: event.target.value })}
                    maxLength={FORMULA_DESCRIPCION_MAX}
                    placeholder="Ej.: Raíz"
                    className={`${smallInputClass} mt-1 border-gray-300 normal-case tracking-normal font-normal`}
                  />
                </label>
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>
                  Oxidante (vol)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={OXIDANTE_MAX}
                    value={formula.oxidanteVolumen}
                    onChange={(event) => updateFormula(formula.key, { oxidanteVolumen: event.target.value })}
                    placeholder="20"
                    aria-invalid={fieldErrors[`f${f}.oxidante`] ? true : undefined}
                    className={`${smallInputClass} mt-1 normal-case tracking-normal font-normal ${fieldErrors[`f${f}.oxidante`] ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </label>
                <FieldError message={fieldErrors[`f${f}.oxidante`]} />
              </div>
              <div className="flex flex-col gap-1">
                <label className={labelClass}>
                  Pose (min)
                  <input
                    type="number"
                    inputMode="numeric"
                    min={1}
                    max={POSE_MAX_MIN}
                    value={formula.tiempoPoseMin}
                    onChange={(event) => updateFormula(formula.key, { tiempoPoseMin: event.target.value })}
                    placeholder="35"
                    aria-invalid={fieldErrors[`f${f}.pose`] ? true : undefined}
                    className={`${smallInputClass} mt-1 normal-case tracking-normal font-normal ${fieldErrors[`f${f}.pose`] ? 'border-red-500' : 'border-gray-300'}`}
                  />
                </label>
                <FieldError message={fieldErrors[`f${f}.pose`]} />
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Productos</span>
              {formula.insumos.map((insumo, i) => {
                const errorProducto = fieldErrors[`f${f}.i${i}.producto`];
                const errorCantidad = fieldErrors[`f${f}.i${i}.cantidad`];
                return (
                  <div key={insumo.key} className="flex flex-col gap-1">
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-[2fr_1.5fr_1fr_1fr_auto_auto]">
                      <input
                        value={insumo.producto}
                        onChange={(event) => updateInsumo(formula, insumo.key, { producto: event.target.value })}
                        maxLength={100}
                        placeholder="Producto (ej.: Tintura)"
                        aria-label={`Producto ${i + 1} de la fórmula ${f + 1}`}
                        aria-invalid={errorProducto ? true : undefined}
                        className={`${smallInputClass} col-span-2 sm:col-span-1 ${errorProducto ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <input
                        value={insumo.marca}
                        onChange={(event) => updateInsumo(formula, insumo.key, { marca: event.target.value })}
                        maxLength={100}
                        placeholder="Marca"
                        aria-label={`Marca del producto ${i + 1}`}
                        className={`${smallInputClass} border-gray-300`}
                      />
                      <input
                        value={insumo.tono}
                        onChange={(event) => updateInsumo(formula, insumo.key, { tono: event.target.value })}
                        maxLength={50}
                        placeholder="Tono"
                        aria-label={`Tono del producto ${i + 1}`}
                        className={`${smallInputClass} border-gray-300`}
                      />
                      <input
                        inputMode="decimal"
                        value={insumo.cantidad}
                        onChange={(event) => updateInsumo(formula, insumo.key, { cantidad: event.target.value })}
                        placeholder="Cant."
                        aria-label={`Cantidad del producto ${i + 1}`}
                        aria-invalid={errorCantidad ? true : undefined}
                        className={`${smallInputClass} ${errorCantidad ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <select
                        value={insumo.unidad}
                        onChange={(event) => updateInsumo(formula, insumo.key, { unidad: event.target.value as UnidadInsumo | '' })}
                        aria-label={`Unidad del producto ${i + 1}`}
                        className={`${smallInputClass} border-gray-300 bg-white`}
                      >
                        {(Object.keys(UNIDADES) as UnidadInsumo[]).map((unidad) => (
                          <option key={unidad} value={unidad}>
                            {UNIDADES[unidad]}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        onClick={() => updateFormula(formula.key, { insumos: formula.insumos.filter((x) => x.key !== insumo.key) })}
                        aria-label={`Quitar el producto ${i + 1}`}
                        className="flex items-center justify-center rounded-lg px-2 text-capilar-grey hover:text-red-500"
                      >
                        ✕
                      </button>
                    </div>
                    <FieldError message={errorProducto ?? errorCantidad} />
                  </div>
                );
              })}
              {formula.insumos.length < INSUMOS_MAX && (
                <button
                  type="button"
                  onClick={() => updateFormula(formula.key, { insumos: [...formula.insumos, newInsumo()] })}
                  className="self-start font-inter text-xs font-semibold uppercase tracking-widest text-capilar-violet hover:underline"
                >
                  + Agregar producto
                </button>
              )}
            </div>
          </fieldset>
        ))}
      </section>

      <section className="flex flex-col gap-5">
        <TextArea
          label="Indicaciones para la clienta"
          value={indicacionesCliente}
          onChange={setIndicacionesCliente}
          hint="Las ve la clienta en su historial cuando se completa el turno."
        />
        <TextArea
          label="Observaciones internas"
          value={observacionesInternas}
          onChange={setObservacionesInternas}
          hint="Solo las ve el salón."
        />
      </section>

      {error && (
        <p role="alert" className="text-center font-inter text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
        {onDelete ? (
          <button
            type="button"
            onClick={onDelete}
            disabled={isLoading}
            className="self-start font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey hover:text-red-500 disabled:opacity-50"
          >
            Quitar ficha
          </button>
        ) : (
          <span />
        )}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="px-5 py-2 text-xs uppercase">
            Cerrar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : ficha ? 'Guardar cambios' : 'Guardar ficha'}
          </Button>
        </div>
      </div>
    </Form>
  );
};
