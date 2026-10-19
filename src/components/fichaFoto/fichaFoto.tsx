import { getFichaPhotoRequest } from '../../api/fichas';
import { useBlobUrl } from '../../customHooks/blobUrl/useBlobUrl';

interface FichaFotoProps {
  token: string;
  fichaId: number;
  fotoId: number;
  // Texto para lectores de pantalla (ej. "Foto de antes 1")
  label: string;
  // Al tocarla: recibe la URL ya bajada para mostrarla grande
  onOpen: (url: string) => void;
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
        onClick={() => url && onOpen(url)}
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
