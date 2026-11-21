import { useState } from 'react';
import { toast } from 'sonner';
import { getAlergiasRequest } from '../../api/alergias';
import { forgotPasswordRequest } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/auth/useAuth';
import { useFetch } from '../../customHooks/fetch/useFetch';
import { ForgotPasswordForm } from '../forgotPasswordForm/forgotPasswordForm';
import { LoginForm } from '../loginForm/loginForm';
import { Modal } from '../modal/modal';
import { RegisterForm } from '../registerForm/registerForm';

export type AuthView = 'login' | 'register' | 'forgotPassword';

interface AuthModalProps {
  // Formulario visible; null = modal cerrado
  view: AuthView | null;
  onViewChange: (view: AuthView) => void;
  onClose: () => void;
}

const ariaLabels: Record<AuthView, string> = {
  login: 'Iniciar sesión',
  register: 'Crear cuenta',
  forgotPassword: 'Recuperar contraseña',
};

// Modal único para login, registro y recupero: los links de cada formulario cambian el contenido sin cerrarlo
export const AuthModal = ({ view, onViewChange, onClose }: AuthModalProps) => {
  const { login, register } = useAuth();
  // La lista de alergias se pide al abrir el registro
  const alergias = useFetch(view === 'register' ? 'alergias' : null, getAlergiasRequest);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isSent, setIsSent] = useState(false);
  // La cuenta recién creada: el registro muestra el aviso de verificar el correo
  const [registeredUser, setRegisteredUser] = useState<{ nombre: string; email: string }>();

  // No arrastra el error ni los avisos de envío y de registro del anterior
  const resetStatus = () => {
    setError(undefined);
    setIsSent(false);
    setRegisteredUser(undefined);
  };

  const changeView = (next: AuthView) => {
    resetStatus();
    onViewChange(next);
  };

  const close = () => {
    resetStatus();
    onClose();
  };

  // Llama a la API mostrando "cargando" y el mensaje de error del backend si falla
  const submit = async <T,>(request: () => Promise<T>, onSuccess: (result: T) => void) => {
    setIsLoading(true);
    setError(undefined);
    try {
      onSuccess(await request());
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocurrió un error inesperado. Probá de nuevo.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Modal
      isOpen={view !== null}
      onClose={close}
      ariaLabel={view ? ariaLabels[view] : undefined}
    >
      {view === 'login' && (
        <LoginForm
          onSubmit={({ email, password }) =>
            submit(
              () => login(email, password),
              (user) => {
                close();
                toast.success(`¡Hola, ${user.nombre}!`, { description: 'Iniciaste sesión en CapiLAR.' });
              },
            )
          }
          isLoading={isLoading}
          error={error}
          onRegisterClick={() => changeView('register')}
          onForgotPasswordClick={() => changeView('forgotPassword')}
        />
      )}
      {view === 'register' && (
        <RegisterForm
          alergias={alergias.data ?? []}
          onSubmit={(data) =>
            // Ya queda con la sesión iniciada; el modal sigue abierto con el aviso hasta que lo cierre
            submit(
              () => register(data),
              (user) => setRegisteredUser({ nombre: user.nombre, email: user.email }),
            )
          }
          isLoading={isLoading}
          error={error}
          onLoginClick={() => changeView('login')}
          registeredUser={registeredUser}
          onDone={close}
        />
      )}
      {view === 'forgotPassword' && (
        <ForgotPasswordForm
          onSubmit={(email) =>
            submit(
              () => forgotPasswordRequest(email),
              () => setIsSent(true),
            )
          }
          isLoading={isLoading}
          error={error}
          isSent={isSent}
          onLoginClick={() => changeView('login')}
        />
      )}
    </Modal>
  );
};
