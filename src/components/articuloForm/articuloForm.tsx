import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Link } from 'react-router-dom';
import {
  ARTICULO_CODIGO_MAX,
  ARTICULO_NOMBRE_MAX,
  ARTICULO_TONALIDAD_MAX,
  DEPOSITOS,
  DOS_DECIMALES,
  PRECIO_MAX,
  STOCK_MAX,
  TIPOS_DE_PRODUCTO,
  TRES_DECIMALES,
  USOS,
  formatMarca,
  limitarDecimal,
  parseDecimal,
} from '../../api/articulos';
import type { Articulo, ArticuloData, Marca, TipoDeposito, TipoProducto, UsoArticulo } from '../../api/articulos';
import { UNIDADES } from '../../api/fichas';
import type { UnidadInsumo } from '../../api/fichas';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

interface ArticuloFormProps {
  // Artículo a editar; sin él, el formulario es de alta
  articulo?: Articulo;
  marcas: Marca[];
  // Recibe los datos ya validados; quien lo usa llama a la API
  onSubmit: (data: ArticuloData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Mismo aspecto que FormField, con un <select> nativo
const SelectField = ({
  label,
  value,
  onChange,
  error,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  children: ReactNode;
}) => {
  const id = useId();
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
        {label}
      </label>
      <select
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className={`w-full rounded-lg border bg-white px-4 py-3 font-inter text-sm text-black outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
          error ? 'border-red-500' : 'border-gray-300'
        }`}
      >
        {children}
      </select>
      {error && <p className="font-inter text-xs text-red-500">{error}</p>}
    </div>
  );
};

const optionsOf = <T extends string>(labels: Record<T, string>) =>
  (Object.keys(labels) as T[]).map((value) => (
    <option key={value} value={value}>
      {labels[value]}
    </option>
  ));

// Número con el máximo de decimales del regex, entre 0 y max. Devuelve el mensaje de error o undefined
const validarNumero = (text: string, regex: RegExp, max: number, vacio: string) => {
  if (!text.trim()) return vacio;
  if (!regex.test(text.trim())) return `Ingresá un número, con hasta ${regex === TRES_DECIMALES ? 3 : 2} decimales`;
  if (parseDecimal(text) > max) return 'El número es demasiado alto';
  return undefined;
};

// Alta y edición de un artículo (ADMIN). El stock inicial solo se carga al crearlo: después cambia con los movimientos
export const ArticuloForm = ({ articulo, marcas, onSubmit, onCancel, isLoading = false, error }: ArticuloFormProps) => {
  const [nombre, setNombre] = useState(articulo?.nombre ?? '');
  const [marcaId, setMarcaId] = useState(articulo ? String(articulo.marcaId) : '');
  const [tipoProducto, setTipoProducto] = useState<TipoProducto>(articulo?.tipoProducto ?? 'TINTURA');
  const [uso, setUso] = useState<UsoArticulo>(articulo?.uso ?? 'SALON');
  const [tonalidad, setTonalidad] = useState(articulo?.tonalidad ?? '');
  const [codigo, setCodigo] = useState(articulo?.codigo ?? '');
  const [pesoInicial, setPesoInicial] = useState(articulo?.pesoInicial ?? '');
  const [tipoPeso, setTipoPeso] = useState<UnidadInsumo>(articulo?.tipoPeso ?? 'G');
  const [precioCosto, setPrecioCosto] = useState(articulo?.precioCosto ?? '');
  const [precioVenta, setPrecioVenta] = useState(articulo?.precioVenta ?? '');
  const [stock, setStock] = useState('0');
  const [stockMinAlert, setStockMinAlert] = useState(articulo?.stockMinAlert ?? '0');
  const [tipoDeposito, setTipoDeposito] = useState<TipoDeposito>(articulo?.tipoDeposito ?? 'SALON');
  const [fechaVencimiento, setFechaVencimiento] = useState(articulo?.fechaVencimiento ?? '');
  const [fieldErrors, setFieldErrors] = useState<Record<string, string | undefined>>({});

  const seVende = uso !== 'SALON';

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors: Record<string, string | undefined> = {
      nombre: nombre.trim() ? undefined : 'Ingresá el nombre del artículo',
      marcaId: marcaId ? undefined : 'Elegí la marca',
      pesoInicial:
        validarNumero(pesoInicial, DOS_DECIMALES, PRECIO_MAX, 'Ingresá el contenido del envase') ??
        (parseDecimal(pesoInicial) > 0 ? undefined : 'Tiene que ser mayor a 0'),
      precioCosto: validarNumero(precioCosto, DOS_DECIMALES, PRECIO_MAX, 'Ingresá el precio de costo'),
      precioVenta: seVende ? validarNumero(precioVenta, DOS_DECIMALES, PRECIO_MAX, 'Ingresá el precio de venta') : undefined,
      stock: articulo ? undefined : validarNumero(stock, TRES_DECIMALES, STOCK_MAX, 'Ingresá el stock inicial'),
      stockMinAlert: validarNumero(stockMinAlert, TRES_DECIMALES, STOCK_MAX, 'Ingresá el stock mínimo'),
    };
    setFieldErrors(errors);
    if (Object.values(errors).some(Boolean)) return;

    onSubmit({
      nombre: nombre.trim(),
      codigo: codigo.trim() || null,
      uso,
      tipoProducto,
      marcaId: Number(marcaId),
      precioCosto: parseDecimal(precioCosto),
      ...(seVende && { precioVenta: parseDecimal(precioVenta) }),
      pesoInicial: parseDecimal(pesoInicial),
      tipoPeso,
      tonalidad: tonalidad.trim() || null,
      tipoDeposito,
      stockMinAlert: parseDecimal(stockMinAlert),
      fechaVencimiento: fechaVencimiento || null,
      ...(!articulo && { stock: parseDecimal(stock) }),
    });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{articulo ? 'Editar artículo' : 'Nuevo artículo'}</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {articulo ? 'El stock no se edita acá: cambia con los movimientos.' : 'El QR se genera solo al crearlo.'}
        </p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Nombre"
          value={nombre}
          onChange={(event) => setNombre(event.target.value)}
          maxLength={ARTICULO_NOMBRE_MAX}
          placeholder="Ej.: Tintura Koleston"
          error={fieldErrors.nombre}
        />

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Marca" value={marcaId} onChange={setMarcaId} error={fieldErrors.marcaId}>
            <option value="">Elegí una marca</option>
            {marcas.map((marca) => (
              <option key={marca.id} value={marca.id}>
                {formatMarca(marca)}
              </option>
            ))}
          </SelectField>
          <SelectField label="Tipo de producto" value={tipoProducto} onChange={(value) => setTipoProducto(value as TipoProducto)}>
            {optionsOf(TIPOS_DE_PRODUCTO)}
          </SelectField>
        </div>
        {marcas.length === 0 && (
          <p className="font-inter text-xs text-capilar-grey">
            Todavía no hay marcas.{' '}
            <Link to="/panel/marcas" className="font-semibold text-capilar-violet hover:underline">
              Cargá la primera
            </Link>
            .
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Tono o volumen (opcional)"
            value={tonalidad}
            onChange={(event) => setTonalidad(event.target.value)}
            maxLength={ARTICULO_TONALIDAD_MAX}
            placeholder="Ej.: 7.1 o 20 vol"
          />
          <FormField
            label="Código del proveedor (opcional)"
            value={codigo}
            onChange={(event) => setCodigo(event.target.value)}
            maxLength={ARTICULO_CODIGO_MAX}
            placeholder="Ej.: 725TS"
          />
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <SelectField label="Uso" value={uso} onChange={(value) => setUso(value as UsoArticulo)}>
            {optionsOf(USOS)}
          </SelectField>
          <SelectField label="Dónde se guarda" value={tipoDeposito} onChange={(value) => setTipoDeposito(value as TipoDeposito)}>
            {optionsOf(DEPOSITOS)}
          </SelectField>
        </div>

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Contenido de un envase"
            inputMode="decimal"
            value={pesoInicial}
            onChange={(event) => setPesoInicial(limitarDecimal(event.target.value, 2))}
            placeholder="Ej.: 60"
            error={fieldErrors.pesoInicial}
          />
          <SelectField label="Unidad" value={tipoPeso} onChange={(value) => setTipoPeso(value as UnidadInsumo)}>
            {optionsOf(UNIDADES)}
          </SelectField>
        </div>
        {articulo && tipoPeso !== articulo.tipoPeso && articulo.envaseEnUso && (
          <p className="rounded-md bg-amber-50 px-3 py-2 font-inter text-xs text-amber-800">
            Al cambiar la unidad se termina el envase que está abierto.
          </p>
        )}

        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Precio de costo ($)"
            inputMode="decimal"
            value={precioCosto}
            onChange={(event) => setPrecioCosto(limitarDecimal(event.target.value, 2))}
            placeholder="Ej.: 12500"
            hint="Lo que paga el salón por un envase"
            error={fieldErrors.precioCosto}
          />
          {seVende && (
            <FormField
              label="Precio de venta ($)"
              inputMode="decimal"
              value={precioVenta}
              onChange={(event) => setPrecioVenta(limitarDecimal(event.target.value, 2))}
              placeholder="Ej.: 18000"
              error={fieldErrors.precioVenta}
            />
          )}
        </div>

        <div className={`grid gap-5 ${articulo ? 'sm:grid-cols-2' : 'sm:grid-cols-3'}`}>
          {!articulo && (
            <FormField
              label="Stock inicial"
              inputMode="decimal"
              value={stock}
              onChange={(event) => setStock(limitarDecimal(event.target.value, 3))}
              hint="En envases"
              error={fieldErrors.stock}
            />
          )}
          <FormField
            label="Stock mínimo"
            inputMode="decimal"
            value={stockMinAlert}
            onChange={(event) => setStockMinAlert(limitarDecimal(event.target.value, 3))}
            hint="En envases: avisa al llegar a este número"
            error={fieldErrors.stockMinAlert}
          />
          <FormField
            label="Vencimiento (opcional)"
            type="date"
            value={fechaVencimiento}
            onChange={(event) => setFechaVencimiento(event.target.value)}
          />
        </div>

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="px-5 py-2 text-xs uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : articulo ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Form>
    </div>
  );
};
