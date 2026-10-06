import { DayPicker } from 'react-day-picker';
import type { Matcher } from 'react-day-picker';
import { es } from 'react-day-picker/locale';
import 'react-day-picker/style.css';
import { fromIsoDate, toIsoDate } from '../../api/turnos';

interface BaseProps {
  // Primer y último día que se pueden elegir
  min?: Date;
  max?: Date;
  // Si se pasa, solo se pueden elegir estas fechas ("YYYY-MM-DD"), ej. los días con horario cargado
  enabledDates?: string[];
  className?: string;
}

const disabledDays = ({ min, max, enabledDates }: BaseProps) => {
  const disabled: Matcher[] = [];
  if (min) disabled.push({ before: min });
  if (max) disabled.push({ after: max });
  if (enabledDates) {
    const enabled = new Set(enabledDates);
    disabled.push((date: Date) => !enabled.has(toIsoDate(date)));
  }
  return disabled;
};

interface DatePickerProps extends BaseProps {
  // "YYYY-MM-DD" elegido ("" si todavía no hay)
  value: string;
  onChange: (fecha: string) => void;
}

// Calendario mensual en español (semana de lunes a domingo) con los colores de marca (ver .rdp-root en index.css)
export const DatePicker = ({ value, onChange, className = '', ...rest }: DatePickerProps) => (
  <DayPicker
    mode="single"
    locale={es}
    selected={value ? fromIsoDate(value) : undefined}
    // Tocar el día ya elegido no lo deselecciona
    onSelect={(date) => date && onChange(toIsoDate(date))}
    disabled={disabledDays(rest)}
    startMonth={rest.min}
    endMonth={rest.max}
    defaultMonth={value ? fromIsoDate(value) : rest.min}
    className={className}
  />
);

interface MultiDatePickerProps extends BaseProps {
  // Fechas elegidas ("YYYY-MM-DD")
  value: string[];
  onChange: (fechas: string[]) => void;
  // Máximo de fechas que se pueden marcar
  maxSelected?: number;
}

// Mismo calendario, para marcar varias fechas (tocar una fecha marcada la desmarca)
export const MultiDatePicker = ({ value, onChange, maxSelected, className = '', ...rest }: MultiDatePickerProps) => (
  <DayPicker
    mode="multiple"
    locale={es}
    selected={value.map(fromIsoDate)}
    onSelect={(dates) => onChange((dates ?? []).map(toIsoDate).sort())}
    max={maxSelected}
    disabled={disabledDays(rest)}
    startMonth={rest.min}
    endMonth={rest.max}
    defaultMonth={rest.min}
    className={className}
  />
);
