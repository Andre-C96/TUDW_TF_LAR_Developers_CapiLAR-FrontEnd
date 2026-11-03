import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../alert/alert';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

interface ForgotPasswordFormProps {
  // Recibe el correo; quien lo usa llama a la API
  onSubmit: (email: string) => void;
  // Mientras se espera la respuesta
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
  // true cuando el backend confirmó el envío
  isSent?: boolean;
  // Link para volver al login
  onLoginClick?: () => void;
}

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Botón con aspecto de link 
const linkClasses = 'font-semibold text-capilar-violet hover:underline';

// Contenido del recupero de contraseña
export const ForgotPasswordForm = ({
  onSubmit,
  isLoading = false,
  error,
  isSent = false,
  onLoginClick,
}: ForgotPasswordFormProps) => {
  const [email, setEmail] = useState('');
  const [fieldError, setFieldError] = useState<string>();

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = email.trim();
    let message: string | undefined;
    if (!value) message = 'Ingresá tu correo';
    else if (!EMAIL_REGEX.test(value)) message = 'Ingresá un correo válido';
    setFieldError(message);

    if (message) return;
    onSubmit(value.toLowerCase());
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Recuperar Contraseña</Title>
        <p className="font-inter text-sm text-capilar-grey">
          Ingresá el correo de tu cuenta y te enviaremos las instrucciones
        </p>
      </div>

      {isSent ? (
        // Mensaje neutro: no revela si el correo está registrado
        <Alert variant="exito" title="Revisá tu correo">
          Si <span className="font-semibold">{email.trim()}</span> está registrado en CapiLAR, vas a recibir un
          correo con los pasos para crear una nueva contraseña.
        </Alert>
      ) : (
        <Form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Correo"
            type="email"
            placeholder="ej. cliente@capilar.com"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            error={fieldError}
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
            {isLoading ? 'Enviando...' : 'Enviar instrucciones'}
          </Button>
        </Form>
      )}

      {onLoginClick && (
        <p className="text-center font-inter text-sm text-capilar-grey">
          ¿Ya te acordaste?{' '}
          <button type="button" onClick={onLoginClick} className={linkClasses}>
            Volver a iniciar sesión
          </button>
        </p>
      )}
    </div>
  );
};
