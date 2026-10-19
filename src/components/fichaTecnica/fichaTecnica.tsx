import { useId, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent, ReactNode } from 'react';
import { FOTOS_POR_MOMENTO, NIVELES, TIPOS_DE_PELO, UNIDADES, VOLUMENES_DE_PELO } from '../../api/fichas';
import type { Ficha, FichaCliente, FotoFicha, Insumo, MomentoFoto } from '../../api/fichas';
import { fromIsoDate } from '../../api/turnos';
import { FOTO_TIPOS } from '../../api/users';
import { FichaFoto } from '../fichaFoto/fichaFoto';
import { Modal } from '../modal/modal';

const labelClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';

// "2026-10-07" -> "7 de octubre de 2026" (el historial puede abarcar varios años)
const formatFechaFicha =(fecha: string) =>
  fromIsoDate(fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' });

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className={labelClass}>{label}</dt>
    <dd className="font-inter text-sm text-black">{children ?? <span className="text-capilar-grey">—</span>}</dd>
  </div>
);

const Texto = ({ titulo, texto, vacio }: { titulo: string; texto: string | null; vacio: string }) => (
  <div className="flex flex-col gap-2">
    <h4 className={labelClass}>{titulo}</h4>
    <p className={`font-inter text-sm whitespace-pre-line ${texto ? 'text-black' : 'text-capilar-grey'}`}>{texto || vacio}</p>
  </div>
);

// "Koleston 7.1 · 30 g"
const formatInsumo = (insumo: Insumo) =>
  [
    [insumo.producto, insumo.marca, insumo.tono].filter(Boolean).join(' '),
    insumo.cantidad && `${Number(insumo.cantidad)}${insumo.unidad ? ` ${UNIDADES[insumo.unidad]}` : ''}`,
  ]
    .filter(Boolean)
    .join(' · ');

