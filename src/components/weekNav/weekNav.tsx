import { addDays, formatWeek, startOfWeek, toIsoDate } from '../../api/turnos';

interface WeekNavProps {
  // Lunes de la semana que se ve
  monday: Date;
  onChange: (monday: Date) => void;
  className?: string;
}

const flechaClass =
  'flex w-9 items-center justify-center text-capilar-grey transition-colors hover:text-capilar-violet active:bg-capilar-violet active:text-white';

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

// Paso de semanas en un solo recuadro: flechas a los costados y, en el medio, la semana (al tocarla vuelve a esta)
export const WeekNav = ({ monday, onChange, className = '' }: WeekNavProps) => {
  const esEstaSemana = toIsoDate(monday) === toIsoDate(startOfWeek(new Date()));

  return (
    <div className={`flex shrink-0 items-stretch overflow-hidden rounded-[6px] border border-gray-300 bg-white ${className}`}>
      <button type="button" onClick={() => onChange(addDays(monday, -7))} aria-label="Semana anterior" className={`${flechaClass} border-r border-gray-300`}>
        <Chevron className="rotate-180" />
      </button>
      <button
        type="button"
        onClick={() => onChange(startOfWeek(new Date()))}
        disabled={esEstaSemana}
        title={esEstaSemana ? undefined : 'Volver a esta semana'}
        className="px-4 py-2 font-inter text-sm font-semibold whitespace-nowrap text-black transition-colors enabled:hover:bg-gray-50"
      >
        {esEstaSemana && <span className="text-capilar-violet">Esta semana · </span>}
        {formatWeek(monday)}
      </button>
      <button type="button" onClick={() => onChange(addDays(monday, 7))} aria-label="Semana siguiente" className={`${flechaClass} border-l border-gray-300`}>
        <Chevron />
      </button>
    </div>
  );
};
