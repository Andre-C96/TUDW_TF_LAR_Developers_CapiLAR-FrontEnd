import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';

export interface UserMenuItem {
  label: string;
  to: string;
}

interface UserMenuProps {
  userName: string;
  items: UserMenuItem[];
}

// Saludo del usuario que despliega hacia abajo un menú con sus secciones
export const UserMenu = ({ userName, items }: UserMenuProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Abierto: se cierra con un clic afuera o con Esc
  useEffect(() => {
    if (!isOpen) return;

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false);
        buttonRef.current?.focus();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative">
      <button
        ref={buttonRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={isOpen}
        onClick={() => setIsOpen((open) => !open)}
        className="flex items-center gap-1.5 font-inter text-base xl:text-lg font-semibold cursor-pointer"
      >
        <span>
          Hola, <span className="bg-capilar-gradient bg-clip-text text-transparent">{userName}</span>
        </span>
        {/* Flecha que gira al abrir */}
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 text-capilar-grey transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </button>

      {isOpen && (
        <ul
          role="menu"
          className="absolute right-0 top-full mt-3 min-w-44 py-1 bg-white border border-gray-200 rounded-[6px] shadow-md"
        >
          {items.map((item) => (
            <li key={item.to} role="none">
              <Link
                to={item.to}
                role="menuitem"
                onClick={() => setIsOpen(false)}
                className="block px-4 py-2 font-inter text-sm hover:bg-gray-50 hover:text-capilar-violet focus-visible:bg-gray-50 focus-visible:outline-none"
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
