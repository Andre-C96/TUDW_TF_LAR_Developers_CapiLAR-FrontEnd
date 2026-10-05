import { useId, useRef, useState } from 'react';
import type { KeyboardEvent, ReactNode } from 'react';
import { Modal } from '../modal/modal';

// Tipos según el DER. `url` todavía no existe en RegistroFotografico (pedido a backend)
export interface Formula {
  id: number;
  formula: string;
  volumenes: string;
  tiemposPose: string;
}

export interface Foto {
  id: number;
  url: string;
  tipoImagen: 'antes' | 'despues';
  descripcion?: string;
}

export interface FichaTecnicaData {
  id: number;
  fecha: string;
  servicio?: string;
  porosidad: string;
  elasticidad: string;
  porcentajeCanas: number;
  tipoDePelo: string;
  volumenDePelo: string;
  recomendaciones?: string;
  formulas?: Formula[];
}

interface FichaTecnicaProps {
  ficha: FichaTecnicaData;
  fotos?: Foto[];
  // Si arranca desplegada (por defecto cerrada: solo se ve título y fecha)
  defaultAbierta?: boolean;
  className?: string;
}

const PESTANIAS = [
  { id: 'datos', label: 'Datos' },
  { id: 'fotos', label: 'Registro fotográfico' },
] as const;

type PestaniaId = (typeof PESTANIAS)[number]['id'];

const labelClass = 'font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey';

const Dato = ({ label, children }: { label: string; children: ReactNode }) => (
  <div className="flex flex-col gap-1">
    <dt className={labelClass}>{label}</dt>
    <dd className="font-inter text-sm text-black">{children}</dd>
  </div>
);

