import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { formatEnvases, formatMarca, limitarDecimal } from '../../api/articulos';
import type { Articulo } from '../../api/articulos';
import {
  FICHA_TEXTO_MAX,
  FORMULAS_MAX,
  FORMULA_DESCRIPCION_MAX,
  INSUMOS_MAX,
  NIVELES,
  POSE_MAX_MIN,
  TIPOS_DE_PELO,
  UNIDADES,
  VOLUMENES_DE_PELO,
  ZONAS_FORMULA,
  costoDeInsumo,
  totalDeProductos,
} from '../../api/fichas';
import type { Ficha, FichaData, InsumoData, NivelCapilar, TipoDePelo, UnidadInsumo, VolumenDePelo } from '../../api/fichas';
import { formatPrice } from '../../api/services';
import { parseTratamientos, serializeTratamientos } from '../../api/tratamientos';
import { Button } from '../button/button';
import { Form } from '../form/form';
import { TotalProductos } from '../totalProductos/totalProductos';
import { ArticuloPicker } from './articuloPicker';
import { filaVacia, fromTratamientoDraft, newTratamiento, toTratamientoDraft, validarTratamiento } from './tratamientoDraft';
import type { TratamientoDraft } from './tratamientoDraft';
import { TratamientosField } from './tratamientosField';

// Borradores: los números se escriben como texto y se convierten al guardar
interface InsumoDraft {
  key: number;
  // Lo que se escribe para buscar en el stock
  busqueda: string;
  // El artículo elegido. Se conserva al guardar: sin él, el back deja de descontarlo
  articuloId: number | null;
  // Insumo viejo cargado como texto: se conserva tal cual, pero no se pueden sumar nuevos
  comoTexto: boolean;
  producto: string;
  marca: string;
  tono: string;
  cantidad: string;
  unidad: UnidadInsumo | '';
  // Costo guardado al completar el turno
  costoSubtotal: string | null;
}

interface FormulaDraft {
  key: number;
  // La zona elegida o, con zonaOtra, lo que se escribió a mano
  descripcion: string;
  zonaOtra: boolean;
  // Solo en fichas viejas: se conserva y se reenvía sin cambios (el oxidante ahora es un producto más)
  oxidanteVolumen: string;
  tiempoPoseMin: string;
  insumos: InsumoDraft[];
}

// Clave estable para las filas que se agregan y quitan
let nextKey = 0;
const newInsumo = (): InsumoDraft => ({ key: nextKey++, busqueda: '', articuloId: null, comoTexto: false, producto: '', marca: '', tono: '', cantidad: '', unidad: '', costoSubtotal: null });
const newFormula = (): FormulaDraft => ({ key: nextKey++, descripcion: '', zonaOtra: false, oxidanteVolumen: '', tiempoPoseMin: '', insumos: [newInsumo()] });

// Valor del select para "Otra" (no se guarda: lo que va a la ficha es el texto escrito)
const ZONA_OTRA = 'otra';

const toDraft = (ficha: Ficha): FormulaDraft[] =>
  ficha.formulas.map((formula) => ({
    key: nextKey++,
    descripcion: formula.descripcion ?? '',
    zonaOtra: Boolean(formula.descripcion) && !ZONAS_FORMULA.includes(formula.descripcion ?? ''),
    oxidanteVolumen: formula.oxidanteVolumen?.toString() ?? '',
    tiempoPoseMin: formula.tiempoPoseMin?.toString() ?? '',
    insumos: formula.insumos.map((insumo) => ({
      key: nextKey++,
      busqueda: '',
      articuloId: insumo.articuloId,
      comoTexto: insumo.articuloId === null,
      producto: insumo.producto,
      marca: insumo.marca ?? '',
      tono: insumo.tono ?? '',
      cantidad: insumo.cantidad ? String(Number(insumo.cantidad)) : '',
      unidad: insumo.unidad ?? '',
      costoSubtotal: insumo.costoSubtotal,
    })),
  }));

