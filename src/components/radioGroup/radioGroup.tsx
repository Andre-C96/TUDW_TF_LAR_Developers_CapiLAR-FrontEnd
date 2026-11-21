import type { HTMLAttributes, KeyboardEvent } from 'react';

// Hacia dónde mueve cada flecha
const PASOS: Record<string, number> = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };

// Grupo de opciones con role="radio" adentro (servicio, profesional, horario...). Además de Tab, se maneja con las
// flechas como un radio nativo: pasa a la opción anterior o siguiente (da la vuelta) y la elige
export const RadioGroup = ({ onKeyDown, ...props }: HTMLAttributes<HTMLDivElement>) => {
  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    onKeyDown?.(event);
    const paso = PASOS[event.key];
    if (!paso || event.defaultPrevented) return;

    const radios = [...event.currentTarget.querySelectorAll<HTMLElement>('[role="radio"]:not([disabled])')];
    const index = radios.indexOf(document.activeElement as HTMLElement);
    if (index === -1) return;

    // Sin esto, las flechas también scrollean la página
    event.preventDefault();
    const siguiente = radios[(index + paso + radios.length) % radios.length];
    siguiente.focus();
    siguiente.click();
  };

  return <div role="radiogroup" onKeyDown={handleKeyDown} {...props} />;
};
