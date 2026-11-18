import { useState } from 'react';
import type { FormEvent } from 'react';
import {
  MOVIMIENTO_COMPROBANTE_MAX,
  MOVIMIENTO_MOTIVO_MAX,
  STOCK_MAX,
  TRES_DECIMALES,
  formatEnvases,
  limitarDecimal,
  parseDecimal,
} from '../../api/articulos';
import type { Articulo, MovimientoData, TipoMovimientoManual } from '../../api/articulos';
import { Button } from '../../components/button/button';
import { Form, FormField } from '../../components/form/form';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';

const TIPOS: { tipo: TipoMovimientoManual; label: string; ayuda: string; cantidad: string }[] = [
  { tipo: 'INGRESO', label: 'Ingreso', ayuda: 'Entraron envases al salón.', cantidad: 'Cuántos envases entran' },
  { tipo: 'EGRESO', label: 'Egreso', ayuda: 'Salieron envases: se rompió, venció, se vendió...', cantidad: 'Cuántos envases salen' },
  { tipo: 'AJUSTE', label: 'Ajuste', ayuda: 'Contaste el stock y no coincide con el sistema.', cantidad: 'Cuántos envases contaste' },
];

interface MovimientoModalProps {
  articulo: Articulo;
  // Recibe los datos ya validados; quien lo usa llama a la API
  onSubmit: (data: MovimientoData) => void;
  onClose: () => void;
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
}

// Registrar un movimiento manual de stock. Muestra cómo va a quedar antes de guardar:
// un egreso puede dejarlo en negativo (se permite, y se avisa)
export const MovimientoModal = ({ articulo, onSubmit, onClose, isLoading = false, error }: MovimientoModalProps) => {
  const [tipo, setTipo] = useState<TipoMovimientoManual>('INGRESO');
  const [cantidad, setCantidad] = useState('');
  const [motivo, setMotivo] = useState('');
  const [numComprobante, setNumComprobante] = useState('');
  const [errors, setErrors] = useState<{ cantidad?: string; motivo?: string }>({});

  const elegido = TIPOS.find((t) => t.tipo === tipo)!;
  const motivoObligatorio = tipo !== 'INGRESO';

  const valida = TRES_DECIMALES.test(cantidad.trim());
  const numero = valida ? parseDecimal(cantidad) : 0;
  const actual = Number(articulo.stock);
  const queda = tipo === 'INGRESO' ? actual + numero : tipo === 'EGRESO' ? actual - numero : numero;

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next: typeof errors = {};
    if (!cantidad.trim()) next.cantidad = 'Ingresá la cantidad';
    else if (!valida) next.cantidad = 'Ingresá un número, con hasta 3 decimales';
    else if (tipo !== 'AJUSTE' && numero <= 0) next.cantidad = 'Tiene que ser mayor a 0';
    else if (numero > STOCK_MAX) next.cantidad = 'El número es demasiado alto';
    if (motivoObligatorio && !motivo.trim()) next.motivo = 'Contanos el motivo';
    setErrors(next);
    if (Object.keys(next).length > 0) return;

    onSubmit({
      tipo,
      cantidad: numero,
      ...(motivo.trim() && { motivo: motivo.trim() }),
      ...(numComprobante.trim() && { numComprobante: numComprobante.trim() }),
    });
  };

  return (
    <Modal isOpen onClose={() => !isLoading && onClose()} ariaLabel="Registrar movimiento" className="max-w-lg!">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <Title as="h2">Registrar movimiento</Title>
          <p className="font-inter text-sm text-capilar-grey">
            <span className="font-semibold text-black">{articulo.nombre}</span> · hoy hay {formatEnvases(articulo.stock)}
          </p>
        </div>

        <Form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col gap-2">
            <div role="group" aria-label="Tipo de movimiento" className="grid grid-cols-3 gap-2">
              {TIPOS.map((t) => (
                <button
                  key={t.tipo}
                  type="button"
                  aria-pressed={tipo === t.tipo}
                  onClick={() => setTipo(t.tipo)}
                  className={`rounded-[6px] border px-3 py-2 font-inter text-sm transition-colors ${
                    tipo === t.tipo
                      ? 'border-capilar-violet bg-capilar-violet text-white'
                      : 'border-gray-300 bg-white text-capilar-grey hover:border-capilar-violet hover:text-capilar-violet'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <p className="font-inter text-xs text-capilar-grey">{elegido.ayuda}</p>
          </div>

          <FormField
            label={elegido.cantidad}
            inputMode="decimal"
            value={cantidad}
            onChange={(event) => setCantidad(limitarDecimal(event.target.value, 3))}
            placeholder="Ej.: 2 o 1,5"
            autoFocus
            error={errors.cantidad}
          />

          <FormField
            label={motivoObligatorio ? 'Motivo' : 'Motivo (opcional)'}
            value={motivo}
            onChange={(event) => setMotivo(event.target.value)}
            maxLength={MOVIMIENTO_MOTIVO_MAX}
            placeholder={tipo === 'AJUSTE' ? 'Ej.: Conteo mensual' : tipo === 'EGRESO' ? 'Ej.: Se cayó y se rompió' : 'Ej.: Devolución de un cliente'}
            error={errors.motivo}
          />

          <FormField
            label="Comprobante (opcional)"
            value={numComprobante}
            onChange={(event) => setNumComprobante(event.target.value)}
            maxLength={MOVIMIENTO_COMPROBANTE_MAX}
            placeholder="Número de factura o ticket"
          />

          {valida && cantidad.trim() && (
            <p className={`rounded-md px-3 py-2 font-inter text-sm ${queda < 0 ? 'bg-red-50 text-red-600' : 'bg-gray-50 text-black'}`}>
              {queda < 0 ? 'El stock va a quedar en negativo: ' : 'Va a quedar en '}
              <span className="font-semibold">{formatEnvases(Math.round(queda * 1000) / 1000)}</span>.
            </p>
          )}

          {error && (
            <p role="alert" className="text-center font-inter text-sm text-red-500">
              {error}
            </p>
          )}

          <div className="flex justify-end gap-3">
            <Button type="button" variant="grey" onClick={onClose} disabled={isLoading} className="px-5 py-2 text-xs uppercase">
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-xs text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoading ? 'Guardando...' : 'Registrar'}
            </Button>
          </div>
        </Form>
      </div>
    </Modal>
  );
};
