interface PaginationProps {
  pagina: number;
  total: number;
  porPagina: number;
  onChange: (pagina: number) => void;
}

const buttonClass =
  'flex h-9 w-9 items-center justify-center rounded-[6px] border border-gray-300 bg-white text-capilar-grey transition-colors hover:border-capilar-violet hover:text-capilar-violet disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-gray-300 disabled:hover:text-capilar-grey';

const Chevron = ({ path }: { path: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="h-4 w-4">
    <path d={path} />
  </svg>
);

// Anterior / siguiente para las listas paginadas del back ({ items, total, pagina, porPagina }). Con una sola página no se muestra
export const Pagination = ({ pagina, total, porPagina, onChange }: PaginationProps) => {
  const paginas = Math.ceil(total / porPagina);
  if (paginas <= 1) return null;

  return (
    <nav aria-label="Páginas" className="flex items-center justify-center gap-3 font-inter text-sm text-capilar-grey">
      <button type="button" onClick={() => onChange(pagina - 1)} disabled={pagina <= 1} aria-label="Página anterior" className={buttonClass}>
        <Chevron path="m15 18-6-6 6-6" />
      </button>
      <span>
        Página {pagina} de {paginas}
      </span>
      <button type="button" onClick={() => onChange(pagina + 1)} disabled={pagina >= paginas} aria-label="Página siguiente" className={buttonClass}>
        <Chevron path="m9 18 6-6-6-6" />
      </button>
    </nav>
  );
};
