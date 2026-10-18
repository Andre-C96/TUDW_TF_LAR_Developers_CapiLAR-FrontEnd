import { useState } from 'react';
import type { FormEvent } from 'react';
import { SERVICIO_DURACION_MAX, SERVICIO_DURACION_MIN, SERVICIO_TIPO_MAX } from '../../api/services';
import type { Servicio, ServicioData } from '../../api/services';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

interface ServiceFormProps {
  // Servicio a editar; sin él, el formulario es de alta
  servicio?: Servicio;
  // Recibe los datos ya validados; quien lo usa llama a la API
  onSubmit: (data: ServicioData) => void;
  onCancel: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

interface FieldErrors {
  tipo?: string;
  tiempoDuracion?: string;
  precio?: string;
}

// Hasta 2 decimales, con punto o coma
const PRICE_REGEX = /^\d+([.,]\d{1,2})?$/;
// La columna del back es Decimal(10, 2)
const PRICE_MAX = 99_999_999.99;

// Alta y edición de un servicio (ADMIN): nombre, duración en minutos, precio y si requiere aprobación del profesional
export const ServiceForm = ({ servicio, onSubmit, onCancel, isLoading = false, error }: ServiceFormProps) => {
  const [tipo, setTipo] = useState(servicio?.tipo ?? '');
  const [tiempoDuracion, setTiempoDuracion] = useState(servicio ? String(servicio.tiempoDuracion) : '');
  // "15000.00" se muestra como "15000"
  const [precio, setPrecio] = useState(servicio ? String(Number(servicio.precio)) : '');
  const [requiereEvaluacion, setRequiereEvaluacion] = useState(servicio?.requiereEvaluacion ?? false);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const duracion = Number(tiempoDuracion);
    const precioNumber = Number(precio.trim().replace(',', '.'));

    const errors: FieldErrors = {};
    if (!tipo.trim()) errors.tipo = 'Ingresá el nombre del servicio';
    else if (tipo.trim().length > SERVICIO_TIPO_MAX) errors.tipo = `Hasta ${SERVICIO_TIPO_MAX} caracteres`;

    if (!tiempoDuracion.trim()) errors.tiempoDuracion = 'Ingresá la duración';
    else if (!Number.isInteger(duracion)) errors.tiempoDuracion = 'Ingresá un número entero de minutos';
    else if (duracion < SERVICIO_DURACION_MIN || duracion > SERVICIO_DURACION_MAX) {
      errors.tiempoDuracion = 'Entre 15 minutos y 7 horas (420 minutos)';
    }

    if (!precio.trim()) errors.precio = 'Ingresá el precio';
    else if (!PRICE_REGEX.test(precio.trim())) errors.precio = 'Ingresá un número, con hasta 2 decimales';
    else if (precioNumber > PRICE_MAX) errors.precio = 'El precio es demasiado alto';
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    onSubmit({ tipo: tipo.trim(), tiempoDuracion: duracion, precio: precioNumber, requiereEvaluacion });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{servicio ? 'Editar servicio' : 'Nuevo servicio'}</Title>
        <p className="font-inter text-sm text-capilar-grey">
          {servicio
            ? 'Los turnos ya reservados conservan el precio con el que se reservaron.'
            : 'Va a quedar disponible para reservar.'}
        </p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Nombre"
          value={tipo}
          onChange={(event) => setTipo(event.target.value)}
          maxLength={SERVICIO_TIPO_MAX}
          placeholder="Ej.: Corte"
          error={fieldErrors.tipo}
        />
        <div className="grid gap-5 sm:grid-cols-2">
          <FormField
            label="Duración (minutos)"
            type="number"
            inputMode="numeric"
            min={SERVICIO_DURACION_MIN}
            max={SERVICIO_DURACION_MAX}
            step={5}
            value={tiempoDuracion}
            onChange={(event) => setTiempoDuracion(event.target.value)}
            placeholder="Ej.: 45"
            hint="Entre 15 y 420"
            error={fieldErrors.tiempoDuracion}
          />
          <FormField
            label="Precio desde ($)"
            inputMode="decimal"
            value={precio}
            onChange={(event) => setPrecio(event.target.value)}
            placeholder="Ej.: 15000"
            error={fieldErrors.precio}
          />
        </div>

        {/* Servicios exclusivos: el profesional evalúa antes de confirmar. Los básicos se confirman solos */}
        <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-gray-200 px-4 py-3 transition-colors hover:bg-capilar-violet/5">
          <input
            type="checkbox"
            checked={requiereEvaluacion}
            onChange={(event) => setRequiereEvaluacion(event.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer accent-capilar-violet"
          />
          <span className="flex flex-col gap-1 font-inter">
            <span className="text-sm font-semibold text-black">Requiere aprobación del profesional</span>
            <span className="text-xs text-capilar-grey">
              Para servicios exclusivos (ej.: decoloración global, alisado, corrección de color): el turno queda por
              confirmar hasta que el profesional lo acepta. Si no, se confirma al reservar.
            </span>
          </span>
        </label>

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : servicio ? 'Guardar' : 'Crear'}
          </Button>
        </div>
      </Form>
    </div>
  );
};
