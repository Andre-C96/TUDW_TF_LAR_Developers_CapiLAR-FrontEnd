import type { SugerenciaIA } from '../../api/fichas';
import { Alert } from '../alert/alert';

interface SugerenciaIACardProps {
  sugerencia: SugerenciaIA;
  // Cuántas fórmulas sugeridas quedaron en el formulario (0 si no había o si se mantuvieron las cargadas)
  formulasPrecargadas: number;
  // Sin él no se ofrece descartar (por ejemplo, después de guardar)
  onDescartar?: () => void;
  onCopiar: () => void;
}

const labelClass = 'font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey';
const linkClass = 'font-inter text-xs font-semibold uppercase tracking-widest hover:underline';

// F14/F15: lo que devolvió la IA en la ficha técnica. Las alertas van primero y destacadas (F15: advertencia antes
// de trabajar); el diagnóstico y las fórmulas ya quedaron precargados en el formulario, sin guardar. Igual que en mobile
export const SugerenciaIACard = ({ sugerencia, formulasPrecargadas, onDescartar, onCopiar }: SugerenciaIACardProps) => {
  const { alertas, evolucion, recomendacion } = sugerencia.analisis;

  return (
    <div className="flex flex-col gap-4 rounded-[6px] border border-capilar-violet bg-white p-4 font-inter text-sm">
      <div className="flex items-center gap-2">
        <p className="flex-1 font-semibold text-capilar-violet-text">Sugerencia de IA</p>
        {sugerencia.simulado && (
          <span className="rounded-full border border-amber-500 px-2 py-0.5 text-xs font-semibold text-amber-800">Modo prueba</span>
        )}
      </div>

      {alertas.length > 0 ? (
        <Alert variant="advertencia" title="Antes de trabajar, tené en cuenta">
          <ul className="flex list-disc flex-col gap-1 pl-4">
            {alertas.map((alerta, index) => (
              <li key={index}>{alerta}</li>
            ))}
          </ul>
        </Alert>
      ) : (
        <p className="text-green-700">✓ Sin alertas para esta clienta.</p>
      )}

      {evolucion && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Evolución del cabello</span>
          <p className="text-black">{evolucion}</p>
        </div>
      )}
      {recomendacion && (
        <div className="flex flex-col gap-1">
          <span className={labelClass}>Recomendación para hoy</span>
          <p className="text-black">{recomendacion}</p>
        </div>
      )}

      <p className="text-capilar-grey">
        {formulasPrecargadas > 0
          ? `Precargamos el diagnóstico y ${formulasPrecargadas === 1 ? 'la fórmula sugerida' : `${formulasPrecargadas} fórmulas sugeridas`} en la ficha.`
          : 'Precargamos el diagnóstico sugerido en la ficha.'}{' '}
        Revisalo: no se guarda nada hasta que toques Guardar.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" onClick={onCopiar} className={`${linkClass} text-capilar-violet-text`}>
          Copiar el análisis a las observaciones
        </button>
        {onDescartar && (
          <button type="button" onClick={onDescartar} className={`${linkClass} text-capilar-grey hover:text-red-500`}>
            Descartar sugerencia
          </button>
        )}
      </div>
    </div>
  );
};