// Diagnóstico, fórmulas e indicaciones de una ficha completa (para el salón)
export const FichaDatos = ({ ficha }: { ficha: Ficha }) => (
  <div className="flex flex-col gap-8">
    <dl className="grid grid-cols-2 gap-x-6 gap-y-5 md:grid-cols-3">
      <Dato label="Porosidad">{ficha.porosidad && NIVELES[ficha.porosidad]}</Dato>
      <Dato label="Elasticidad">{ficha.elasticidad && NIVELES[ficha.elasticidad]}</Dato>
      <Dato label="% de canas">{ficha.porcentajeCanas !== null && `${ficha.porcentajeCanas} %`}</Dato>
      <Dato label="Tipo de pelo">{ficha.tipoDePelo && TIPOS_DE_PELO[ficha.tipoDePelo]}</Dato>
      <Dato label="Volumen">{ficha.volumenDePelo && VOLUMENES_DE_PELO[ficha.volumenDePelo]}</Dato>
    </dl>

    <Texto titulo="Tratamientos previos" texto={ficha.tratamientosPrevios} vacio="Sin datos." />

    <div className="flex flex-col gap-3">
      <h4 className={labelClass}>Fórmulas</h4>
      {ficha.formulas.length > 0 ? (
        <ol className="flex flex-col divide-y divide-gray-200 rounded-[6px] border border-gray-200 bg-white">
          {ficha.formulas.map((formula) => (
            <li key={formula.id} className="flex flex-col gap-1 px-4 py-3 font-inter text-sm">
              <p className="font-semibold text-black">
                {formula.orden}. {formula.descripcion || 'Fórmula'}
              </p>
              {(formula.oxidanteVolumen || formula.tiempoPoseMin) && (
                <p className="text-capilar-grey">
                  {[
                    formula.oxidanteVolumen && `Oxidante ${formula.oxidanteVolumen} vol`,
                    formula.tiempoPoseMin && `Pose ${formula.tiempoPoseMin} min`,
                  ]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
              )}
              {formula.insumos.length > 0 && (
                <ul className="list-disc pl-5 text-black">
                  {formula.insumos.map((insumo) => (
                    <li key={insumo.id}>{formatInsumo(insumo)}</li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      ) : (
        <p className="font-inter text-sm text-capilar-grey">Sin fórmulas registradas.</p>
      )}
    </div>

    <Texto titulo="Indicaciones para la clienta" texto={ficha.indicacionesCliente} vacio="Sin indicaciones." />
    <Texto titulo="Observaciones internas" texto={ficha.observacionesInternas} vacio="Sin observaciones." />
  </div>
);

const MOMENTOS: { tipo: MomentoFoto; titulo: string }[] = [
  { tipo: 'ANTES', titulo: 'Antes' },
  { tipo: 'DESPUES', titulo: 'Después' },
];

interface FichaGaleriaProps {
  token: string;
  fichaId: number;
  fotos: FotoFicha[];
  // Si vienen, la galería se puede editar: sumar fotos (hasta 5 de cada una) y quitarlas
  onAdd?: (tipo: MomentoFoto, file: File) => void;
  onRemove?: (foto: FotoFicha) => void;
  // Subiendo o quitando una foto
  busy?: boolean;
}

// Fotos de antes y después; al tocar una se ve grande
export const FichaGaleria = ({ token, fichaId, fotos, onAdd, onRemove, busy = false }: FichaGaleriaProps) => {
  const [abierta, setAbierta] = useState<string | null>(null);

  const elegir = (tipo: MomentoFoto) => (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Se limpia para poder volver a elegir el mismo archivo
    event.target.value = '';
    if (file) onAdd?.(tipo, file);
  };

  if (!onAdd && fotos.length === 0) {
    return <p className="py-8 text-center font-inter text-sm text-capilar-grey">Esta ficha no tiene fotos.</p>;
  }

  return (
    <div className="grid gap-8 md:grid-cols-2">
      {MOMENTOS.map(({ tipo, titulo }) => {
        const delMomento = fotos.filter((foto) => foto.tipo === tipo);
        return (
          <div key={tipo} className="flex flex-col gap-3">
            <h4 className={labelClass}>
              {titulo}
              {onAdd && <span className="normal-case tracking-normal font-normal"> ({delMomento.length}/{FOTOS_POR_MOMENTO})</span>}
            </h4>
            <ul className="grid grid-cols-3 gap-3">
              {delMomento.map((foto, index) => (
                <li key={foto.id}>
                  <FichaFoto
                    token={token}
                    fichaId={fichaId}
                    fotoId={foto.id}
                    label={`foto de ${titulo.toLowerCase()} ${index + 1}`}
                    onOpen={setAbierta}
                    onRemove={onRemove && (() => onRemove(foto))}
                    disabled={busy}
                  />
                </li>
              ))}
              {onAdd && delMomento.length < FOTOS_POR_MOMENTO && (
                <li>
                  <label
                    className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-[6px] border-2 border-dashed border-gray-300 font-inter text-xs text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet ${
                      busy ? 'pointer-events-none opacity-60' : ''
                    }`}
                  >
                    <span aria-hidden="true" className="text-2xl leading-none">
                      +
                    </span>
                    Agregar
                    <input type="file" accept={FOTO_TIPOS.join(',')} onChange={elegir(tipo)} disabled={busy} className="sr-only" />
                  </label>
                </li>
              )}
            </ul>
            {!onAdd && delMomento.length === 0 && <p className="font-inter text-sm text-capilar-grey">Sin fotos.</p>}
          </div>
        );
      })}

      <Modal isOpen={abierta !== null} onClose={() => setAbierta(null)} ariaLabel="Foto de la ficha técnica" className="max-w-2xl">
        {abierta && <img src={abierta} alt="" className="mt-4 max-h-[70vh] w-full rounded-[6px] object-contain" />}
      </Modal>
    </div>
  );
};

interface FichaTecnicaProps {
  token: string;
  // Completa (salón) o la vista de la clienta (solo indicaciones y fotos)
  ficha: Ficha | FichaCliente;
  // Si arranca desplegada (por defecto cerrada: solo se ve fecha y servicio)
  defaultAbierta?: boolean;
  className?: string;
}

// Ficha desplegable para los historiales: fecha, servicio y profesional; adentro, los datos y las fotos en pestañas
export const FichaTecnica = ({ token, ficha, defaultAbierta = false, className = '' }: FichaTecnicaProps) => {
  const completa = 'formulas' in ficha;
  const pestanias = [
    { id: 'datos', label: completa ? 'Datos' : 'Cuidados' },
    { id: 'fotos', label: `Fotos (${ficha.fotos.length})` },
  ] as const;
  type PestaniaId = (typeof pestanias)[number]['id'];

  const [abierta, setAbierta] = useState(defaultAbierta);
  const [activa, setActiva] = useState<PestaniaId>('datos');
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  // Flechas izquierda/derecha para moverse entre pestañas (patrón WAI-ARIA)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const paso = event.key === 'ArrowRight' ? 1 : -1;
    const siguiente = (index + paso + pestanias.length) % pestanias.length;
    setActiva(pestanias[siguiente].id);
    tabsRef.current[siguiente]?.focus();
  };

  return (
    <section className={`relative overflow-hidden rounded-[6px] border border-gray-200 bg-gray-50 shadow-md ${className}`}>
      {/* Franja izquierda con el degradado de marca (vertical: violeta arriba, durazno abajo) */}
      <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-capilar-violet to-capilar-peach" />
      <h3>
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
          aria-controls={`${baseId}-contenido`}
          className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left transition-colors hover:bg-gray-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-capilar-violet md:px-8"
        >
          <span className="flex flex-col">
            <span className="font-inter text-lg font-semibold text-black">{ficha.servicio}</span>
            <span className="font-inter text-sm font-normal text-capilar-grey">
              {formatFechaFicha(ficha.fecha)} · con {ficha.profesional}
            </span>
          </span>
          <svg
            aria-hidden="true"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={`h-6 w-6 shrink-0 text-capilar-grey transition-transform duration-300 ${abierta ? 'rotate-180' : ''}`}
          >
            <path d="m6 9 6 6 6-6" />
          </svg>
        </button>
      </h3>

      {/* Truco de grid (0fr → 1fr) para animar la altura al desplegar */}
      <div
        id={`${baseId}-contenido`}
        className={`grid transition-[grid-template-rows] duration-300 ease-out ${abierta ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'}`}
      >
        <div className="overflow-hidden" inert={!abierta}>
          <div className="px-6 md:px-8">
            <div role="tablist" aria-label="Secciones de la ficha técnica" className="flex gap-6 border-b border-gray-200">
              {pestanias.map((pestania, index) => {
                const seleccionada = activa === pestania.id;
                return (
                  <button
                    key={pestania.id}
                    ref={(el) => {
                      tabsRef.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`${baseId}-tab-${pestania.id}`}
                    aria-selected={seleccionada}
                    aria-controls={`${baseId}-panel-${pestania.id}`}
                    tabIndex={seleccionada ? 0 : -1}
                    onClick={() => setActiva(pestania.id)}
                    onKeyDown={(event) => handleKeyDown(event, index)}
                    className={`relative pb-3 font-inter text-xs font-semibold uppercase tracking-widest transition-colors ${
                      seleccionada ? 'text-black' : 'text-capilar-grey hover:text-black'
                    }`}
                  >
                    {pestania.label}
                    {seleccionada && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-capilar-gradient" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div role="tabpanel" id={`${baseId}-panel-${activa}`} aria-labelledby={`${baseId}-tab-${activa}`} className="p-6 md:p-8">
            {activa === 'fotos' ? (
              // Las fotos se bajan recién al abrir la pestaña
              abierta && <FichaGaleria token={token} fichaId={ficha.id} fotos={ficha.fotos} />
            ) : completa ? (
              <FichaDatos ficha={ficha} />
            ) : (
              <Texto titulo="Indicaciones de tu profesional" texto={ficha.indicacionesCliente} vacio="Sin indicaciones para este servicio." />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};
