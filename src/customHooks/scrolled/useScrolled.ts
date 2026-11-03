import { useEffect, useState } from 'react';

// true cuando la página bajó más de `offset` px (ej. para cambiar el estilo del header fijo al hacer scroll)
export const useScrolled = (offset = 8) => {
  const [scrolled, setScrolled] = useState(() => window.scrollY > offset);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > offset);
    // Por si cambió entre el render y el efecto (ej. al volver a una página ya bajada)
    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [offset]);

  return scrolled;
};
