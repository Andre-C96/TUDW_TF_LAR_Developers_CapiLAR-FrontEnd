import { useEffect } from 'react';
import { getFichaPhotoRequest } from '../../api/fichas';
import type { FotoFicha } from '../../api/fichas';
import { useBlobUrl } from '../../customHooks/blobUrl/useBlobUrl';
import { Modal } from '../modal/modal';

interface FichaFotoProps {
  token: string;
  fichaId: number;
  fotoId: number;
  // Texto para lectores de pantalla (ej. "Foto de antes 1")
  label: string;
  // Al tocarla (ya bajada): para mostrarla grande
  onOpen: () => void;
  // Si viene, suma la cruz para quitarla
  onRemove?: () => void;
  disabled?: boolean;
}

// Miniatura cuadrada de una foto de la ficha. La imagen pide token: se baja y se muestra con una URL local
export const FichaFoto = ({ token, fichaId, fotoId, label, onOpen, onRemove, disabled = false }: FichaFotoProps) => {
  const { url, failed } = useBlobUrl(`ficha-${fichaId}-foto-${fotoId}`, () => getFichaPhotoRequest(token, fichaId, fotoId));

  return (
    <div className="relative aspect-square">
      <button
        type="button"
        onClick={() => url && onOpen()}
        disabled={!url}
        aria-label={`Ver ${label}`}
        className="block h-full w-full overflow-hidden rounded-[6px] border border-gray-200 bg-gray-100 focus:outline-none focus:ring-2 focus:ring-capilar-violet"
      >
        {url ? (
          <img src={url} alt="" className="h-full w-full object-cover transition-transform hover:scale-105" />
        ) : (
          <span className="flex h-full items-center justify-center font-inter text-xs text-capilar-grey">
            {failed ? 'No se pudo cargar' : <span className="h-full w-full animate-pulse bg-gray-200" />}
          </span>
        )}
      </button>
      {onRemove && (
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Quitar ${label}`}
          title="Quitar foto"
          className="absolute -top-2 -right-2 flex h-6 w-6 items-center justify-center rounded-full border border-gray-200 bg-white text-xs text-capilar-grey shadow-md transition-colors hover:border-red-500 hover:text-red-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          ✕
        </button>
      )}
    </div>
  );
};

interface FichaFotoVisorProps {
  token: string;
  fichaId: number;
  // Todas las fotos en el orden en que se recorren (antes y después)
  fotos: FotoFicha[];
  // La que se ve; null: cerrado
  index: number | null;
  onChange: (index: number | null) => void;
}

const MOMENTO_LABEL = { ANTES: 'Antes', DESPUES: 'Después' } as const;

const flechaClass =
  'absolute top-1/2 flex h-12 w-10 -translate-y-1/2 items-center justify-center rounded-[6px] border border-gray-200 bg-white/90 text-capilar-grey shadow-md transition-colors hover:text-capilar-violet active:bg-capilar-violet active:text-white disabled:pointer-events-none disabled:opacity-0';

// Foto grande con anterior/siguiente entre todas las fotos de la ficha (también con las flechas del teclado)
export const FichaFotoVisor = ({ token, fichaId, fotos, index, onChange }: FichaFotoVisorProps) => {
  const foto = index !== null ? fotos[index] : undefined;
  const { url, failed } = useBlobUrl(foto ? `ficha-${fichaId}-foto-${foto.id}` : null, () =>
    getFichaPhotoRequest(token, fichaId, foto!.id),
  );
  const hayAnterior = index !== null && index > 0;
  const haySiguiente = index !== null && index < fotos.length - 1;
  // Número de la foto dentro de su momento ("Antes 2 de 3")
  const delMomento = foto ? fotos.filter((f) => f.tipo === foto.tipo) : [];

  useEffect(() => {
    if (index === null) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && index > 0) onChange(index - 1);
      if (event.key === 'ArrowRight' && index < fotos.length - 1) onChange(index + 1);
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [index, fotos.length, onChange]);

  return (
    <Modal isOpen={foto !== undefined} onClose={() => onChange(null)} ariaLabel="Foto de la ficha técnica" className="max-w-2xl">
      {foto && index !== null && (
        <div className="flex flex-col gap-4">
          <p className="pr-8 font-inter text-sm">
            <span className="font-semibold text-black">{MOMENTO_LABEL[foto.tipo]}</span>
            <span className="text-capilar-grey">
              {' '}
              · {delMomento.indexOf(foto) + 1} de {delMomento.length}
            </span>
          </p>

          <div className="relative flex min-h-64 items-center justify-center rounded-[6px] bg-gray-50">
            {url ? (
              <img src={url} alt="" className="max-h-[65vh] w-full rounded-[6px] object-contain" />
            ) : failed ? (
              <span className="font-inter text-sm text-capilar-grey">No se pudo cargar la foto.</span>
            ) : (
              <span className="h-64 w-full animate-pulse rounded-[6px] bg-gray-200" />
            )}
            <button type="button" onClick={() => onChange(index - 1)} disabled={!hayAnterior} aria-label="Foto anterior" className={`${flechaClass} left-2`}>
              <Chevron className="rotate-180" />
            </button>
            <button type="button" onClick={() => onChange(index + 1)} disabled={!haySiguiente} aria-label="Foto siguiente" className={`${flechaClass} right-2`}>
              <Chevron />
            </button>
          </div>

          {/* Puntos: uno por foto, con un corte entre antes y después */}
          <div className="flex items-center justify-center gap-1.5" aria-hidden="true">
            {fotos.map((f, i) => (
              <span
                key={f.id}
                className={`h-2 rounded-full transition-all ${i === index ? 'w-5 bg-capilar-violet' : 'w-2 bg-gray-300'} ${
                  i > 0 && fotos[i - 1].tipo !== f.tipo ? 'ml-3' : ''
                }`}
              />
            ))}
          </div>
        </div>
      )}
    </Modal>
  );
};

const Chevron = ({ className = '' }: { className?: string }) => (
  <svg
    aria-hidden="true"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={`h-5 w-5 ${className}`}
  >
    <path d="m9 6 6 6-6 6" />
  </svg>
);
