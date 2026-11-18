import { useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { DOS_DECIMALES, getArticulosSalonRequest, limitarDecimal, parseDecimal } from '../../api/articulos';
import { getFichaRequest, insumosDeFicha, textoSinPrecio, totalDeProductos } from '../../api/fichas';
import { formatPrice } from '../../api/services';
import { METODOS_PAGO, PRECIO_FINAL_MAX, formatFechaLarga } from '../../api/turnos';
import type { CompletarTurnoData, MetodoPago, Turno } from '../../api/turnos';
import { Button } from '../../components/button/button';
import { Opciones } from '../../components/fichaForm/fichaForm';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';

const labelClass = 'font-inter text-[11px] font-semibold uppercase tracking-widest text-capilar-grey';

const validarPrecio = (texto: string) => {
  if (!texto.trim()) return 'Indicá cuánto se cobró';
  if (!DOS_DECIMALES.test(texto.trim())) return 'Un número con hasta 2 decimales';
  if (parseDecimal(texto) > PRECIO_FINAL_MAX) return 'El precio es demasiado alto';
  return '';
};

interface CompletarTurnoModalProps {
  token: string;
  turno: Turno;
  onClose: () => void;
  // Recibe los datos ya validados; quien lo usa llama a la API
  onConfirm: (data: CompletarTurnoData) => void;
  isLoading: boolean;
  error: string;
  // Aviso sobre la ficha técnica
  children: ReactNode;
}

// Al completar un turno se registra lo cobrado por cada servicio (arranca con el precio base) y el método de pago.
// Debajo de cada servicio, lo que suman sus productos, para decidir cuánto cobrar.
export const CompletarTurnoModal = ({ token, turno, onClose, onConfirm, isLoading, error, children }: CompletarTurnoModalProps) => {
  const [precios, setPrecios] = useState<Record<number, string>>(() =>
    Object.fromEntries(turno.detalles.map((detalle) => [detalle.id, String(Number(detalle.precioBase))])),
  );
  const [metodoPago, setMetodoPago] = useState<MetodoPago | ''>(turno.metodoPago ?? '');
  const [errores, setErrores] = useState<Record<number, string>>({});
  const [errorMetodo, setErrorMetodo] = useState('');

  // Si no se pueden calcular los productos se completa igual: la línea no aparece
  const fichaIds = turno.detalles.flatMap((detalle) => (detalle.fichaId ? [detalle.fichaId] : []));
  const costos = useFetch(fichaIds.length > 0 ? `costos-turno-${turno.id}` : null, async () => {
    const [fichas, articulos] = await Promise.all([
      Promise.all(fichaIds.map((id) => getFichaRequest(token, id))),
      getArticulosSalonRequest(token),
    ]);
    return new Map(fichas.map((ficha) => [ficha.id, totalDeProductos(insumosDeFicha(ficha), articulos)]));
  });

  const total = turno.detalles.reduce((suma, detalle) => suma + (parseDecimal(precios[detalle.id]) || 0), 0);

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    const nuevos = Object.fromEntries(turno.detalles.map((detalle) => [detalle.id, validarPrecio(precios[detalle.id])]));
    setErrores(nuevos);
    setErrorMetodo(metodoPago ? '' : 'Elegí cómo se pagó');
    if (!metodoPago || Object.values(nuevos).some(Boolean)) return;
    onConfirm({
      detalles: turno.detalles.map((detalle) => ({ turnoDetalleId: detalle.id, precioFinal: parseDecimal(precios[detalle.id]) })),
      metodoPago,
    });
  };

  return (
    <Modal isOpen onClose={onClose} ariaLabel="Completar turno">
      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 text-center">
          <Title as="h2">Completar turno</Title>
          <p className="font-inter text-sm font-semibold text-black">
            {turno.cliente.nombre} {turno.cliente.apellido} · {formatFechaLarga(turno.fecha)}, {turno.horaInicio}
          </p>
        </div>

        <div className="flex flex-col gap-3">
          <span className={labelClass}>¿Cuánto se cobró?</span>
          {turno.detalles.map((detalle) => {
            const costo = detalle.fichaId ? costos.data?.get(detalle.fichaId) : undefined;
            const conProductos = costo && (costo.total > 0 || costo.sinPrecio > 0);
            return (
              <div key={detalle.id} className="flex items-start justify-between gap-4">
                <div className="flex min-w-0 flex-col gap-0.5 font-inter">
                  <span className="text-sm font-semibold text-black">{detalle.servicio}</span>
                  <span className="text-xs text-capilar-grey">Desde {formatPrice(detalle.precioBase)}</span>
                  {conProductos && (
                    <span className="text-xs text-capilar-grey">
                      Productos{costo.estimado && ' (estimado)'}: {formatPrice(costo.total)}
                    </span>
                  )}
                  {conProductos && costo.sinPrecio > 0 && <span className="text-xs text-capilar-grey">{textoSinPrecio(costo.sinPrecio)}</span>}
                </div>
                <div className="flex w-32 shrink-0 flex-col gap-1">
                  <div className="relative">
                    <span aria-hidden="true" className="absolute top-1/2 left-3 -translate-y-1/2 font-inter text-sm text-capilar-grey">
                      $
                    </span>
                    <input
                      inputMode="decimal"
                      value={precios[detalle.id]}
                      onChange={(event) => {
                        setPrecios((prev) => ({ ...prev, [detalle.id]: limitarDecimal(event.target.value, 2) }));
                        setErrores((prev) => ({ ...prev, [detalle.id]: '' }));
                      }}
                      aria-label={`Precio cobrado por ${detalle.servicio}`}
                      aria-invalid={errores[detalle.id] ? true : undefined}
                      className={`w-full rounded-lg border py-2 pr-3 pl-7 text-right font-inter text-sm text-black outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
                        errores[detalle.id] ? 'border-red-500' : 'border-gray-300'
                      }`}
                    />
                  </div>
                  {errores[detalle.id] && <p className="font-inter text-xs text-red-500">{errores[detalle.id]}</p>}
                </div>
              </div>
            );
          })}
          {turno.detalles.length > 1 && (
            <p className="flex items-baseline justify-between gap-4 border-t border-gray-200 pt-3 font-inter text-sm font-semibold text-black">
              <span>Total</span>
              <span>{formatPrice(total)}</span>
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1">
          <Opciones
            label="Método de pago"
            opciones={METODOS_PAGO}
            value={metodoPago}
            onChange={(value) => {
              setMetodoPago(value);
              setErrorMetodo('');
            }}
          />
          {errorMetodo && <p className="font-inter text-xs text-red-500">{errorMetodo}</p>}
        </div>

        <div className="flex flex-col gap-2 text-center font-inter text-sm text-capilar-grey">
          <p>El precio y el método de pago no se pueden cambiar después.</p>
          {children}
        </div>

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="grey" onClick={onClose} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
            Volver
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Procesando...' : 'Completar'}
          </Button>
        </div>
      </form>
    </Modal>
  );
};
