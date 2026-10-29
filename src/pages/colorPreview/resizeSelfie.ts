// Límites de YouCam: menos de 1920 px de ancho y de 1080 de alto, al menos 320 × 320, JPG o PNG (no WEBP).
// Se deja margen y se exporta como JPEG, que además entra en los 2 MB del back.
const MAX_ANCHO = 1600;
const MAX_ALTO = 1060;
const MIN_LADO = 320;
const CALIDAD = 0.9;
const MAX_BYTES = 2 * 1024 * 1024;

// Achica la selfie en el navegador con un canvas (respeta la rotación de la foto del celular).
// Rechaza con un mensaje para la clienta si no se puede leer o no sirve.
export const resizeSelfie = async (file: File): Promise<Blob> => {
  let imagen: ImageBitmap;
  try {
    imagen = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('No pudimos leer la foto. Probá con una JPG o PNG.');
  }

  const escala = Math.min(1, MAX_ANCHO / imagen.width, MAX_ALTO / imagen.height);
  const ancho = Math.round(imagen.width * escala);
  const alto = Math.round(imagen.height * escala);
  if (ancho < MIN_LADO || alto < MIN_LADO) {
    imagen.close();
    throw new Error('La foto es muy chica. Probá con una de mejor calidad.');
  }

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  canvas.getContext('2d')!.drawImage(imagen, 0, 0, ancho, alto);
  imagen.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', CALIDAD));
  if (!blob || blob.size > MAX_BYTES) throw new Error('No pudimos preparar la foto. Probá con otra.');
  return blob;
};
