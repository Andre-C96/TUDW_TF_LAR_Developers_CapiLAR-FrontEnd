import { useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { verifyEmailRequest } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/alert/alert';
import type { AuthView } from '../../components/authModal/authModal';
import { Button } from '../../components/button/button';
import { Loader } from '../../components/loader/loader';
import { Title } from '../../components/title/title';
import { useAuth } from '../../context/auth/useAuth';

type Status = { type: 'verificando' } | { type: 'ok' } | { type: 'error'; message: string };

// Destino del enlace del correo de verificación: /verificar-email?token=...
// Verifica apenas se abre (no hace falta tener la sesión iniciada).
export const VerifyEmail = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');
  const { user, updateUser } = useAuth();
  const [status, setStatus] = useState<Status>({ type: 'verificando' });
  // El token sirve una sola vez: en desarrollo StrictMode corre el efecto dos veces y el segundo pedido fallaría
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    verifyEmailRequest(token)
      .then(() => setStatus({ type: 'ok' }))
      .catch((err) =>
        setStatus({ type: 'error', message: err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Probá de nuevo.' }),
      );
  }, [token]);

  // Si tiene la sesión abierta en este navegador, el perfil deja de pedirle que verifique
  useEffect(() => {
    if (status.type === 'ok' && user && !user.emailVerificadoEn) {
      updateUser({ ...user, emailVerificadoEn: new Date().toISOString() });
    }
  }, [status.type, user, updateUser]);

  const goToLogin = () => navigate('/', { state: { authView: 'login' satisfies AuthView } });
  const isCliente = user?.rol === 'CLIENTE';

  // Botón de abajo: seguir a reservar (o al panel), o pedir otro enlace desde el perfil; sin sesión, iniciar sesión
  const action =
    status.type === 'ok'
      ? user
        ? { label: isCliente ? 'Reservar turno' : 'Ir al panel', onClick: () => navigate(isCliente ? '/reservar' : '/panel') }
        : { label: 'Iniciar sesión', onClick: goToLogin }
      : user
        ? { label: 'Pedir otro enlace', onClick: () => navigate(isCliente ? '/mi-perfil' : '/panel/perfil') }
        : { label: 'Iniciar sesión', onClick: goToLogin };

  return (
    <div className="flex w-full max-w-md flex-col gap-6 rounded-[6px] bg-white p-8 text-center shadow-md">
      <Title as="h2">Verificar correo</Title>

      {!token ? (
        <Alert variant="error" title="Enlace no válido">
          Abrí el enlace completo que te enviamos por correo. Si no lo encontrás, pedí uno nuevo desde tu perfil.
        </Alert>
      ) : status.type === 'verificando' ? (
        <Loader label="Verificando tu correo..." className="py-4" />
      ) : status.type === 'ok' ? (
        <Alert variant="exito" title="¡Tu correo quedó verificado!">
          Ya podés reservar tus turnos.
        </Alert>
      ) : (
        <Alert variant="error" title="No pudimos verificar tu correo">
          {status.message}
        </Alert>
      )}

      {token && status.type === 'error' && !user && (
        <p className="font-inter text-sm text-capilar-grey">Iniciá sesión y pedí un enlace nuevo desde tu perfil.</p>
      )}

      {(!token || status.type !== 'verificando') && (
        <Button onClick={action.onClick} className="w-full py-3 text-white! font-bold! uppercase tracking-wider">
          {action.label}
        </Button>
      )}
    </div>
  );
};
