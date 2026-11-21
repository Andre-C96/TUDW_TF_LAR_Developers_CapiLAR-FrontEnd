import { useState } from 'react';
import type { ReactNode } from 'react';
import type { DateRange } from '../../components/datePicker/datePicker';
import { FilterSelect, RangoField } from '../agenda/agendaFiltros';

// Lo que usan los filtros de una ficha (sirve para la del salón y la que ve la clienta)
interface FichaFiltrable {
  fecha: string;
  servicio: string;
  profesional: string;
}

interface HistorialFiltradoProps<T extends FichaFiltrable> {
  // Todas las fichas del historial, de la más nueva a la más vieja
  fichas: T[];
  // Suma el filtro por profesional (en el historial que ve el salón; la clienta no lo necesita)
  conProfesional?: boolean;
  // Dibuja las fichas que quedan después de filtrar
  children: (filtradas: T[]) => ReactNode;
}

const TODOS = '';
const OPCIONES_FECHA: ['todas' | 'rango', string][] = [
  ['todas', 'Todas'],
  ['rango', 'Elegir rango'],
];

// Opciones de un desplegable con los valores que aparecen en el historial (no todo el catálogo), por nombre
const opciones = (valores: string[]): [string, string][] => [
  [TODOS, 'Todos'],
  ...[...new Set(valores)].sort((a, b) => a.localeCompare(b, 'es')).map((v): [string, string] => [v, v]),
];

// Historial de fichas técnicas con filtros por servicio, fecha (rango) y, opcional, profesional. Se filtra en el
// navegador: el historial ya llega completo (Mi historial de la clienta y el perfil del cliente para el salón)
export const HistorialFiltrado = <T extends FichaFiltrable>({ fichas, conProfesional = false, children }: HistorialFiltradoProps<T>) => {
  const [servicio, setServicio] = useState(TODOS);
  const [profesional, setProfesional] = useState(TODOS);
  const [fecha, setFecha] = useState<'todas' | 'rango'>('todas');
  const [rango, setRango] = useState<DateRange>({ desde: '', hasta: '' });

  // El rango cuenta recién con las dos fechas elegidas ("YYYY-MM-DD" se compara como texto)
  const conRango = fecha === 'rango' && rango.hasta !== '';
  const filtradas = fichas.filter(
    (f) =>
      (servicio === TODOS || f.servicio === servicio) &&
      (profesional === TODOS || f.profesional === profesional) &&
      (!conRango || (f.fecha >= rango.desde && f.fecha <= rango.hasta)),
  );

  const conFiltros = servicio !== TODOS || profesional !== TODOS || fecha !== 'todas';
  const limpiarFiltros = () => {
    setServicio(TODOS);
    setProfesional(TODOS);
    setFecha('todas');
    setRango({ desde: '', hasta: '' });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 rounded-[6px] border border-gray-200 bg-white px-4 py-3 shadow-sm">
          <FilterSelect label="Servicio" value={servicio} options={opciones(fichas.map((f) => f.servicio))} onChange={setServicio} compact />
          {conProfesional && (
            <FilterSelect
              label="Profesional"
              value={profesional}
              options={opciones(fichas.map((f) => f.profesional))}
              onChange={setProfesional}
              compact
            />
          )}
          <FilterSelect label="Fecha" value={fecha} options={OPCIONES_FECHA} onChange={setFecha} />
          {fecha === 'rango' && <RangoField value={rango} onChange={setRango} />}
          {conFiltros && (
            <button
              type="button"
              onClick={limpiarFiltros}
              className="group ml-auto flex shrink-0 items-center gap-1.5 font-inter text-sm font-semibold text-capilar-violet-text transition-transform hover:scale-105"
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
        {/* Se anuncia al cambiar, para quien usa lector de pantalla */}
        <p aria-live="polite" className="font-inter text-xs text-capilar-grey">
          {conFiltros && `Mostrando ${filtradas.length} de ${fichas.length} ${fichas.length === 1 ? 'ficha' : 'fichas'}`}
        </p>
      </div>

      {filtradas.length === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">No hay fichas con estos filtros.</p>
      ) : (
        children(filtradas)
      )}
    </div>
  );
};