export const FichaTecnica = ({ ficha, fotos = [], defaultAbierta = false, className = '' }: FichaTecnicaProps) => {
  const [abierta, setAbierta] = useState(defaultAbierta);
  const [activa, setActiva] = useState<PestaniaId>('datos');
  const [fotoAbierta, setFotoAbierta] = useState<Foto | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);
  const baseId = useId();

  // Flechas izquierda/derecha para moverse entre pestañas (patrón WAI-ARIA)
  const handleKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') return;
    const paso = event.key === 'ArrowRight' ? 1 : -1;
    const siguiente = (index + paso + PESTANIAS.length) % PESTANIAS.length;
    setActiva(PESTANIAS[siguiente].id);
    tabsRef.current[siguiente]?.focus();
  };

  const grupos = [
    { titulo: 'Antes', fotos: fotos.filter((foto) => foto.tipoImagen === 'antes') },
    { titulo: 'Después', fotos: fotos.filter((foto) => foto.tipoImagen === 'despues') },
  ];

  return (
    <section
      className={`relative bg-gray-50 border border-gray-200 rounded-[6px] shadow-md overflow-hidden ${className}`}
    >
      {/* Franja izquierda con el degradado de marca (vertical: violeta arriba, durazno abajo) */}
      <span
        aria-hidden="true"
        className="absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-capilar-violet to-capilar-peach"
      />
      <h3>
        <button
          type="button"
          onClick={() => setAbierta(!abierta)}
          aria-expanded={abierta}
          aria-controls={`${baseId}-contenido`}
          className="flex w-full items-center justify-between gap-4 px-6 py-6 md:px-8 text-left hover:bg-gray-100 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-capilar-violet"
        >
          <span className="flex flex-col">
            <span className="font-inter font-semibold text-lg md:text-xl text-black">Ficha técnica</span>
            <span className="font-inter text-sm font-normal text-capilar-grey">
              {ficha.fecha}
              {ficha.servicio && ` · ${ficha.servicio}`}
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
            className={`w-6 h-6 shrink-0 text-capilar-grey transition-transform duration-300 ${abierta ? 'rotate-180' : ''}`}
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
              {PESTANIAS.map((pestania, index) => {
                const seleccionada = activa === pestania.id;
                return (
                  <button
                    key={pestania.id}
                    ref={(el) => { tabsRef.current[index] = el; }}
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
                    {seleccionada && (
                      <span className="absolute inset-x-0 -bottom-px h-0.5 bg-capilar-gradient" />
                    )}
                  </button>
                );
              })}
            </div>
          </div>
    
          <div
            role="tabpanel"
            id={`${baseId}-panel-${activa}`}
            aria-labelledby={`${baseId}-tab-${activa}`}
            className="p-6 md:p-8"
          >
            {activa === 'datos' ? (
              <div className="flex flex-col gap-8">
                <dl className="grid grid-cols-2 md:grid-cols-3 gap-x-6 gap-y-5">
                  <Dato label="Porosidad">{ficha.porosidad}</Dato>
                  <Dato label="Elasticidad">{ficha.elasticidad}</Dato>
                  <Dato label="% de canas">{ficha.porcentajeCanas} %</Dato>
                  <Dato label="Tipo de pelo">{ficha.tipoDePelo}</Dato>
                  <Dato label="Volumen">{ficha.volumenDePelo}</Dato>
                </dl>
    
                <div className="flex flex-col gap-3">
                  <h4 className={labelClass}>Fórmulas</h4>
                  {ficha.formulas && ficha.formulas.length > 0 ? (
                    <ul className="flex flex-col divide-y divide-gray-200 bg-white border border-gray-200 rounded-[6px]">
                      {ficha.formulas.map((formula) => (
                        <li key={formula.id} className="px-4 py-3 font-inter text-sm">
                          <p className="font-semibold text-black">{formula.formula}</p>
                          <p className="text-capilar-grey">
                            {formula.volumenes} · Pose: {formula.tiemposPose}
                          </p>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="font-inter text-sm text-capilar-grey">Sin fórmulas registradas.</p>
                  )}
                </div>
    
                <div className="flex flex-col gap-3">
                  <h4 className={labelClass}>Recomendaciones</h4>
                  <p className="font-inter text-sm text-black whitespace-pre-line">
                    {ficha.recomendaciones || 'Sin recomendaciones.'}
                  </p>
                </div>
              </div>
            ) : fotos.length === 0 ? (
              <p className="font-inter text-sm text-capilar-grey text-center py-8">
                Todavía no hay fotos en esta ficha.
              </p>
            ) : (
              <div className="grid md:grid-cols-2 gap-8">
                {grupos.map((grupo) => (
                  <div key={grupo.titulo} className="flex flex-col gap-3">
                    <h4 className={labelClass}>{grupo.titulo}</h4>
                    {grupo.fotos.length > 0 ? (
                      <ul className="grid grid-cols-2 gap-3">
                        {grupo.fotos.map((foto) => (
                          <li key={foto.id}>
                            <button
                              type="button"
                              onClick={() => setFotoAbierta(foto)}
                              aria-label={`Ver foto: ${foto.descripcion ?? grupo.titulo}`}
                              className="block w-full aspect-square overflow-hidden rounded-[6px] border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-capilar-violet"
                            >
                              <img
                                src={foto.url}
                                alt={foto.descripcion ?? ''}
                                loading="lazy"
                                className="w-full h-full object-cover transition-transform hover:scale-105"
                              />
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="font-inter text-sm text-capilar-grey">Sin fotos.</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <Modal
        isOpen={fotoAbierta !== null}
        onClose={() => setFotoAbierta(null)}
        ariaLabel="Foto de la ficha técnica"
        className="max-w-2xl"
      >
        {fotoAbierta && (
          <figure className="flex flex-col gap-3 mt-4">
            <img
              src={fotoAbierta.url}
              alt={fotoAbierta.descripcion ?? ''}
              className="w-full max-h-[70vh] object-contain rounded-[6px]"
            />
            {fotoAbierta.descripcion && (
              <figcaption className="font-inter text-sm text-capilar-grey text-center">
                {fotoAbierta.descripcion}
              </figcaption>
            )}
          </figure>
        )}
      </Modal>
    </section>
  );
};
