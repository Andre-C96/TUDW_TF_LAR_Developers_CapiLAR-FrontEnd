import { getMyFichasRequest } from '../../api/fichas';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { FichaTecnica } from '../../components/fichaTecnica/fichaTecnica';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';

// Historial capilar de la clienta: las fichas de sus turnos completados, de la más nueva a la más vieja,
// con los cuidados que le indicó su profesional y las fotos de antes y después (sin diagnóstico ni fórmulas)
export const History = () => {
  const { token } = useAuth();
  const fichas = useFetch(token ? 'mis-fichas' : null, () => getMyFichasRequest(token!));

  if (!token) return null;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Historial' }]} />
        <div className="flex flex-col gap-2">
          <Title>Mi historial</Title>
          <p className="font-inter text-capilar-grey">
            Cada servicio que te hiciste, con los cuidados que te indicó tu profesional y las fotos de antes y después.
          </p>
        </div>
      </div>

      {fichas.error ? (
        <Alert variant="error" title="No se pudo cargar tu historial">
          {fichas.error}
        </Alert>
      ) : fichas.isLoading ? (
        <Loader label="Cargando historial..." className="py-12" />
      ) : fichas.data?.length === 0 ? (
        <p className="py-8 text-center font-inter text-sm text-capilar-grey">
          Todavía no tenés fichas. Cuando tu profesional complete la ficha de un servicio, la vas a ver acá.
        </p>
      ) : (
        <div className="flex flex-col gap-4">
          {fichas.data?.map((ficha, index) => (
            <FichaTecnica key={ficha.id} token={token} ficha={ficha} defaultAbierta={index === 0} />
          ))}
        </div>
      )}
    </section>
  );
};