// Lo que se manda de las fórmulas, para saber si cambiaron (las filas de producto vacías no cuentan)
const firmaDeFormulas = (formulas: FormulaDraft[]) =>
  JSON.stringify(
    formulas.map(({ descripcion, oxidanteVolumen, tiempoPoseMin, insumos }) => [
      descripcion.trim(),
      oxidanteVolumen,
      tiempoPoseMin,
      insumos.filter((i) => i.articuloId !== null || i.comoTexto).map((i) => [i.articuloId, i.producto, i.cantidad.trim()]),
    ]),
  );

// Hasta 2 decimales, con punto o coma
const CANTIDAD_REGEX = /^\d+([.,]\d{1,2})?$/;

// Los títulos de sección van en negro y más grandes, para distinguirlos de los títulos de los campos
const sectionTitleClass = 'font-inter text-sm font-semibold uppercase tracking-widest text-black';
const labelClass = 'font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey';
const smallInputClass =
  'w-full rounded-lg border px-3 py-2 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20';

// Una opción por chip; tocar la elegida la deselecciona (ningún dato es obligatorio)
export const Opciones = <T extends string>({
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
            className={`rounded-[4px] border px-3 py-1.5 font-inter text-sm transition-colors ${
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
  // Los artículos que se pueden elegir para las fórmulas
  articulos: Articulo[];
  // No se pudieron cargar los artículos
  articulosError?: string;
  // Si viene, el buscador ofrece crear un artículo; quien lo usa lo crea y llama a `elegir` para dejarlo en ese producto
  onCrearArticulo?: (nombre: string, elegir: (articulo: Articulo) => void) => void;
  // Recibe los datos ya validados; quien lo usa llama a la API
  onSubmit: (data: FichaData) => void;
  onCancel: () => void;
  // Si viene, suma "Quitar ficha"
  onDelete?: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Ficha técnica de un servicio: diagnóstico, tratamientos previos, fórmulas con sus productos del stock e indicaciones.
// Ningún campo es obligatorio: se completa durante el servicio y se puede guardar varias veces, también ya cerrada.
export const FichaForm = ({ ficha, articulos, articulosError, onCrearArticulo, onSubmit, onCancel, onDelete, isLoading = false, error }: FichaFormProps) => {
  const [porosidad, setPorosidad] = useState<NivelCapilar | ''>(ficha?.porosidad ?? '');
  const [elasticidad, setElasticidad] = useState<NivelCapilar | ''>(ficha?.elasticidad ?? '');
  const [tipoDePelo, setTipoDePelo] = useState<TipoDePelo | ''>(ficha?.tipoDePelo ?? '');
  const [volumenDePelo, setVolumenDePelo] = useState<VolumenDePelo | ''>(ficha?.volumenDePelo ?? '');
  const [porcentajeCanas, setPorcentajeCanas] = useState(ficha?.porcentajeCanas?.toString() ?? '');
  // Filas y notas salen del mismo texto guardado (ver api/tratamientos.ts): se leen una sola vez, al abrir
  const [tratamientosGuardados] = useState(() => parseTratamientos(ficha?.tratamientosPrevios ?? null));
  const [tratamientos, setTratamientos] = useState<TratamientoDraft[]>(() => tratamientosGuardados.filas.map(toTratamientoDraft));
  const [notasTratamientos, setNotasTratamientos] = useState(tratamientosGuardados.notas);
  const [erroresTratamientos, setErroresTratamientos] = useState<Record<number, string | undefined>>({});
  const [indicacionesCliente, setIndicacionesCliente] = useState(ficha?.indicacionesCliente ?? '');
  const [observacionesInternas, setObservacionesInternas] = useState(ficha?.observacionesInternas ?? '');
  const [formulas, setFormulas] = useState<FormulaDraft[]>(() => (ficha ? toDraft(ficha) : []));
  const [firmaInicial] = useState(() => firmaDeFormulas(formulas));
  // Errores por campo: "canas", "f0.pose", "f0.i1.producto", etc.
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Ficha cerrada sin cambios en las fórmulas: vale el costo guardado. Si cambian, el back recalcula todo con el precio de hoy
  const usarCostoGuardado = Boolean(ficha?.cerradaEn) && firmaDeFormulas(formulas) === firmaInicial;

  // Lo que suman los productos ya elegidos, para calcular cuánto cobrar
  const totalProductos = totalDeProductos(
    formulas
      .flatMap((formula) => formula.insumos)
      .filter((insumo) => insumo.articuloId !== null || insumo.comoTexto)
      .map((insumo) => ({
        articuloId: insumo.articuloId,
        cantidad: insumo.cantidad.replace(',', '.'),
        costoSubtotal: usarCostoGuardado ? insumo.costoSubtotal : null,
      })),
    articulos,
  );

  const updateFormula = (key: number, changes: Partial<FormulaDraft>) =>
    setFormulas((prev) => prev.map((f) => (f.key === key ? { ...f, ...changes } : f)));

  const updateInsumo = (formula: FormulaDraft, key: number, changes: Partial<InsumoDraft>) =>
    updateFormula(formula.key, { insumos: formula.insumos.map((i) => (i.key === key ? { ...i, ...changes } : i)) });

  const elegirArticulo = (formula: FormulaDraft, key: number, articulo: Articulo) =>
    updateInsumo(formula, key, {
      articuloId: articulo.id,
      busqueda: '',
      producto: articulo.nombre,
      marca: formatMarca(articulo.marca),
      tono: articulo.tonalidad ?? '',
      unidad: articulo.tipoPeso,
    });

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

    // Las filas vacías no se guardan
    const filas = tratamientos.filter((fila) => !filaVacia(fila));
    const nuevosErrores = Object.fromEntries(filas.map((fila) => [fila.key, validarTratamiento(fila)]));
    setErroresTratamientos(nuevosErrores);
    if (Object.values(nuevosErrores).some(Boolean)) errors.tratamientos = 'Revisá los tratamientos previos';
    const textoTratamientos = serializeTratamientos({ filas: filas.map(fromTratamientoDraft), notas: notasTratamientos });
    if (textoTratamientos.length > FICHA_TEXTO_MAX) errors.tratamientos = 'Los tratamientos previos son demasiado largos: sacá alguna fila o acortá las notas';

    const data: FichaData = {
      porosidad: porosidad || null,
      elasticidad: elasticidad || null,
      tipoDePelo: tipoDePelo || null,
      volumenDePelo: volumenDePelo || null,
      porcentajeCanas: canas,
      tratamientosPrevios: textoTratamientos || null,
      indicacionesCliente: indicacionesCliente.trim() || null,
      observacionesInternas: observacionesInternas.trim() || null,
      formulas: formulas.map((formula, f) => ({
        descripcion: formula.descripcion.trim() || null,
        oxidanteVolumen: formula.oxidanteVolumen ? Number(formula.oxidanteVolumen) : null,
        tiempoPoseMin: entero(formula.tiempoPoseMin, 1, POSE_MAX_MIN, `f${f}.pose`, `Entre 1 y ${POSE_MAX_MIN} minutos`),
        // Las filas vacías no se mandan
        insumos: formula.insumos
          .map((insumo, i) => ({ insumo, i }))
          .filter(({ insumo }) => insumo.articuloId !== null || insumo.comoTexto || insumo.busqueda.trim() || insumo.cantidad.trim())
          .map(({ insumo, i }): InsumoData => {
            const cantidad = insumo.cantidad.trim().replace(',', '.');
            if (!insumo.comoTexto && insumo.articuloId === null) errors[`f${f}.i${i}.producto`] = 'Elegí un artículo de la lista';
            else if (!insumo.comoTexto && !cantidad) errors[`f${f}.i${i}.cantidad`] = 'Indicá cuánto usaste';
            else if (cantidad && (!CANTIDAD_REGEX.test(insumo.cantidad.trim()) || Number(cantidad) <= 0)) {
              errors[`f${f}.i${i}.cantidad`] = 'La cantidad tiene que ser mayor a 0, con hasta 2 decimales';
            }
            if (insumo.articuloId !== null) return { articuloId: insumo.articuloId, cantidad: Number(cantidad) };
            return {
              producto: insumo.producto,
              marca: insumo.marca || null,
              tono: insumo.tono || null,
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
      {ficha?.cerradaEn && (
        <p className="rounded-md bg-amber-50 px-3 py-2 font-inter text-xs text-amber-800">
          Esta ficha ya está cerrada. Si cambiás los productos o las cantidades, el stock se corrige solo con la diferencia y el costo se recalcula con el precio de hoy. La clienta ve los cambios en sus indicaciones y fotos.
        </p>
      )}
      <section className="flex flex-col gap-5">
        <h3 className={sectionTitleClass}>Diagnóstico</h3>
        <div className="grid gap-5 sm:grid-cols-2">
          <Opciones label="Porosidad" opciones={NIVELES} value={porosidad} onChange={setPorosidad} />
          <Opciones label="Elasticidad" opciones={NIVELES} value={elasticidad} onChange={setElasticidad} />
          <Opciones label="Tipo de pelo" opciones={TIPOS_DE_PELO} value={tipoDePelo} onChange={setTipoDePelo} />
          <Opciones label="Volumen" opciones={VOLUMENES_DE_PELO} value={volumenDePelo} onChange={setVolumenDePelo} />
        </div>
        <div className="flex flex-col gap-1">
          <label className={`${labelClass} flex items-center gap-3`}>
            % de canas
            <input
              inputMode="numeric"
              value={porcentajeCanas}
              // Solo dígitos, y no deja pasar de 100
              onChange={(event) => {
                const digitos = event.target.value.replace(/\D/g, '');
                setPorcentajeCanas(Number(digitos) > 100 ? '100' : digitos);
              }}
              placeholder="0 a 100"
              aria-invalid={fieldErrors.canas ? true : undefined}
              className={`${smallInputClass} w-20! py-1! text-center font-normal normal-case tracking-normal ${fieldErrors.canas ? 'border-red-500' : 'border-gray-300'}`}
            />
          </label>
          <FieldError message={fieldErrors.canas} />
        </div>
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-4">
            <h3 className={sectionTitleClass}>Tratamientos previos</h3>
            <button
              type="button"
              onClick={() => setTratamientos((prev) => [...prev, newTratamiento()])}
              className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-violet hover:underline"
            >
              + Agregar tratamiento
            </button>
          </div>
          {tratamientos.length === 0 && <p className="font-inter text-sm text-capilar-grey">Sin tratamientos cargados.</p>}
          <TratamientosField filas={tratamientos} onChange={setTratamientos} errores={erroresTratamientos} inputClass={smallInputClass} />
          <TextArea
            label="Otros datos (opcional)"
            value={notasTratamientos}
            onChange={setNotasTratamientos}
            hint="Lo que no entre en las filas, o lo que ya estaba escrito en la ficha."
          />
          <FieldError message={fieldErrors.tratamientos} />
        </div>
      </section>

      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className={sectionTitleClass}>Fórmulas</h3>
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
            <div className="grid gap-3 sm:grid-cols-[2fr_1fr]">
              <div className="flex flex-col gap-2">
                <label className={labelClass}>
                  Zona
                  <select
                    value={formula.zonaOtra ? ZONA_OTRA : formula.descripcion}
                    onChange={(event) =>
                      updateFormula(
                        formula.key,
                        event.target.value === ZONA_OTRA ? { zonaOtra: true, descripcion: '' } : { zonaOtra: false, descripcion: event.target.value },
                      )
                    }
                    className={`${smallInputClass} mt-1 border-gray-300 bg-white normal-case tracking-normal font-normal`}
                  >
                    <option value="">Sin indicar</option>
                    {ZONAS_FORMULA.map((zona) => (
                      <option key={zona} value={zona}>
                        {zona}
                      </option>
                    ))}
                    <option value={ZONA_OTRA}>Otra</option>
                  </select>
                </label>
                {formula.zonaOtra && (
                  <input
                    value={formula.descripcion}
                    onChange={(event) => updateFormula(formula.key, { descripcion: event.target.value })}
                    maxLength={FORMULA_DESCRIPCION_MAX}
                    placeholder="¿Qué zona?"
                    aria-label={`Otra zona de la fórmula ${f + 1}`}
                    className={`${smallInputClass} border-gray-300`}
                  />
                )}
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

            {formula.oxidanteVolumen && <p className="font-inter text-sm text-capilar-grey">Oxidante {formula.oxidanteVolumen} vol</p>}

            <div className="flex flex-col gap-2">
              <span className={labelClass}>Productos</span>
              {articulosError && <p className="rounded-md bg-amber-50 px-3 py-2 font-inter text-xs text-amber-800">No se pudo cargar el stock: {articulosError}</p>}
              {formula.insumos.map((insumo, i) => {
                const errorProducto = fieldErrors[`f${f}.i${i}.producto`];
                const errorCantidad = fieldErrors[`f${f}.i${i}.cantidad`];
                const elegido = insumo.articuloId !== null || insumo.comoTexto;
                const articulo = articulos.find((a) => a.id === insumo.articuloId);
                const cantidadUsada = Number(insumo.cantidad.replace(',', '.')) || 0;
                const costoDeLaFila =
                  usarCostoGuardado && insumo.costoSubtotal !== null
                    ? Number(insumo.costoSubtotal)
                    : articulo && cantidadUsada > 0
                      ? costoDeInsumo(articulo, cantidadUsada)
                      : null;
                return (
                  <div key={insumo.key} className="flex flex-col gap-1">
                    <div className="grid grid-cols-[1fr_5rem_auto] items-center gap-2 sm:grid-cols-[1fr_6rem_2.5rem_auto]">
                      <div className="col-span-3 sm:col-span-1">
                        {elegido ? (
                          <div className="flex flex-col rounded-lg border border-gray-200 bg-white px-3 py-1.5 font-inter text-sm">
                            <span className="font-semibold text-black">
                              {insumo.producto}
                              {insumo.tono && ` · ${insumo.tono}`}
                            </span>
                            <span className="text-xs text-capilar-grey">
                              {insumo.comoTexto
                                ? [insumo.marca, 'Cargado como texto: no descuenta stock'].filter(Boolean).join(' · ')
                                : [
                                    insumo.marca,
                                    articulo && `Hay ${formatEnvases(articulo.stock)}`,
                                    articulo && `1 envase = ${Number(articulo.pesoInicial)} ${UNIDADES[articulo.tipoPeso]}`,
                                    costoDeLaFila !== null && formatPrice(costoDeLaFila),
                                  ]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </span>
                          </div>
                        ) : (
                          <ArticuloPicker
                            value={insumo.busqueda}
                            onChange={(busqueda) => updateInsumo(formula, insumo.key, { busqueda })}
                            articulos={articulos}
                            onSelect={(elegidoDelStock) => elegirArticulo(formula, insumo.key, elegidoDelStock)}
                            onCrear={onCrearArticulo && ((nombre) => onCrearArticulo(nombre, (nuevo) => elegirArticulo(formula, insumo.key, nuevo)))}
                            aria-label={`Producto ${i + 1} de la fórmula ${f + 1}`}
                            invalid={Boolean(errorProducto)}
                            className={`${smallInputClass} ${errorProducto ? 'border-red-500' : 'border-gray-300'}`}
                          />
                        )}
                      </div>
                      <input
                        inputMode="decimal"
                        value={insumo.cantidad}
                        onChange={(event) => updateInsumo(formula, insumo.key, { cantidad: limitarDecimal(event.target.value, 2) })}
                        placeholder="Cant."
                        aria-label={`Cantidad del producto ${i + 1}`}
                        aria-invalid={errorCantidad ? true : undefined}
                        className={`${smallInputClass} ${errorCantidad ? 'border-red-500' : 'border-gray-300'}`}
                      />
                      <span className="font-inter text-sm text-capilar-grey">{insumo.unidad ? UNIDADES[insumo.unidad as UnidadInsumo] : ''}</span>
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
        <TotalProductos {...totalProductos} />
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
