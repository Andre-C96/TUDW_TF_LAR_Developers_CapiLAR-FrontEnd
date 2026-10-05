import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { resetPasswordRequest } from '../../api/auth';
import { ApiError } from '../../api/client';
import { Alert } from '../../components/alert/alert';
import { Button } from '../../components/button/button';
import { ResetPasswordForm } from '../../components/resetPasswordForm/resetPasswordForm';
import type { AuthView } from '../../components/authModal/authModal';

// Destino del link del correo de recupero: /reset-password?token=...
export const ResetPassword = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token');

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isDone, setIsDone] = useState(false);

  const handleSubmit = async (contrasena: string) => {
    if (!token) return;
    setIsLoading(true);
    setError(undefined);
    try {
      await resetPasswordRequest(token, contrasena);
      setIsDone(true);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Probá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  // Vuelve a la home con el modal de login abierto
  const goToLogin = () => navigate('/', { state: { authView: 'login' satisfies AuthView } });

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 py-10">
      <img src="/capiLAR_logo1.png" alt="CapiLAR" className="h-10 w-auto" />

      <div className="w-full max-w-md rounded-[6px] bg-white p-8 shadow-md">
        {token ? (
          <ResetPasswordForm
            onSubmit={handleSubmit}
            isLoading={isLoading}
            error={error}
            isDone={isDone}
            onLoginClick={goToLogin}
          />
        ) : (
          <div className="flex flex-col gap-4">
            <Alert variant="error" title="Enlace no válido">
              Abrí el enlace completo que te enviamos por correo o pedí uno nuevo desde "¿Olvidaste tu contraseña?".
            </Alert>
            <Button onClick={() => navigate('/')}>VOLVER AL INICIO</Button>
          </div>
        )}
      </div>
    </main>
  );
};
