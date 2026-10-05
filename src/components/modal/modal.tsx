import { useEffect } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  // Texto para lectores de pantalla (ej. "Iniciar sesión")
  ariaLabel?: string;
  className?: string;
}

export const Modal = ({ isOpen, onClose, children, ariaLabel, className = '' }: ModalProps) => {
  useEffect(() => {
    if (!isOpen) return;

    // Cerrar con la tecla Escape
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKeyDown);

    // Bloquear el scroll de la página mientras el modal está abierto
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // El portal lo dibuja directo en <body>, por encima del header fijo y del resto de la página
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        className={`relative w-full max-w-md bg-white rounded-[6px] shadow-xl p-8 ${className}`}
        // Un click dentro de la caja no debe cerrar el modal
        onClick={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-4 right-5 text-2xl leading-none text-gray-400 hover:text-gray-600 transition-colors"
        >
          ✕
        </button>
        {children}
      </div>
    </div>,
    document.body
  );
};
