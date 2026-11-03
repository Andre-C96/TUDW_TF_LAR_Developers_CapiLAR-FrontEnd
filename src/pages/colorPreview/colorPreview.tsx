import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { ApiError } from '../../api/client';
import { CARTA_DE_COLORES, INTENSIDAD_POR_DEFECTO, previewHairColorRequest } from '../../api/hairColor';
import type { ColorCarta, VistaPreviaColor } from '../../api/hairColor';
import { getServicesRequest } from '../../api/services';
import { Alert } from '../../components/alert/alert';
import { Breadcrumbs } from '../../components/breadcrumbs/breadcrumbs';
import { Button } from '../../components/button/button';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { resizeSelfie } from './resizeSelfie';

const unexpectedError = 'Ocurrió un error inesperado. Probá de nuevo.';

// Caja de cada paso, con su número en un círculo del degradado (como en Reservar turno)
const Step = ({ number, title, children }: { number: number; title: string; children: ReactNode }) => (
  <div className="flex flex-col gap-5 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8">
    <div className="flex items-center gap-3">
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-capilar-gradient font-inter text-sm font-semibold text-white">
        {number}
      </span>
      <Title as="h2" className="text-xl! md:text-2xl!">
        {title}
      </Title>
    </div>
    {children}
  </div>
);

// "Coloración", "Tintura completa"... sin importar mayúsculas ni tildes
const esColoracion = (tipo: string) => {
  const texto = tipo.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return texto.includes('color') || texto.includes('tintura');
};

interface Resultado extends VistaPreviaColor {
  color: ColorCarta;
}

