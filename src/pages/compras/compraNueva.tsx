import { useState } from 'react';
import type { FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { DOS_DECIMALES, PRECIO_MAX, STOCK_MAX, TRES_DECIMALES, formatMarca, getArticulosRequest, limitarDecimal, parseDecimal } from '../../api/articulos';
import type { Articulo } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { COMPROBANTE_MAX, LINEAS_COMPRA_MAX, createCompraRequest } from '../../api/compras';
import { getProveedoresRequest } from '../../api/proveedores';
import { formatPrice } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { SelectField } from '../../components/articuloForm/articuloForm';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { ArticuloPicker } from '../../components/fichaForm/articuloPicker';
import { Form, FormField } from '../../components/form/form';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { NuevoArticuloModal } from '../agenda/nuevoArticuloModal';

const inputClass =
  'w-full rounded-lg border px-3 py-2 text-right font-inter text-sm text-black outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20';
const headClass = 'font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey';
// Mismas columnas en el encabezado y en cada fila
const filaClass = 'grid grid-cols-[minmax(12rem,1fr)_6rem_8rem_7rem_2rem] items-start gap-3';

interface Linea {
  articulo: Articulo;
  cantidad: string;
  costo: string;
}

type ErroresDeLinea = { cantidad?: string; costo?: string };

const validarCantidad = (texto: string) => {
  if (!texto.trim()) return 'Falta';
  if (!TRES_DECIMALES.test(texto.trim()) || parseDecimal(texto) <= 0) return 'Mayor a 0';
  return parseDecimal(texto) > STOCK_MAX ? 'Muy alto' : undefined;
};

const validarCosto = (texto: string) => {
  if (!texto.trim()) return 'Falta';
  if (!DOS_DECIMALES.test(texto.trim())) return 'Hasta 2 decimales';
  return parseDecimal(texto) > PRECIO_MAX ? 'Muy alto' : undefined;
};

// Nueva compra, en página propia: puede tener hasta 50 artículos y en un modal se perdería todo con un clic afuera.
// El costo de cada línea arranca con el precio actual del artículo
export const CompraNueva = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const proveedores = useFetch(token ? 'proveedores-activos' : null, () => getProveedoresRequest(token!));
  const articulos = useFetch(token ? 'articulos-activos' : null, () => getArticulosRequest(token!));

  // ?proveedor=: viene elegido desde el detalle del proveedor
  const [proveedorId, setProveedorId] = useState(searchParams.get('proveedor') ?? '');
  const [numComprobante, setNumComprobante] = useState('');
  const [busqueda, setBusqueda] = useState('');
  const [lineas, setLineas] = useState<Linea[]>([]);
  const [errores, setErrores] = useState<{ proveedor?: string; comprobante?: string; lineas?: string }>({});
  const [erroresLinea, setErroresLinea] = useState<Record<number, ErroresDeLinea>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  // Nombre del artículo que se está creando desde el buscador
  const [nuevoArticulo, setNuevoArticulo] = useState<string | null>(null);

  const elegidos = new Set(lineas.map((linea) => linea.articulo.id));
  const disponibles = (articulos.data ?? []).filter((articulo) => !elegidos.has(articulo.id));

  const agregar = (articulo: Articulo) => {
    // Puede venir de "Usar el que ya existe" con uno que ya estaba en la compra
    setLineas((prev) => (prev.some((linea) => linea.articulo.id === articulo.id) ? prev : [...prev, { articulo, cantidad: '', costo: String(Number(articulo.precioCosto)) }]));
    setBusqueda('');
    setErrores((prev) => ({ ...prev, lineas: undefined }));
  };

  const cambiar = (id: number, cambios: Partial<Linea>) => setLineas((prev) => prev.map((linea) => (linea.articulo.id === id ? { ...linea, ...cambios } : linea)));

  const subtotal = ({ cantidad, costo }: Linea) => Math.round((parseDecimal(cantidad) || 0) * (parseDecimal(costo) || 0) * 100) / 100;
  const total = lineas.reduce((suma, linea) => suma + subtotal(linea), 0);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const nuevos = {
      proveedor: proveedorId ? undefined : 'Elegí el proveedor',
      comprobante: numComprobante.trim() ? undefined : 'Ingresá el número de comprobante',
      lineas: lineas.length > 0 ? undefined : 'Agregá al menos un artículo',
    };
    const porLinea = Object.fromEntries(lineas.map((linea) => [linea.articulo.id, { cantidad: validarCantidad(linea.cantidad), costo: validarCosto(linea.costo) }]));
    setErrores(nuevos);
    setErroresLinea(porLinea);
    if (Object.values(nuevos).some(Boolean) || Object.values(porLinea).some((fila) => fila.cantidad || fila.costo)) return;

    setIsSaving(true);
    setError('');
    try {
      const compra = await createCompraRequest(token!, {
        proveedorId: Number(proveedorId),
        numComprobante: numComprobante.trim(),
        lineas: lineas.map((linea) => ({ articuloId: linea.articulo.id, cantidad: parseDecimal(linea.cantidad), costoUnitario: parseDecimal(linea.costo) })),
      });
      toast.success('Compra cargada', { description: 'Se sumó el stock y se actualizaron los precios de costo.' });
      navigate(`/panel/compras/${compra.id}`, { replace: true });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Probá de nuevo.');
      setIsSaving(false);
    }
  };

  const cargando = !proveedores.data && !proveedores.error;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Compras', to: '/panel/compras' }, { label: 'Nueva compra' }]} />
        <Title>Nueva compra</Title>
      </div>

      {proveedores.error ? (
        <Alert variant="error" title="No se pudieron cargar los proveedores">
          {proveedores.error}
        </Alert>
      ) : cargando ? (
        <Loader label="Cargando..." className="py-12" />
      ) : proveedores.data?.length === 0 ? (
        <Alert variant="advertencia" title="Todavía no hay proveedores">
          Cargá uno en{' '}
          <Link to="/panel/proveedores?nuevo=1" className="font-semibold underline">
            Proveedores
          </Link>{' '}
          para poder registrar una compra.
        </Alert>
      ) : (
        <Form onSubmit={handleSubmit} noValidate className="gap-8!">
          <div className="grid gap-5 sm:grid-cols-2">
            <SelectField label="Proveedor" value={proveedorId} onChange={setProveedorId} error={errores.proveedor}>
              <option value="">Elegí un proveedor</option>
              {proveedores.data?.map((proveedor) => (
                <option key={proveedor.id} value={proveedor.id}>
                  {proveedor.razonSocial}
                </option>
              ))}
            </SelectField>
            <FormField
              label="N.º de comprobante"
              value={numComprobante}
              onChange={(event) => setNumComprobante(event.target.value)}
              maxLength={COMPROBANTE_MAX}
              placeholder="Ej.: 0001-00012345"
              error={errores.comprobante}
            />
          </div>

          <section className="flex flex-col gap-3">
            <h2 className="font-inter text-sm font-semibold uppercase tracking-widest text-black">Artículos</h2>
            {articulos.error && <p className="rounded-md bg-amber-50 px-3 py-2 font-inter text-xs text-amber-800">No se pudo cargar el stock: {articulos.error}</p>}

            {lineas.length > 0 && (
              <div className="overflow-x-auto">
                <div className="flex min-w-[36rem] flex-col gap-2">
                  <div className={filaClass}>
                    <span className={headClass}>Producto</span>
                    <span className={`${headClass} text-right`}>Envases</span>
                    <span className={`${headClass} text-right`}>Costo x envase</span>
                    <span className={`${headClass} text-right`}>Subtotal</span>
                    <span />
                  </div>
                  {lineas.map((linea) => {
                    const { articulo } = linea;
                    const fila = erroresLinea[articulo.id] ?? {};
                    const nombre = `${articulo.nombre}${articulo.tonalidad ? ` · ${articulo.tonalidad}` : ''}`;
                    return (
                      <div key={articulo.id} className={filaClass}>
                        <div className="flex min-w-0 flex-col font-inter">
                          <span className="text-sm font-semibold text-black">{nombre}</span>
                          <span className="text-xs text-capilar-grey">{formatMarca(articulo.marca)}</span>
                        </div>
                        <div className="flex flex-col gap-1">
                          <input
                            inputMode="decimal"
                            value={linea.cantidad}
                            onChange={(event) => cambiar(articulo.id, { cantidad: limitarDecimal(event.target.value, 3) })}
                            aria-label={`Envases de ${nombre}`}
                            aria-invalid={fila.cantidad ? true : undefined}
                            className={`${inputClass} ${fila.cantidad ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {fila.cantidad && <p className="text-right font-inter text-xs text-red-500">{fila.cantidad}</p>}
                        </div>
                        <div className="flex flex-col gap-1">
                          <input
                            inputMode="decimal"
                            value={linea.costo}
                            onChange={(event) => cambiar(articulo.id, { costo: limitarDecimal(event.target.value, 2) })}
                            aria-label={`Costo por envase de ${nombre}`}
                            aria-invalid={fila.costo ? true : undefined}
                            className={`${inputClass} ${fila.costo ? 'border-red-500' : 'border-gray-300'}`}
                          />
                          {fila.costo && <p className="text-right font-inter text-xs text-red-500">{fila.costo}</p>}
                        </div>
                        <span className="py-2 text-right font-inter text-sm font-semibold text-black">{formatPrice(subtotal(linea))}</span>
                        <button
                          type="button"
                          onClick={() => setLineas((prev) => prev.filter((l) => l.articulo.id !== articulo.id))}
                          aria-label={`Quitar ${nombre}`}
                          className="py-2 text-capilar-grey hover:text-red-500"
                        >
                          ✕
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {lineas.length < LINEAS_COMPRA_MAX && (
              <div className="sm:max-w-sm">
                <ArticuloPicker
                  value={busqueda}
                  onChange={setBusqueda}
                  articulos={disponibles}
                  onSelect={agregar}
                  onCrear={setNuevoArticulo}
                  aria-label="Agregar un artículo a la compra"
                  invalid={Boolean(errores.lineas)}
                  className={`w-full rounded-lg border px-3 py-2 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
                    errores.lineas ? 'border-red-500' : 'border-gray-300'
                  }`}
                />
              </div>
            )}
            {errores.lineas && <p className="font-inter text-xs text-red-500">{errores.lineas}</p>}

            {lineas.length > 0 && (
              <p className="flex items-baseline justify-end gap-6 border-t border-gray-200 pt-3 font-inter text-base font-semibold text-black">
                <span>Total</span>
                <span>{formatPrice(total)}</span>
              </p>
            )}
            <p className="font-inter text-xs text-capilar-grey">Al guardar se suma el stock y el costo pasa a ser el precio del artículo.</p>
          </section>

          {error && (
            <p role="alert" className="text-center font-inter text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="grey" onClick={() => navigate('/panel/compras')} disabled={isSaving} className="px-5 py-2 text-xs uppercase">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSaving ? 'Guardando...' : 'Guardar compra'}
            </Button>
          </div>
        </Form>
      )}

      {nuevoArticulo !== null && (
        <NuevoArticuloModal
          token={token!}
          paraCompra
          nombreInicial={nuevoArticulo}
          articulos={articulos.data ?? []}
          onCreado={(articulo) => articulos.setData((prev) => [...prev, articulo])}
          onElegir={agregar}
          onClose={() => setNuevoArticulo(null)}
        />
      )}
    </section>
  );
};
