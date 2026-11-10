import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ESTADOS_COMPRA, getComprasRequest } from '../../api/compras';
import type { EstadoCompra } from '../../api/compras';
import { getProveedoresRequest } from '../../api/proveedores';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import type { DateRange } from '../../components/datePicker/datePicker';
import { Loader } from '../../components/loader/loader';
import { Pagination } from '../../components/pagination/pagination';
import { SearchBox } from '../../components/searchBox/searchBox';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { FilterSelect, RangoField } from '../agenda/agendaFiltros';
import { ComprasLista } from './comprasLista';

const POR_PAGINA = 20;
const TODOS = 'TODOS';

const OPCIONES_ESTADO = [[TODOS, 'Todos'], ...Object.entries(ESTADOS_COMPRA)] as [EstadoCompra | typeof TODOS, string][];
const OPCIONES_FECHA: ['todas' | 'rango', string][] = [
  ['todas', 'Todas'],
  ['rango', 'Rango'],
];

// Sección Compras del ADMIN: las compras a proveedores, con filtros en el back
export const Compras = () => {
  const { token } = useAuth();
  const navigate = useNavigate();
  const [proveedorId, setProveedorId] = useState(TODOS);
  const [estado, setEstado] = useState<EstadoCompra | typeof TODOS>(TODOS);
  const [fecha, setFecha] = useState<'todas' | 'rango'>('todas');
  const [rango, setRango] = useState<DateRange>({ desde: '', hasta: '' });
  const [busqueda, setBusqueda] = useState('');
  const [comprobante, setComprobante] = useState('');
  const [pagina, setPagina] = useState(1);

  // El comprobante se busca en el back: espera a que se deje de escribir
  useEffect(() => {
    const timer = setTimeout(() => {
      setComprobante(busqueda.trim());
      setPagina(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [busqueda]);

  const proveedores = useFetch(token ? 'proveedores' : null, () => getProveedoresRequest(token!, true));
  const opcionesProveedor: [string, string][] = [
    [TODOS, 'Todos'],
    ...(proveedores.data ?? []).map((p): [string, string] => [String(p.id), p.razonSocial]),
  ];

  const conRango = fecha === 'rango' && rango.hasta !== '';
  const filtros = {
    proveedorId: proveedorId === TODOS ? undefined : Number(proveedorId),
    estado: estado === TODOS ? undefined : estado,
    desde: conRango ? rango.desde : undefined,
    hasta: conRango ? rango.hasta : undefined,
    numComprobante: comprobante || undefined,
  };
  const compras = useFetch(token ? `compras-${pagina}-${JSON.stringify(filtros)}` : null, () => getComprasRequest(token!, pagina, POR_PAGINA, filtros));

  // Cada filtro nuevo vuelve a la primera página
  const conPrimeraPagina =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setPagina(1);
    };

  const conFiltros = proveedorId !== TODOS || estado !== TODOS || fecha !== 'todas';
  const limpiarFiltros = () => {
    setProveedorId(TODOS);
    setEstado(TODOS);
    setFecha('todas');
    setRango({ desde: '', hasta: '' });
    setPagina(1);
  };

  return (
    <section className="mx-auto flex max-w-5xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Panel', to: '/panel' }, { label: 'Compras' }]} />
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="flex flex-col gap-2">
            <Title>Compras</Title>
            <p className="font-inter text-capilar-grey">Lo que se le compró a cada proveedor.</p>
          </div>
          <Button
            onClick={() => navigate('/panel/compras/nueva')}
            className="shrink-0 self-start px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider md:self-auto"
          >
            Nueva compra
          </Button>
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <SearchBox value={busqueda} onChange={setBusqueda} label="Buscar por comprobante" placeholder="Buscar por número de comprobante" compact className="lg:max-w-sm lg:self-end" />
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm lg:flex-nowrap">
          <FilterSelect label="Proveedor" value={proveedorId} options={opcionesProveedor} onChange={conPrimeraPagina(setProveedorId)} compact />
          <FilterSelect label="Estado" value={estado} options={OPCIONES_ESTADO} onChange={conPrimeraPagina(setEstado)} />
          <FilterSelect label="Fecha" value={fecha} options={OPCIONES_FECHA} onChange={conPrimeraPagina(setFecha)} />
          {fecha === 'rango' && <RangoField value={rango} onChange={conPrimeraPagina(setRango)} />}
          {conFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="group ml-auto flex shrink-0 items-center gap-1.5 font-inter text-sm font-semibold text-capilar-violet transition-transform hover:scale-105"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeLinecap="round"
                aria-hidden="true"
                className="h-2.5 w-2.5 stroke-2 transition-[stroke-width] group-hover:stroke-[4]"
              >
                <path d="M6 6l12 12M18 6 6 18" />
              </svg>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>

      {compras.error ? (
        <Alert variant="error" title="No se pudieron cargar las compras">
          {compras.error}
        </Alert>
      ) : !compras.data ? (
        <Loader label="Cargando compras..." className="py-12" />
      ) : (
        <div className="flex flex-col gap-4">
          <ComprasLista
            compras={compras.data.items}
            emptyMessage={conFiltros || comprobante ? 'No hay compras que coincidan con los filtros.' : 'Todavía no hay compras. Cargá la primera con "Nueva compra".'}
          />
          <Pagination pagina={pagina} total={compras.data.total} porPagina={POR_PAGINA} onChange={setPagina} />
        </div>
      )}
    </section>
  );
};
