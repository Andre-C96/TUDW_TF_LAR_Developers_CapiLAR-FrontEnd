import { useState } from 'react';
import { toast } from 'sonner';
import { createArticuloRequest, createMarcaRequest, formatMarca, getMarcasRequest, porMarca } from '../../api/articulos';
import type { Articulo, ArticuloData, MarcaData } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { ArticuloForm } from '../../components/articuloForm/articuloForm';
import { Modal } from '../../components/modal/modal';
import { useFetch } from '../../customHooks/fetch/useFetch';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// El 409 trae el artículo repetido al final del mensaje: "... en esa marca (id 12)"
const ID_REPETIDO = /\s*\(id (\d+)\)/;

interface NuevoArticuloModalProps {
  token: string;
  nombreInicial: string;
  // Los que se pueden elegir si el artículo ya existe. En una ficha: activos, de uso salón
  articulos: Articulo[];
  // Desde una compra: formulario completo y sin stock inicial, porque lo suma la compra
  paraCompra?: boolean;
  // Se creó: hay que sumarlo a la lista de la ficha
  onCreado: (articulo: Articulo) => void;
  // Queda elegido en el producto de la fórmula (el nuevo o el que ya existía)
  onElegir: (articulo: Articulo) => void;
  onClose: () => void;
}

// Alta de un artículo sin salir de lo que se está cargando. Desde la ficha es rápida: uso y depósito quedan en Salón,
// y lo demás lo completa el ADMIN si quiere
export const NuevoArticuloModal = ({ token, nombreInicial, articulos, paraCompra = false, onCreado, onElegir, onClose }: NuevoArticuloModalProps) => {
  const marcas = useFetch('marcas', () => getMarcasRequest(token));
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  // El repetido, solo si sirve para una ficha: uno de solo venta no se puede usar acá
  const [existente, setExistente] = useState<Articulo | null>(null);

  const close = () => {
    if (!isSaving) onClose();
  };

  const crear = async (data: ArticuloData) => {
    setIsSaving(true);
    setError('');
    setExistente(null);
    try {
      const creado = await createArticuloRequest(token, data);
      onCreado(creado);
      onElegir(creado);
      toast.success('Artículo creado', { description: `${creado.nombre} ya está en el stock.` });
      onClose();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        const id = Number(err.message.match(ID_REPETIDO)?.[1]);
        setExistente(articulos.find((articulo) => articulo.id === id) ?? null);
        setError(err.message.replace(ID_REPETIDO, ''));
      } else {
        setError(err instanceof ApiError ? err.message : unexpectedError);
      }
    } finally {
      setIsSaving(false);
    }
  };

  const crearMarca = async (data: MarcaData) => {
    const nueva = await createMarcaRequest(token, data);
    marcas.setData((prev) => [...prev, nueva].sort(porMarca));
    return nueva;
  };

  const usarExistente = () => {
    if (!existente) return;
    onElegir(existente);
    onClose();
  };

  return (
    <Modal isOpen onClose={close} ariaLabel="Nuevo artículo" className="max-w-2xl!">
      <ArticuloForm
        rapido={!paraCompra}
        sinStockInicial={paraCompra}
        nombreInicial={nombreInicial}
        marcas={marcas.data ?? []}
        onCrearMarca={crearMarca}
        onSubmit={crear}
        onCancel={close}
        isLoading={isSaving}
        error={error || marcas.error}
        errorAction={
          existente && (
            <button type="button" onClick={usarExistente} className="self-center font-inter text-sm font-semibold text-capilar-violet hover:underline">
              Usar el que ya existe: {existente.nombre}
              {existente.tonalidad && ` · ${existente.tonalidad}`} ({formatMarca(existente.marca)})
            </button>
          )
        }
      />
    </Modal>
  );
};
