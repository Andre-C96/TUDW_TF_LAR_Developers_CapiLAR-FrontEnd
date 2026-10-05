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
// TODO: conectar los onSubmit con la API en la rama de autenticación
export const AuthModal = ({ view, onViewChange, onClose }: AuthModalProps) => {
  return (
    <Modal
      isOpen={view !== null}
      onClose={onClose}
      ariaLabel={view ? ariaLabels[view] : undefined}
      // El registro es alto: en pantallas bajas el contenido scrollea dentro del modal
      className="max-h-[90vh] overflow-y-auto"
    >
      {view === 'login' && (
        <LoginForm
          onSubmit={() => {}}
          onRegisterClick={() => onViewChange('register')}
          onForgotPasswordClick={() => onViewChange('forgotPassword')}
        />
      )}
      {view === 'register' && (
        <RegisterForm onSubmit={() => {}} onLoginClick={() => onViewChange('login')} />
      )}
      {view === 'forgotPassword' && (
        <ForgotPasswordForm onSubmit={() => {}} onLoginClick={() => onViewChange('login')} />
      )}
    </Modal>
  );
};