// Prueba virtual de color (TP3, API 1): la clienta sube una selfie, elige un color de la carta y ve cómo le quedaría.
// El back la manda a YouCam y no la guarda. Desde el resultado puede ir a reservar una coloración.
export const ColorPreview = () => {
  const { token } = useAuth();
  const navigate = useNavigate();

  // Selfie ya achicada (es lo que se manda) y su URL local para mostrarla
  const [selfie, setSelfie] = useState<{ blob: Blob; url: string } | null>(null);
  const [isPreparing, setIsPreparing] = useState(false);
  const [color, setColor] = useState<ColorCarta | null>(null);
  const [intensidad, setIntensidad] = useState(INTENSIDAD_POR_DEFECTO);
  const [acepta, setAcepta] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [resultado, setResultado] = useState<Resultado | null>(null);
  // Corta el doble clic antes de que React vuelva a dibujar el botón deshabilitado (cada prueba real gasta 1 unit)
  const applying = useRef(false);

  const services = useFetch('servicios', getServicesRequest);

  // Libera la URL local de la selfie anterior al cambiarla y al salir de la página
  useEffect(() => {
    if (!selfie) return;
    return () => URL.revokeObjectURL(selfie.url);
  }, [selfie]);

  // ProtectedRoute ya garantiza la sesión
  if (!token) return null;

  const chooseSelfie = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    // Para poder volver a elegir el mismo archivo
    event.target.value = '';
    if (!file) return;

    setIsPreparing(true);
    try {
      const blob = await resizeSelfie(file);
      setSelfie({ blob, url: URL.createObjectURL(blob) });
      setResultado(null);
      setApplyError('');
    } catch (err) {
      toast.error('No se pudo usar la foto', { description: err instanceof Error ? err.message : unexpectedError });
    } finally {
      setIsPreparing(false);
    }
  };

  // Solo con el clic: nunca se llama sola (cada prueba real gasta 1 unit de YouCam)
  const apply = async () => {
    if (!selfie || !color || !acepta || applying.current) return;
    applying.current = true;
    setIsApplying(true);
    setApplyError('');
    try {
      const vistaPrevia = await previewHairColorRequest(token, selfie.blob, color.hex, intensidad);
      setResultado({ ...vistaPrevia, color });
    } catch (err) {
      setApplyError(err instanceof ApiError ? err.message : unexpectedError);
    } finally {
      applying.current = false;
      setIsApplying(false);
    }
  };

  const bookColoring = () => {
    const servicio = services.data?.find((s) => esColoracion(s.tipo));
    navigate(servicio ? `/reservar?servicio=${servicio.id}` : '/reservar');
  };

  const canApply = Boolean(selfie && color && acepta) && !isApplying;

  return (
    <section className="mx-auto flex max-w-4xl flex-col gap-8 px-6 pt-32 pb-16">
      <div className="flex flex-col gap-4">
        <Breadcrumbs items={[{ label: 'Inicio', to: '/' }, { label: 'Probá un color' }]} />
        <div className="flex flex-col gap-2">
          <Title>Probá un color</Title>
          <p className="font-inter text-capilar-grey">
            Subí una selfie, elegí un color de nuestra carta y mirá cómo te quedaría antes de reservar.
          </p>
        </div>
      </div>

      <Step number={1} title="Tu selfie">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-center">
          <div className="flex h-56 w-44 shrink-0 items-center justify-center overflow-hidden rounded-[6px] border-2 border-dashed border-gray-300 bg-gray-50">
            {isPreparing ? (
              <Loader size="sm" label="Preparando la foto..." />
            ) : selfie ? (
              <img src={selfie.url} alt="Tu selfie" className="h-full w-full object-cover" />
            ) : (
              <span className="px-4 text-center font-inter text-xs text-capilar-grey">Todavía no subiste una foto</span>
            )}
          </div>
          <div className="flex flex-col gap-3">
            <p className="font-inter text-sm text-capilar-grey">
              De frente, con buena luz y el pelo visible. Mejor sin gorro ni el pelo atado.
            </p>
            <label
              className={`self-start rounded-[4px] border-2 border-capilar-violet px-5 py-2 font-inter text-sm font-semibold text-capilar-violet transition-colors ${
                isPreparing || isApplying ? 'cursor-not-allowed opacity-60' : 'cursor-pointer hover:bg-capilar-violet hover:text-white'
              }`}
            >
              {selfie ? 'Cambiar foto' : 'Subir foto'}
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={chooseSelfie}
                disabled={isPreparing || isApplying}
                className="sr-only"
              />
            </label>
          </div>
        </div>
      </Step>

      <Step number={2} title="Color">
        <div role="radiogroup" aria-label="Color" className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {CARTA_DE_COLORES.map((c) => {
            const selected = c.hex === color?.hex;
            return (
              <button
                key={c.hex}
                type="button"
                role="radio"
                aria-checked={selected}
                onClick={() => setColor(c)}
                className={`flex flex-col items-center gap-2 rounded-lg border-2 px-2 py-3 font-inter text-sm transition-colors ${
                  selected ? 'border-capilar-violet bg-capilar-violet/10' : 'border-transparent hover:border-capilar-violet/50'
                }`}
              >
                <span
                  aria-hidden="true"
                  className="h-12 w-12 rounded-full shadow-md ring-2 ring-white"
                  style={{ backgroundColor: c.hex }}
                />
                <span className={selected ? 'font-semibold text-black' : 'text-capilar-grey'}>{c.nombre}</span>
              </button>
            );
          })}
        </div>

        <label className="flex flex-col gap-2 font-inter text-sm">
          <span className="flex justify-between text-xs font-semibold uppercase tracking-widest text-capilar-grey">
            Intensidad <span className="text-black">{intensidad}%</span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={5}
            value={intensidad}
            onChange={(e) => setIntensidad(Number(e.target.value))}
            className="accent-capilar-violet"
          />
        </label>
      </Step>

      <div className="flex flex-col gap-5 rounded-[6px] border border-capilar-violet/40 bg-capilar-violet/5 p-6 shadow-md md:p-8">
        <label className="flex items-start gap-3 font-inter text-sm text-black">
          <input
            type="checkbox"
            checked={acepta}
            onChange={(e) => setAcepta(e.target.checked)}
            className="mt-0.5 h-4 w-4 shrink-0 accent-capilar-violet"
          />
          Acepto que mi foto se envíe a un servicio externo solo para generar la prueba. CapiLAR no la guarda.
        </label>

        {applyError && (
          <Alert variant="error" title="No se pudo aplicar el color">
            {applyError}
          </Alert>
        )}

        {isApplying ? (
          <Loader label="Aplicando el color... puede tardar unos segundos" className="py-2" />
        ) : (
          <Button
            onClick={apply}
            disabled={!canApply}
            className="self-end px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            Ver cómo me queda
          </Button>
        )}
      </div>

      {resultado && selfie && (
        <div className="flex flex-col gap-5 rounded-[6px] border border-gray-200 bg-white p-6 shadow-md md:p-8">
          <div className="flex flex-wrap items-center gap-3">
            <Title as="h2" className="text-xl! md:text-2xl!">
              Así te quedaría
            </Title>
            {resultado.simulado && (
              <span className="rounded-full bg-amber-100 px-3 py-1 font-inter text-xs font-semibold text-amber-800">
                Modo prueba
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <figure className="flex flex-col gap-2">
              <img src={selfie.url} alt="Tu selfie antes" className="aspect-3/4 w-full rounded-[6px] object-cover" />
              <figcaption className="text-center font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
                Antes
              </figcaption>
            </figure>
            <figure className="flex flex-col gap-2">
              <img
                src={resultado.url}
                alt={`Tu selfie con ${resultado.color.nombre}`}
                className="aspect-3/4 w-full rounded-[6px] object-cover"
              />
              <figcaption className="flex items-center justify-center gap-2 font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
                <span
                  aria-hidden="true"
                  className="h-3 w-3 rounded-full"
                  style={{ backgroundColor: resultado.color.hex }}
                />
                {resultado.color.nombre}
              </figcaption>
            </figure>
          </div>

          <p className="font-inter text-xs text-capilar-grey">
            Es una simulación: el resultado real depende de tu cabello. La imagen está disponible por 2 horas (hasta las{' '}
            {new Date(resultado.venceEn).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}).
          </p>

          <div className="flex flex-wrap items-center justify-end gap-4">
            <a
              href={resultado.url}
              download={`capilar-${resultado.color.nombre.toLowerCase().replace(/\s+/g, '-')}.jpg`}
              target="_blank"
              rel="noreferrer"
              className="font-inter text-sm font-semibold text-capilar-violet hover:underline"
            >
              Descargar
            </a>
            <Button onClick={bookColoring} className="px-6 py-2 text-sm text-white! font-bold! uppercase tracking-wider">
              Reservar coloración
            </Button>
          </div>
        </div>
      )}
    </section>
  );
};
