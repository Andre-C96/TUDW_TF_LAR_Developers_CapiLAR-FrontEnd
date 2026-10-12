import { useEffect, useState } from 'react';
import { getUserPhotoRequest } from '../../api/users';

interface AvatarProps {
  token: string;
  userId: number;
  nombre: string;
  apellido: string;
  // Nombre del archivo de la foto en el back (ver userPhoto) o null: sin foto se muestran las iniciales
  foto: string | null;
  // Tamaño y tamaño de letra de las iniciales, ej. "h-24 w-24 text-3xl"
  className?: string;
}

// Foto de perfil en un círculo. La imagen pide token, así que se baja y se muestra con una URL local;
// mientras carga, si no tiene o si falla, las iniciales sobre el degradado de marca
export const Avatar = ({ token, userId, nombre, apellido, foto, className = 'h-24 w-24 text-3xl' }: AvatarProps) => {
  // Foto bajada y para qué archivo es (si cambia `foto`, la anterior no se muestra)
  const [photo, setPhoto] = useState<{ foto: string; url: string } | null>(null);

  useEffect(() => {
    if (!foto) return;
    let ignore = false;
    let url = '';
    getUserPhotoRequest(token, userId)
      .then((blob) => {
        if (ignore) return;
        url = URL.createObjectURL(blob);
        setPhoto({ foto, url });
      })
      // Sin la foto quedan las iniciales
      .catch(() => {});
    return () => {
      ignore = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [token, userId, foto]);

  const url = photo && photo.foto === foto ? photo.url : null;

  return (
    <span
      className={`flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-capilar-gradient font-inter font-semibold text-white shadow-md ${className}`}
    >
      {url ? (
        <img src={url} alt={`Foto de ${nombre} ${apellido}`} className="h-full w-full object-cover" />
      ) : (
        <span aria-hidden="true">
          {nombre[0]}
          {apellido[0]}
        </span>
      )}
    </span>
  );
};
