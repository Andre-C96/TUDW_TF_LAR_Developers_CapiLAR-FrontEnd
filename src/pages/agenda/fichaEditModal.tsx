import { useState } from 'react';
import { toast } from 'sonner';
import { getArticulosSalonRequest } from '../../api/articulos';
import { ApiError } from '../../api/client';
import { datosParaGuardar } from '../../api/fichaCambios';
import { deleteFichaPhotoRequest, updateFichaRequest, uploadFichaPhotoRequest } from '../../api/fichas';
import type { Ficha, FichaData, FotoFicha, MomentoFoto } from '../../api/fichas';
import { fromIsoDate } from '../../api/turnos';
import { validateFoto } from '../../api/users';
import { FichaForm } from '../../components/fichaForm/fichaForm';
import { FichaGaleria } from '../../components/fichaTecnica/fichaTecnica';
import { Modal } from '../../components/modal/modal';
import { Title } from '../../components/title/title';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { avisarSinStock } from './fichaAvisos';
import { FichaTabs } from './fichaTabs';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';
const errorMessage = (err: unknown) => (err instanceof ApiError ? err.message : unexpectedError);

interface FichaEditModalProps {
  token: string;
  ficha: Ficha;
  onClose: () => void;
  // Se guardó un cambio (datos o fotos): quien lo abrió actualiza su lista
  onSaved: (ficha: Ficha) => void;
}

// Editar una ficha desde el historial de la clienta, también cerrada. Solo para el profesional de ese servicio
export const FichaEditModal = ({ token, ficha: inicial, onClose, onSaved }: FichaEditModalProps) => {
  const [ficha, setFicha] = useState(inicial);
  const [pestania, setPestania] = useState<'ficha' | 'fotos'>('ficha');
  const articulos = useFetch('articulos-salon', () => getArticulosSalonRequest(token));
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  const close = () => {
    if (!saving) onClose();
  };

  const save = async (data: FichaData) => {
    setSaving(true);
    setFormError('');
    try {
      const { sinStock, ...actualizada } = await updateFichaRequest(token, ficha.id, datosParaGuardar(ficha, data));
      onSaved(actualizada);
      toast.success('Ficha guardada');
      avisarSinStock(sinStock);
      onClose();
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  // Fotos: cada cambio devuelve la ficha actualizada
  const changePhotos = async (request: () => Promise<Ficha>, fallo: string) => {
    setSaving(true);
    try {
      const actualizada = await request();
      setFicha(actualizada);
      onSaved(actualizada);
    } catch (err) {
      toast.error(fallo, { description: errorMessage(err) });
    } finally {
      setSaving(false);
    }
  };

  const addPhoto = (tipo: MomentoFoto, file: File) => {
    const invalid = validateFoto(file);
    if (invalid) {
      toast.error('No se pudo subir la foto', { description: invalid });
      return;
    }
    changePhotos(() => uploadFichaPhotoRequest(token, ficha.id, tipo, file), 'No se pudo subir la foto');
  };

  const removePhoto = (foto: FotoFicha) => changePhotos(() => deleteFichaPhotoRequest(token, ficha.id, foto.id), 'No se pudo quitar la foto');

  return (
    <Modal isOpen onClose={close} ariaLabel="Editar ficha técnica" className="max-w-3xl!">
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-2 pr-6">
          <Title as="h2">Editar ficha técnica</Title>
          <p className="font-inter text-sm text-capilar-grey">
            {ficha.servicio} · {fromIsoDate(ficha.fecha).toLocaleDateString('es-AR', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <FichaTabs
          tabs={[
            ['ficha', 'Ficha'],
            ['fotos', `Fotos (${ficha.fotos.length})`],
          ]}
          value={pestania}
          onChange={setPestania}
        />

        {pestania === 'fotos' ? (
          <FichaGaleria token={token} fichaId={ficha.id} fotos={ficha.fotos} onAdd={addPhoto} onRemove={removePhoto} busy={saving} />
        ) : (
          <FichaForm
            ficha={ficha}
            articulos={articulos.data ?? []}
            articulosError={articulos.error}
            onSubmit={save}
            onCancel={close}
            isLoading={saving}
            error={formError}
          />
        )}
      </div>
    </Modal>
  );
};
