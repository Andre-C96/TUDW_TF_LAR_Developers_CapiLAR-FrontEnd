import { useEffect, useEffectEvent, useRef } from 'react';
import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

// Lo que se puede enfocar con Tab dentro del modal
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modales abiertos, el último arriba: con uno sobre otro (ej. "Nuevo artículo" sobre la ficha), Escape y Tab
// los maneja solo el de arriba
const abiertos: symbol[] = [];

// Los enfocables visibles (no los de una pestaña oculta o un desplegable cerrado)
const enfocables = (caja: HTMLElement) =>
  [...caja.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.getClientRects().length > 0);

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  // Texto para lectores de pantalla (ej. "Iniciar sesión")
  ariaLabel?: string;
  className?: string;
  // Cerrar al tocar el fondo: solo para modales sin nada que perder (confirmaciones, una foto).
  // Con formularios queda apagado: un toque sin querer borraba todo lo escrito
  closeOnBackdrop?: boolean;
}

export const Modal = ({ isOpen, onClose, children, ariaLabel, className = '', closeOnBackdrop = false }: ModalProps) => {
  // Dónde empezó el toque: si arrancó dentro de la caja (ej. seleccionando texto) y se soltó afuera, no se cierra
  const pressedBackdrop = useRef(false);
  const dialogRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  // Sin esto, el efecto correría en cada render del padre (onClose suele ser una función nueva) y el foco saltaría
  const close = useEffectEvent(onClose);

  useEffect(() => {
    if (!isOpen) return;
    const id = Symbol();
    abiertos.push(id);
    // Al cerrar, el foco vuelve a lo que abrió el modal (ej. el botón "Editar")
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    // Al abrir, el foco entra al modal: al primer campo o botón del contenido, o a la cruz si no hay ninguno
    const content = contentRef.current;
    (content && enfocables(content)[0] ? enfocables(content)[0] : closeRef.current)?.focus();

    const handleKeyDown = (event: KeyboardEvent) => {
      if (abiertos[abiertos.length - 1] !== id) return;
      if (event.key === 'Escape') {
        close();
        return;
      }

      // Tab y Shift+Tab dan la vuelta dentro del modal en vez de seguir por la página de atrás
      const dialog = dialogRef.current;
      if (event.key !== 'Tab' || !dialog) return;
      const items = enfocables(dialog);
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (!dialog.contains(active)) {
        event.preventDefault();
        first.focus();
      } else if (event.shiftKey && active === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);

    // Bloquear el scroll de la página mientras el modal está abierto
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = previousOverflow;
      abiertos.splice(abiertos.indexOf(id), 1);
      if (previous?.isConnected) previous.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  // El portal lo dibuja directo en <body>, por encima del header fijo y del resto de la página
  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onMouseDown={(event) => {
        pressedBackdrop.current = event.target === event.currentTarget;
      }}
      onClick={(event) => {
        if (closeOnBackdrop && pressedBackdrop.current && event.target === event.currentTarget) onClose();
        pressedBackdrop.current = false;
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        // Nunca más alto que la pantalla. La caja recorta (mantiene las esquinas redondeadas)
        // y el contenido scrollea adentro, con la cruz siempre visible
        className={`relative flex w-full max-w-md max-h-[calc(100dvh-2rem)] flex-col overflow-hidden bg-white rounded-[6px] shadow-xl ${className}`}
        // Los clicks dentro de la caja no llegan al fondo ni a los componentes que contienen al modal
        onClick={(event) => event.stopPropagation()}
      >
        {/* Círculo blanco detrás de la cruz: el contenido scrollea por debajo y así no se mezcla con el texto */}
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="absolute top-2.5 right-3 z-10 flex h-9 w-9 items-center justify-center rounded-full bg-white/95 text-2xl leading-none text-gray-400 shadow-sm transition-colors hover:text-gray-600"
        >
          ✕
        </button>
        <div ref={contentRef} className="scrollbar-soft overflow-y-auto p-8">
          {children}
        </div>
      </div>
    </div>,
    document.body
  );
};
