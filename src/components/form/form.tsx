import { useId, useState } from 'react';
import type { ComponentProps, ReactNode } from 'react';

interface FormProps extends ComponentProps<'form'> {
  children: ReactNode;
}

// Contenedor del formulario: apila los campos con separación uniforme
export const Form = ({ children, className = '', ...props }: FormProps) => {
  return (
    <form className={`flex flex-col gap-5 ${className}`} {...props}>
      {children}
    </form>
  );
};

interface FormFieldProps extends ComponentProps<'input'> {
  label: string;
  // Mensaje de validación que se muestra debajo del input
  error?: string;
  // Ayuda que se muestra debajo del input mientras no haya error (ej. reglas de la contraseña)
  hint?: string;
}

// Ojo abierto (mostrar) y tachado (ocultar), con el trazo del color del texto
const EyeIcon = ({ crossed }: { crossed: boolean }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z" />
    <circle cx="12" cy="12" r="3" />
    {crossed && <path d="M3 3l18 18" />}
  </svg>
);

// Campo con label + input + error. Acepta `ref` y el resto de props del input,
// así funciona tanto controlado (value/onChange) como con `{...register('campo')}` de react-hook-form.
// Si es de contraseña, suma el botón del ojito para ver u ocultar lo escrito.
export const FormField = ({ label, error, hint, id, type, className = '', ...props }: FormFieldProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;
  const isPassword = type === 'password';
  const [showPassword, setShowPassword] = useState(false);
  const describedBy = error ? errorId : hint ? hintId : undefined;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          type={isPassword && showPassword ? 'text' : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          className={`w-full rounded-lg border px-4 py-3 font-inter text-sm text-black placeholder:text-gray-400 outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
            error ? 'border-red-500' : 'border-gray-300'
          } ${isPassword ? 'pr-11' : ''} ${className}`}
          {...props}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setShowPassword((prev) => !prev)}
            aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
            aria-pressed={showPassword}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-capilar-violet transition-colors"
          >
            <EyeIcon crossed={showPassword} />
          </button>
        )}
      </div>
      {error ? (
        <p id={errorId} className="font-inter text-xs text-red-500">
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="font-inter text-xs text-capilar-grey">
            {hint}
          </p>
        )
      )}
    </div>
  );
};
