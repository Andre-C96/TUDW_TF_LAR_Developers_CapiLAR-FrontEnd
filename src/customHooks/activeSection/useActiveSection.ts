import { useEffect, useState } from 'react';

// Devuelve el id de la sección que está cruzando la mitad de la pantalla
export const useActiveSection = (sectionIds: string[]) => {
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActiveId(entry.target.id);
        });
      },
      // Achica la zona observada a una línea en el medio de la pantalla
      { rootMargin: '-50% 0px -50% 0px' }
    );

    sectionIds.forEach((id) => {
      const section = document.getElementById(id);
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [sectionIds]);

  return activeId;
};
