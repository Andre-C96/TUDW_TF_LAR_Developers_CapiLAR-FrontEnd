import { useId, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { Button } from '../button/button';
import { Modal } from '../modal/modal';
import { Title } from '../title/title';

interface ReasonField {
  label: string;
  // Obligatorio: no deja confirmar con el campo vacío
  required?: boolean;
  placeholder?: string;
  hint?: string;
  maxLength?: number;
}

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  // Pregunta o explicación de lo que va a pasar
  children: ReactNode;
  confirmLabel: string;
  // Recibe el motivo escrito ("" si no hay campo o quedó vacío)
  onConfirm: (motivo: string) => void;
  isLoading?: boolean;
  error?: string;
  // Si se pasa, muestra un campo de texto para el motivo
  reason?: ReasonField;
}

// Modal de confirmación con botones Volver / Confirmar y, si hace falta, un campo para el motivo.
// El formulario vive dentro del modal: al cerrarlo se desmonta y el motivo vuelve a quedar vacío.
export const ConfirmDialog = ({ isOpen, onClose, title, ...props }: ConfirmDialogProps) => (
  <Modal isOpen={isOpen} onClose={() => !props.isLoading && onClose()} ariaLabel={title}>
    <ConfirmContent title={title} onClose={onClose} {...props} />
  </Modal>
);

const ConfirmContent = ({
  onClose,
  title,
  children,
  confirmLabel,
  onConfirm,
  isLoading = false,
  error,
  reason,
}: Omit<ConfirmDialogProps, 'isOpen'>) => {
  const [motivo, setMotivo] = useState('');
  const [reasonError, setReasonError] = useState('');
  const fieldId = useId();
  const max = reason?.maxLength ?? 500;

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();
    if (reason?.required && !motivo.trim()) {
      setReasonError('Contanos el motivo');
      return;
    }
    onConfirm(motivo.trim());
  };

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <Title as="h2">{title}</Title>
        <div className="font-inter text-sm text-capilar-grey">{children}</div>
      </div>

      {reason && (
        <div className="flex flex-col gap-2">
          <label htmlFor={fieldId} className="font-inter text-xs font-semibold uppercase tracking-widest text-capilar-grey">
            {reason.label}
            {!reason.required && <span className="normal-case tracking-normal"> (opcional)</span>}
          </label>
          <textarea
            id={fieldId}
            value={motivo}
            onChange={(event) => {
              setMotivo(event.target.value);
              setReasonError('');
            }}
            maxLength={max}
            rows={3}
            placeholder={reason.placeholder}
            aria-invalid={reasonError ? true : undefined}
            className={`w-full resize-none rounded-lg border px-4 py-3 font-inter text-sm text-black outline-none transition-colors placeholder:text-gray-400 focus:border-capilar-violet focus:ring-2 focus:ring-capilar-violet/20 ${
              reasonError ? 'border-red-500' : 'border-gray-300'
            }`}
          />
          {reasonError ? (
            <p className="font-inter text-xs text-red-500">{reasonError}</p>
          ) : (
            reason.hint && <p className="font-inter text-xs text-capilar-grey">{reason.hint}</p>
          )}
        </div>
      )}

      {error && (
        <p role="alert" className="text-center font-inter text-sm text-red-500">
          {error}
        </p>
      )}

      <div className="flex gap-3">
        <Button type="button" variant="grey" onClick={onClose} disabled={isLoading} className="flex-1 py-3 uppercase">
          Volver
        </Button>
        <Button
          type="submit"
          disabled={isLoading}
          className="flex-1 py-3 text-white! font-bold! uppercase tracking-wider disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isLoading ? 'Procesando...' : confirmLabel}
        </Button>
      </div>
    </form>
  );
};
