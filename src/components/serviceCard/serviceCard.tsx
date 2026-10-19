import { formatDuration, formatPrice } from '../../api/services';
import type { Servicio } from '../../api/services';
import { Button } from '../button/button';

interface ServiceCardProps {
  servicio: Servicio;
  // Botón Reservar (sin sesión, la home abre el login)
  onReserve?: (servicio: Servicio) => void;
}

// Card de un servicio del catálogo: cómo se confirma, duración mínima, nombre, descripción, precio desde y Reservar.
// En el carrusel todas las cards tienen el mismo alto: el precio y el botón quedan alineados abajo.
export const ServiceCard = ({ servicio, onReserve }: ServiceCardProps) => (
  <article className="flex h-full flex-col gap-3 rounded-[6px] border border-gray-200 bg-white p-6 text-left font-inter shadow-md">
    <div className="flex items-center justify-between gap-3">
      {/* Servicios exclusivos: el profesional evalúa antes de confirmar; el resto se confirma al reservar */}
      <span
        className={`rounded-full px-2.5 py-1 text-[10px] font-semibold whitespace-nowrap uppercase tracking-wider ${
          servicio.requiereEvaluacion ? 'bg-capilar-peach/25 text-orange-800' : 'bg-capilar-violet/10 text-capilar-violet'
        }`}
      >
        {servicio.requiereEvaluacion ? 'Necesita evaluación' : 'Confirmación inmediata'}
      </span>
      {/* Tiempo mínimo: según el cabello puede llevar más */}
      <span className="flex shrink-0 items-center gap-1 text-xs text-capilar-grey" title="Duración mínima del servicio">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          className="h-3.5 w-3.5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" />
        </svg>
        Mín. {formatDuration(servicio.tiempoDuracion)}
      </span>
    </div>

    {/* Nombre y descripción juntos, sin alto fijo: la descripción va pegada al nombre */}
    <div className="flex flex-col gap-1">
      <h3 className="line-clamp-2 text-lg leading-snug font-semibold text-black" title={servicio.tipo}>
        {servicio.tipo}
      </h3>
      {servicio.descripcion && (
        <p className="line-clamp-3 text-[13px] leading-snug text-capilar-grey" title={servicio.descripcion}>
          {servicio.descripcion}
        </p>
      )}
    </div>

    {/* mt-auto: el precio queda abajo y a la misma altura en todas las cards; el espacio que sobra va arriba de él */}
    <div className="mt-auto flex items-end justify-between gap-3 pt-4">
      {/* Precio base: el final depende del largo y del estado del cabello */}
      <div className="flex flex-col">
        <span className="text-xs text-capilar-grey">Desde</span>
        <span className="text-2xl font-bold text-black">{formatPrice(servicio.precio)}</span>
      </div>
      {onReserve && (
        <Button
          onClick={() => onReserve(servicio)}
          aria-label={`Reservar ${servicio.tipo}`}
          className="shrink-0 px-5! py-2 text-xs text-white! font-semibold! uppercase tracking-wider"
        >
          Reservar
        </Button>
      )}
    </div>
  </article>
);
