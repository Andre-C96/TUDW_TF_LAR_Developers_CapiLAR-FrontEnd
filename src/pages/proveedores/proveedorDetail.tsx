import { useState } from 'react';
import type { ReactNode } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { formatMarca } from '../../api/articulos';
import { getComprasRequest } from '../../api/compras';
import { formatCuit, getMarcasDeProveedorRequest, getProveedorRequest } from '../../api/proveedores';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Loader } from '../../components/loader/loader';
import { Pagination } from '../../components/pagination/pagination';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { ComprasLista } from '../compras/comprasLista';

const POR_PAGINA = 20;

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">{label}</dt>
    <dd className="font-inter text-sm text-black">{children || <span className="text-capilar-grey">—</span>}</dd>
  </div>
);

// Detalle de un proveedor: sus datos, las marcas que se le compraron y sus compras
export const ProveedorDetail = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const id = Number(useParams().id);
  const [pagina, setPagina] = useState(1);

  const proveedor = useFetch(token ? `proveedor-${id}` : null, () => getProveedorRequest(token!, id));
  const marcas = useFetch(token ? `proveedor-marcas-${id}` : null, () => getMarcasDeProveedorRequest(token!, id));
  const compras = useFetch(token ? `proveedor-compras-${id}-${pagina}` : null, () => getComprasRequest(token!, pagina, POR_PAGINA, { proveedorId: id }));

  const data = proveedor.data;

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Proveedores', to: '/panel/proveedores' }, { label: data?.razonSocial ?? 'Proveedor' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <Title>{data?.razonSocial ?? 'Proveedor'}</Title>
          {data && data.fechaBaja === null && (
            <Button
              onClick={() => navigate(`/panel/compras/nueva?proveedor=${data.id}`)}
              className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
            >
              Nueva compra
            </Button>
          )}
        </div>
      </div>

      {proveedor.error ? (
        <Alert variant="error" title="No se pudo cargar el proveedor">
          {proveedor.error}
        </Alert>
      ) : !data ? (
        <Loader label="Cargando proveedor..." className="py-12" />
      ) : (
        <>
          {data.fechaBaja !== null && (
            <Alert variant="advertencia" title="Dado de baja">
              No se le pueden cargar compras nuevas. Las anteriores se conservan.
            </Alert>
          )}

          <dl className="grid gap-5 rounded-[6px] border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
            <Dato label="CUIT">{formatCuit(data.cuit)}</Dato>
            <Dato label="Teléfono">{data.telefono}</Dato>
            <Dato label="Email">{data.email}</Dato>
            <Dato label="Condiciones comerciales">{data.condicionesComerciales}</Dato>
            <Dato label="Marcas que se le compraron">{marcas.data?.map(formatMarca).join(', ')}</Dato>
          </dl>

          <section className="flex flex-col gap-3">
            <h2 className="font-inter text-xl font-semibold text-black">Compras</h2>
            {compras.error ? (
              <Alert variant="error" title="No se pudieron cargar las compras">
                {compras.error}
              </Alert>
            ) : !compras.data ? (
              <Loader label="Cargando compras..." className="py-8" />
            ) : (
              <>
                <ComprasLista compras={compras.data.items} emptyMessage="Todavía no tiene compras cargadas." />
                <Pagination pagina={pagina} total={compras.data.total} porPagina={POR_PAGINA} onChange={setPagina} />
              </>
            )}
          </section>
        </>
      )}
    </section>
  );
};
