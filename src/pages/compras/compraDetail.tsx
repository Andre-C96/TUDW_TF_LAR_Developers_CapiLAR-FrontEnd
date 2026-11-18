import { useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { formatCantidad, formatMarca, getArticulosRequest } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { ESTADOS_COMPRA, anularCompraRequest, getCompraRequest } from '../../api/compras';
import { formatCuit } from '../../api/proveedores';
import { formatPrice } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { ConfirmDialog } from '../../components/confirmDialog/confirmDialog';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { avisarSinStock } from '../agenda/fichaAvisos';

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{label}</dt>
    <dd className="font-inter text-sm text-black">{children}</dd>
  </div>
);

const celdaClass = 'px-4 py-2.5 text-right whitespace-nowrap';

// Detalle de una compra: datos, artículos y anular (con motivo). Una anulada se conserva y no se puede volver a aplicar
export const CompraDetail = () => {
  const { token } = useAuth();
  const id = Number(useParams().id);
  const compra = useFetch(token ? `compra-${id}` : null, () => getCompraRequest(token!, id));
  // Las líneas de la compra no traen el tono: sale del artículo (también de los dados de baja)
  const articulos = useFetch(token ? 'articulos-con-bajas' : null, () => getArticulosRequest(token!, true));

  const [anulando, setAnulando] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');

  const data = compra.data;
  const titulo = data ? `Comprobante ${data.numComprobante}` : 'Compra';

  const cerrar = () => {
    if (isSaving) return;
    setAnulando(false);
    setSaveError('');
  };

  const anular = async (motivo: string) => {
    setIsSaving(true);
    setSaveError('');
    try {
      const { compra: actualizada, sinStock } = await anularCompraRequest(token!, id, motivo);
      compra.setData(() => actualizada);
      setAnulando(false);
      toast.success('Compra anulada', { description: 'Se restó del stock lo que había sumado.' });
      avisarSinStock(sinStock);
    } catch (err) {
      setSaveError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Probá de nuevo.');
    } finally {
      setIsSaving(false);
    }
  };

  const tonoDe = (articuloId: number) => articulos.data?.find((articulo) => articulo.id === articuloId)?.tonalidad;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Compras', to: '/panel/compras' }, { label: titulo }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Title>{titulo}</Title>
          {data?.estado === 'APLICADO' && (
            <button
              type="button"
              onClick={() => setAnulando(true)}
              className="shrink-0 self-start rounded-[6px] border border-gray-300 bg-white px-5 py-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey transition-colors hover:border-red-500 hover:text-red-500 md:self-auto"
            >
              Anular compra
            </button>
          )}
        </div>
      </div>

      {compra.error ? (
        <Alert variant="error" title="No se pudo cargar la compra">
          {compra.error}
        </Alert>
      ) : !data ? (
        <Loader label="Cargando compra..." className="py-12" />
      ) : (
        <>
          {data.estado === 'ANULADO' && (
            <Alert variant="advertencia" title="Compra anulada">
              {data.motivo}
            </Alert>
          )}

          <dl className="grid gap-5 rounded-[6px] border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2 md:grid-cols-4">
            <Dato label="Proveedor">
              <Link to={`/panel/proveedores/${data.proveedor.id}`} className="font-semibold hover:text-capilar-violet">
                {data.proveedor.razonSocial}
              </Link>
              <span className="block text-xs text-capilar-grey">{formatCuit(data.proveedor.cuit)}</span>
            </Dato>
            <Dato label="Fecha">{new Date(data.fecha).toLocaleDateString('es-AR')}</Dato>
            <Dato label="Estado">{ESTADOS_COMPRA[data.estado]}</Dato>
            <Dato label="Cargada por">
              {data.usuario.nombre} {data.usuario.apellido}
            </Dato>
          </dl>

          <div className="overflow-x-auto rounded-[6px] border border-gray-200 bg-white shadow-sm">
            <table className="w-full font-inter text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] uppercase tracking-widest text-capilar-grey">
                  <th className="px-4 py-2.5 text-left font-semibold">Producto</th>
                  <th className={`${celdaClass} font-semibold`}>Envases</th>
                  <th className={`${celdaClass} font-semibold`}>Costo x envase</th>
                  <th className={`${celdaClass} font-semibold`}>Subtotal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 text-black">
                {data.lineas.map((linea) => {
                  const tono = tonoDe(linea.articulo.id);
                  return (
                    <tr key={linea.id}>
                      <td className="px-4 py-2.5">
                        <Link to={`/panel/stock/${linea.articulo.id}`} className="font-semibold hover:text-capilar-violet">
                          {linea.articulo.nombre}
                          {tono && ` · ${tono}`}
                        </Link>
                        <span className="block text-xs text-capilar-grey">{formatMarca(linea.articulo.marca)}</span>
                      </td>
                      <td className={celdaClass}>{formatCantidad(linea.cantidad)}</td>
                      <td className={celdaClass}>{formatPrice(linea.costoUnitario)}</td>
                      <td className={`${celdaClass} font-semibold`}>{formatPrice(linea.subtotal)}</td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="border-t border-gray-200 text-base font-semibold text-black">
                  <td className="px-4 py-3" colSpan={3}>
                    Total
                  </td>
                  <td className={celdaClass}>{formatPrice(data.total)}</td>
                </tr>
              </tfoot>
            </table>
          </div>
        </>
      )}

      <ConfirmDialog
        isOpen={anulando}
        onClose={cerrar}
        title="Anular compra"
        confirmLabel="Anular compra"
        onConfirm={anular}
        isLoading={isSaving}
        error={saveError}
        reason={{ label: 'Motivo', required: true, maxLength: 255, placeholder: 'Ej.: se cargó con el proveedor equivocado' }}
      >
        Se resta del stock lo que sumó esta compra. El precio de costo de los artículos no vuelve atrás y la compra no se puede volver a aplicar: habría que cargarla de nuevo.
      </ConfirmDialog>
    </section>
  );
};
