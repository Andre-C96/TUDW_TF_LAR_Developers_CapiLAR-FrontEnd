import { useState } from 'react';
import type { FormEvent } from 'react';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

export interface LoginCredentials {
  email: string;
  password: string;
}

interface LoginFormProps {
  onSubmit: (credentials: LoginCredentials) => void;
  // Mientras se espera la respuesta
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
  // Links al registro y al recupero de contraseña: quien lo usa decide si cambia el contenido del modal o navega
  onRegisterClick?: () => void;
  onForgotPasswordClick?: () => void;
}

interface FieldErrors {
  email?: string;
  password?: string;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Botón con aspecto de link (no navega: ejecuta el callback)
const linkClasses = 'font-semibold text-capilar-violet hover:underline';

// Contenido del login
export const LoginForm = ({
  onSubmit,
  isLoading = false,
  error,
  onRegisterClick,
  onForgotPasswordClick,
}: LoginFormProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors: FieldErrors = {};
    if (!email.trim()) errors.email = 'Ingresá tu correo electrónico';
    else if (!EMAIL_REGEX.test(email.trim())) errors.email = 'Ingresá un correo válido';
    if (!password) errors.password = 'Ingresá tu contraseña';
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    onSubmit({ email: email.trim().toLowerCase(), password });
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Iniciar Sesión</Title>
        <p className="font-inter text-sm text-capilar-grey">Ingresá tus credenciales de CapiLAR</p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Correo electrónico"
          type="email"
          placeholder="ej. cliente@capilar.com"
          autoComplete="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          error={fieldErrors.email}
        />
        <FormField
          label="Contraseña"
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          error={fieldErrors.password}
        />

        {error && (
          <p role="alert" className="font-inter text-sm text-center text-red-500">
            {error}
          </p>
        )}

        {/* Botón de envío */}
        <Button
          type="submit"
          disabled={isLoading}
          className="w-full py-3 text-white! font-bold! uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Ingresando...' : 'Ingresar'}
        </Button>
      </Form>

      {(onRegisterClick || onForgotPasswordClick) && (
        <div className="flex flex-col gap-2 text-center font-inter text-sm text-capilar-grey">
          {onRegisterClick && (
            <p>
              ¿No tenés cuenta?{' '}
              <button type="button" onClick={onRegisterClick} className={linkClasses}>
                Registrate
              </button>
            </p>
          )}
          {onForgotPasswordClick && (
            <p>
              ¿Olvidaste tu contraseña?{' '}
              <button type="button" onClick={onForgotPasswordClick} className={linkClasses}>
                Recuperala
              </button>
            </p>
          )}
        </div>
      )}
    </div>
  );
};
