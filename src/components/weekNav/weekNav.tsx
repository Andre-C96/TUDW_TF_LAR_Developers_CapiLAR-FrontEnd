import type { ReactNode } from 'react';
import { addDays, addMonths, formatWeek, startOfMonth, startOfWeek, toIsoDate } from '../../api/turnos';

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

interface PeriodNavProps {
  label: ReactNode;
  // Si se está viendo el período actual (el centro queda deshabilitado)
  esActual: boolean;
  onPrev: () => void;
  onNext: () => void;
  onActual: () => void;
  prevLabel: string;
  nextLabel: string;
  actualLabel: string;
  className?: string;
}

// Un solo recuadro: flechas a los costados y, en el medio, el período (al tocarlo vuelve al actual)
const PeriodNav = ({ label, esActual, onPrev, onNext, onActual, prevLabel, nextLabel, actualLabel, className = '' }: PeriodNavProps) => (
  <div className={`flex shrink-0 items-stretch overflow-hidden rounded-[6px] border border-gray-300 bg-white ${className}`}>
    <button type="button" onClick={onPrev} aria-label={prevLabel} className={`${flechaClass} border-r border-gray-300`}>
      <Chevron className="rotate-180" />
    </button>
    <button
      type="button"
      onClick={onActual}
      disabled={esActual}
      title={esActual ? undefined : actualLabel}
      className="px-4 py-2 font-inter text-sm font-semibold whitespace-nowrap text-black transition-colors enabled:hover:bg-gray-50"
    >
      {label}
    </button>
    <button type="button" onClick={onNext} aria-label={nextLabel} className={`${flechaClass} border-l border-gray-300`}>
      <Chevron />
    </button>
  </div>
);

interface WeekNavProps {
  // Lunes de la semana que se ve
  monday: Date;
  onChange: (monday: Date) => void;
  className?: string;
}

// Paso de semanas
export const WeekNav = ({ monday, onChange, className }: WeekNavProps) => {
  const esEstaSemana = toIsoDate(monday) === toIsoDate(startOfWeek(new Date()));

  return (
    <PeriodNav
      label={formatWeek(monday)}
      esActual={esEstaSemana}
      onPrev={() => onChange(addDays(monday, -7))}
      onNext={() => onChange(addDays(monday, 7))}
      onActual={() => onChange(startOfWeek(new Date()))}
      prevLabel="Semana anterior"
      nextLabel="Semana siguiente"
      actualLabel="Volver a esta semana"
      className={className}
    />
  );
};

// "octubre 2026"
const formatMonth = (first: Date) => `${first.toLocaleDateString('es-AR', { month: 'long' })} ${first.getFullYear()}`;

interface MonthNavProps {
  // Primer día del mes que se ve
  month: Date;
  onChange: (month: Date) => void;
  className?: string;
}

// Paso de meses, igual que el de semanas
export const MonthNav = ({ month, onChange, className }: MonthNavProps) => {
  const esEsteMes = toIsoDate(month) === toIsoDate(startOfMonth(new Date()));

  return (
    <PeriodNav
      label={<span className="capitalize">{formatMonth(month)}</span>}
      esActual={esEsteMes}
      onPrev={() => onChange(addMonths(month, -1))}
      onNext={() => onChange(addMonths(month, 1))}
      onActual={() => onChange(startOfMonth(new Date()))}
      prevLabel="Mes anterior"
      nextLabel="Mes siguiente"
      actualLabel="Volver a este mes"
      className={className}
    />
  );
};
