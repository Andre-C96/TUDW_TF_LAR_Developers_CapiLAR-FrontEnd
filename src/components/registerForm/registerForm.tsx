import { useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ALERGIA_MAX,
  FECHA_NACIMIENTO_MIN,
  TELEFONO_HINT,
  TELEFONO_MAX,
  fechaNacimientoMax,
  onlyDigits,
  validateFechaNacimiento,
  validateTelefono,
} from '../../api/users';
import { Button } from '../button/button';
import { Form, FormField } from '../form/form';
import { Title } from '../title/title';

// Mismos nombres que Usuario del BE. Fecha de nacimiento ("YYYY-MM-DD") y alergia son opcionales
export interface RegisterData {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  fechaNacimiento?: string;
  alergia?: string;
  contrasena: string;
}

interface RegisterFormProps {
  onSubmit: (data: RegisterData) => void;
  // Mientras se espera la respuesta
  isLoading?: boolean;
  // Error devuelto por el backend
  error?: string;
  // Link para volver al login
  onLoginClick?: () => void;
}

interface FormValues {
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
  fechaNacimiento: string;
  alergia: string;
  contrasena: string;
  confirmacion: string;
}

type FieldErrors = Partial<Record<keyof FormValues, string>>;

const initialValues: FormValues = {
  nombre: '',
  apellido: '',
  email: '',
  telefono: '',
  fechaNacimiento: '',
  alergia: '',
  contrasena: '',
  confirmacion: '',
};

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const validate = (values: FormValues): FieldErrors => {
  const errors: FieldErrors = {};

  if (!values.nombre.trim()) errors.nombre = 'Ingresá tu nombre';
  if (!values.apellido.trim()) errors.apellido = 'Ingresá tu apellido';

  if (!values.email.trim()) errors.email = 'Ingresá tu correo';
  else if (!EMAIL_REGEX.test(values.email.trim())) errors.email = 'Ingresá un correo válido';

  const telefonoError = validateTelefono(values.telefono);
  if (telefonoError) errors.telefono = telefonoError;

  const fechaError = validateFechaNacimiento(values.fechaNacimiento);
  if (fechaError) errors.fechaNacimiento = fechaError;

  if (values.alergia.trim().length > ALERGIA_MAX) errors.alergia = `Hasta ${ALERGIA_MAX} caracteres`;

  if (!values.contrasena) errors.contrasena = 'Ingresá una contraseña';
  else if (values.contrasena.length < 8 || !/[A-Za-z]/.test(values.contrasena) || !/\d/.test(values.contrasena)) {
    errors.contrasena = 'Mínimo 8 caracteres, con al menos una letra y un número';
  } else if (values.contrasena.length > 72) errors.contrasena = 'Máximo 72 caracteres';

  if (!values.confirmacion) errors.confirmacion = 'Repetí la contraseña';
  else if (values.confirmacion !== values.contrasena) errors.confirmacion = 'Las contraseñas no coinciden';

  return errors;
};

// Botón con aspecto de link (no navega: ejecuta el callback)
const linkClasses = 'font-semibold text-capilar-violet hover:underline';

// Contenido del registro de cuenta 
export const RegisterForm = ({ onSubmit, isLoading = false, error, onLoginClick }: RegisterFormProps) => {
  const [values, setValues] = useState<FormValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  // Devuelve las props value/onChange/error de un campo (inputs más bajos que en el login, el registro tiene más campos)
  const bind = (name: keyof FormValues) => ({
    value: values[name],
    onChange: (event: ChangeEvent<HTMLInputElement>) =>
      setValues((prev) => ({ ...prev, [name]: event.target.value })),
    error: fieldErrors[name],
    className: 'py-2!',
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const errors = validate(values);
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

    onSubmit({
      nombre: values.nombre.trim(),
      apellido: values.apellido.trim(),
      email: values.email.trim().toLowerCase(),
      telefono: values.telefono,
      // Los opcionales vacíos no se mandan
      fechaNacimiento: values.fechaNacimiento || undefined,
      alergia: values.alergia.trim() || undefined,
      contrasena: values.contrasena,
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1 text-center">
        <Title as="h2" className="text-xl! md:text-2xl!">Crear Cuenta</Title>
        <p className="font-inter text-sm text-capilar-grey">Completá tus datos para registrarte en CapiLAR</p>
      </div>

      <Form onSubmit={handleSubmit} noValidate className="gap-3!">
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Nombre" autoComplete="given-name" {...bind('nombre')} />
          <FormField label="Apellido" autoComplete="family-name" {...bind('apellido')} />
        </div>
        <FormField
          label="Correo"
          type="email"
          placeholder="ej. cliente@capilar.com"
          autoComplete="email"
          {...bind('email')}
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField
            label="Teléfono"
            type="tel"
            inputMode="numeric"
            placeholder="ej. 2994567890"
            autoComplete="tel-national"
            maxLength={TELEFONO_MAX}
            hint={TELEFONO_HINT}
            {...bind('telefono')}
            // Solo deja escribir números
            onChange={(event) => setValues((prev) => ({ ...prev, telefono: onlyDigits(event.target.value) }))}
          />
          <FormField
            label="Fecha de nacimiento"
            type="date"
            autoComplete="bday"
            min={FECHA_NACIMIENTO_MIN}
            max={fechaNacimientoMax()}
            hint="Opcional"
            {...bind('fechaNacimiento')}
          />
        </div>
        <FormField
          label="Alergias"
          placeholder="Ej.: amoníaco, tinturas con PPD"
          maxLength={ALERGIA_MAX}
          hint="Opcional. Nos ayuda a cuidarte en cada servicio."
          {...bind('alergia')}
        />
        <FormField label="Contraseña" type="password" autoComplete="new-password" {...bind('contrasena')} />
        <FormField
          label="Repetir contraseña"
          type="password"
          autoComplete="new-password"
          {...bind('confirmacion')}
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
          className="w-full py-2.5 mt-1 text-white! font-bold! uppercase tracking-wider disabled:opacity-60 disabled:cursor-not-allowed"
        >
          {isLoading ? 'Registrando...' : 'Registrarse'}
        </Button>
      </Form>

      {onLoginClick && (
        <p className="text-center font-inter text-sm text-capilar-grey">
          ¿Ya tenés cuenta?{' '}
          <button type="button" onClick={onLoginClick} className={linkClasses}>
            Iniciá sesión
          </button>
        </p>
      )}
    </div>
  );
};
