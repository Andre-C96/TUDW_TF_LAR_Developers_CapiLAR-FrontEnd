import { useId } from 'react';
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
}

// Campo con label + input + error. Acepta `ref` y el resto de props del input,
// así funciona tanto controlado (value/onChange) como con `{...register('campo')}` de react-hook-form
export const FormField = ({ label, error, id, className = '', ...props }: FormFieldProps) => {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  const errorId = `${inputId}-error`;

  return (
    <div className="flex flex-col gap-2">
      <label
        htmlFor={inputId}
        className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={`w-full rounded-lg border px-4 py-3 font-inter text-sm text-black placeholder:text-gray-400 outline-none transition-colors focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
          error ? 'border-red-500' : 'border-gray-300'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={errorId} className="font-inter text-xs text-red-500">
          {error}
        </p>
      )}
    </div>
  );
};
