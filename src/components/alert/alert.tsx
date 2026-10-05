import type { HTMLAttributes, ReactNode } from 'react';

interface AlertProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  variant?: 'exito' | 'error' | 'advertencia' | 'info';
  title?: ReactNode;
  children?: ReactNode;
  // Si se pasa, muestra la ✕ para cerrar el aviso
  onClose?: () => void;
}

// Colores e ícono de cada variante (info usa el violeta de marca)
const variants = {
  exito: { box: 'bg-green-50 border-green-500 text-green-800', icon: '✓' },
  error: { box: 'bg-red-50 border-red-500 text-red-800', icon: '✕' },
  advertencia: { box: 'bg-amber-50 border-amber-500 text-amber-800', icon: '!' },
  info: { box: 'bg-purple-50 border-capilar-violet text-capilar-violet', icon: 'i' },
};

export const Alert = ({ variant = 'info', title, children, onClose, className = '', ...props }: AlertProps) => {
  const { box, icon } = variants[variant];
  // Errores y advertencias se anuncian de inmediato; éxito e info, sin interrumpir
  const urgent = variant === 'error' || variant === 'advertencia';

  return (
    <div
      role={urgent ? 'alert' : 'status'}
      className={`flex items-start gap-3 p-4 border-l-4 rounded-[6px] shadow-sm font-inter ${box} ${className}`}
      {...props}
    >
      <span
        aria-hidden="true"
        className="flex items-center justify-center shrink-0 w-6 h-6 rounded-full border-2 border-current text-xs font-bold"
      >
        {icon}
      </span>
      <div className="flex-1 text-sm">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={title ? 'mt-1' : ''}>{children}</div>}
      </div>
      {onClose && (
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar aviso"
          className="shrink-0 leading-none opacity-60 hover:opacity-100 transition-opacity"
        >
          ✕
        </button>
      )}
    </div>
  );
};
