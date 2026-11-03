import { useState } from 'react';
import type { FormEvent } from 'react';
import { PASSWORD_HINT, validatePassword } from '../../api/auth';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

interface ChangePasswordFormProps {
  // Recibe la contraseña actual y la nueva; quien lo usa llama a la API
  onSubmit: (actual: string, nueva: string) => void;
  onCancel: () => void;
  // Mientras se espera la respuesta
  isLoading?: boolean;
  // Error devuelto por el backend (ej. contraseña actual incorrecta)
  error?: string;
}

interface FieldErrors {
  actual?: string;
  nueva?: string;
  confirmacion?: string;
}

// Cambio de contraseña con la sesión iniciada (desde el perfil)
export const ChangePasswordForm = ({ onSubmit, onCancel, isLoading = false, error }: ChangePasswordFormProps) => {
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors: FieldErrors = {};
    if (!actual) errors.actual = 'Ingresá tu contraseña actual';
    const nuevaError = validatePassword(nueva);
    if (nuevaError) errors.nueva = nuevaError;
    else if (nueva === actual) errors.nueva = 'Tiene que ser distinta de la actual';
    if (!confirmacion) errors.confirmacion = 'Repetí la contraseña nueva';
    else if (confirmacion !== nueva) errors.confirmacion = 'Las contraseñas no coinciden';
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    onSubmit(actual, nueva);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Cambiar contraseña</Title>
        <p className="font-inter text-sm text-capilar-grey">
          Por seguridad, se va a cerrar la sesión en tus otros dispositivos.
        </p>
      </div>

      <Form onSubmit={handleSubmit} noValidate>
        <FormField
          label="Contraseña actual"
          type="password"
          autoComplete="current-password"
          value={actual}
          onChange={(event) => setActual(event.target.value)}
          error={fieldErrors.actual}
        />
        <FormField
          label="Nueva contraseña"
          type="password"
          autoComplete="new-password"
          hint={PASSWORD_HINT}
          value={nueva}
          onChange={(event) => setNueva(event.target.value)}
          error={fieldErrors.nueva}
        />
        <FormField
          label="Repetir contraseña nueva"
          type="password"
          autoComplete="new-password"
          value={confirmacion}
          onChange={(event) => setConfirmacion(event.target.value)}
          error={fieldErrors.confirmacion}
        />

        {error && (
          <p role="alert" className="text-center font-inter text-sm text-red-500">
            {error}
          </p>
        )}

        <div className="flex gap-3">
          <Button type="button" variant="grey" onClick={onCancel} disabled={isLoading} className="flex-1 py-2 text-sm uppercase">
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={isLoading}
            className="flex-1 py-2 text-sm text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? 'Guardando...' : 'Guardar'}
          </Button>
        </div>
      </Form>
    </div>
  );
};
