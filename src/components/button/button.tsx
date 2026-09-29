import type { ButtonHTMLAttributes, ReactNode } from 'react';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primario' | 'secundario' | 'grey' | 'onlyborder';
  children: ReactNode;
}

export const Button = ({ 
  variant = 'primario', 
  children, 
  className = '', 
  ...props 
}: ButtonProps) => {
  // Clases base compartidas por todos los botones
  const baseClasses = "font-inter font-medium rounded-[4px] shadow-md transition-all active:scale-95 flex items-center justify-center";

  switch (variant) {
    case 'primario':
      // Fondo degradado completo
      return (
        <button
          className={`${baseClasses} bg-capilar-gradient text-black px-6 py-2 hover:text-white hover:opacity-90 ${className}`}
          {...props}
        >
          {children}
        </button>
      );

    case 'secundario':
      // Borde degradado con fondo claro
      return (
        <div className={`relative inline-flex shadow-md rounded-md p-[2px] bg-capilar-gradient active:scale-95 transition-transform ${className}`}>
          <button
            className="w-full h-full bg-white rounded-[4px] px-6 py-2 text-black font-inter font-medium hover:bg-gray-100 transition-colors"
            {...props}
          >
            {children}
          </button>
        </div>
      );

    case 'grey':
      // Borde y texto gris
      return (
        <button
          className={`${baseClasses} border-2 border-gray-400 bg-white text-gray-500 px-6 py-2 hover:bg-gray-200 ${className}`}
          {...props}
        >
          {children}
        </button>
      );

    case 'onlyborder':
      // Cuadrado con borde degradado y contenido degradado
      return (
      <div className={`group relative inline-flex shadow-md rounded-[4px] p-[2px] bg-capilar-gradient active:scale-95 transition-transform ${className}`}>
          <button
            className="flex items-center justify-center w-10 h-10 bg-white rounded-[4px] group-hover:bg-transparent transition-all duration-300 text-xl font-bold"
            {...props}
          >
            <span className="bg-capilar-gradient bg-clip-text text-transparent group-hover:bg-none group-hover:text-white transition-all duration-100">
              {children}
            </span>
          </button>
        </div>
      );
  }
};