import { useState } from 'react';
import { toast } from 'sonner';
import { forgotPasswordRequest } from '../../api/auth';
import { ApiError } from '../../api/client';
import { useAuth } from '../../context/auth/useAuth';
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
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [isSent, setIsSent] = useState(false);

  // No arrastra el error ni el aviso de envío del anterior
  const resetStatus = () => {
    setError(undefined);
    setIsSent(false);
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
      // En pantallas bajas el contenido scrollea dentro del modal
      className="max-h-[90vh] overflow-y-auto"
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
          onSubmit={(data) =>
            submit(
              () => register(data),
              (user) => {
                close();
                toast.success('¡Cuenta creada!', { description: `Te damos la bienvenida a CapiLAR, ${user.nombre}.` });
              },
            )
          }
          isLoading={isLoading}
          error={error}
          onLoginClick={() => changeView('login')}
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
