import { useState } from 'react';
import type { FormEvent } from 'react';
import { Alert } from '../alert/alert';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

interface ResetPasswordFormProps {
  // Recibe la contraseña nueva; quien lo usa llama a la API con el token del link
  onSubmit: (contrasena: string) => void;
  // Mientras se espera la respuesta
  isLoading?: boolean;
  // Error devuelto por el backend (ej. link vencido)
  error?: string;
  // true cuando el backend confirmó el cambio
  isDone?: boolean;
  // Botón para ir a iniciar sesión una vez cambiada la contraseña
  onLoginClick?: () => void;
}

interface FieldErrors {
  contrasena?: string;
  confirmacion?: string;
}

// Paso 2 del recupero: nueva contraseña (se llega desde el link del correo)
export const ResetPasswordForm = ({
  onSubmit,
  isLoading = false,
  error,
  isDone = false,
  onLoginClick,
}: ResetPasswordFormProps) => {
  const [contrasena, setContrasena] = useState('');
  const [confirmacion, setConfirmacion] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    // Mismas reglas que el registro (el backend pide entre 8 y 72 caracteres)
    const errors: FieldErrors = {};
    if (!contrasena) errors.contrasena = 'Ingresá una contraseña';
    else if (contrasena.length < 8 || !/[A-Za-z]/.test(contrasena) || !/\d/.test(contrasena)) {
      errors.contrasena = 'Mínimo 8 caracteres, con al menos una letra y un número';
    } else if (contrasena.length > 72) errors.contrasena = 'Máximo 72 caracteres';

    if (!confirmacion) errors.confirmacion = 'Repetí la contraseña';
    else if (confirmacion !== contrasena) errors.confirmacion = 'Las contraseñas no coinciden';
    setFieldErrors(errors);

    if (Object.keys(errors).length > 0) return;
    onSubmit(contrasena);
  };

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">Nueva Contraseña</Title>
        <p className="font-inter text-sm text-capilar-grey">Elegí una contraseña nueva para tu cuenta de CapiLAR</p>
      </div>

      {isDone ? (
        <>
          <Alert variant="exito" title="Contraseña actualizada">
            Ya podés iniciar sesión con tu nueva contraseña.
          </Alert>
          {onLoginClick && (
            <Button
              onClick={onLoginClick}
              className="w-full py-3 text-white! font-bold! uppercase tracking-wider"
            >
              Iniciar sesión
            </Button>
          )}
        </>
      ) : (
        <Form onSubmit={handleSubmit} noValidate>
          <FormField
            label="Nueva contraseña"
            type="password"
            autoComplete="new-password"
            hint="Mínimo 8 caracteres, con al menos una letra y un número"
            value={contrasena}
            onChange={(event) => setContrasena(event.target.value)}
            error={fieldErrors.contrasena}
          />
          <FormField
            label="Repetir contraseña"
            type="password"
            autoComplete="new-password"
            value={confirmacion}
            onChange={(event) => setConfirmacion(event.target.value)}
            error={fieldErrors.confirmacion}
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
            {isLoading ? 'Guardando...' : 'Guardar contraseña'}
          </Button>
        </Form>
      )}
    </div>
  );
};
