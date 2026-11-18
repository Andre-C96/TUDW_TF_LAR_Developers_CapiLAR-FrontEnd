// Links legales del footer (todavía no existen esas páginas)
const footerLinks = [
  { label: 'Preguntas frecuentes', href: '#' },
  { label: 'Términos de uso', href: '#' },
  { label: 'Privacidad', href: '#' },
];

export const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="bg-capilar-grey text-white font-inter">
      <div className="max-w-6xl mx-auto px-6 py-2 flex flex-col gap-2 items-center md:flex-row md:justify-between">
        {/* Logo centrado sobre el copyright */}
        <div className="flex flex-col items-center gap-0.5">
          <img src="/capiLAR_logo_footer.png" alt="CapiLAR" className="h-5 w-auto" />
          <p className="text-xs font-medium">
            © {currentYear} capiLAR. Desarrollado en Neuquén.
          </p>
        </div>

        {/* Links legales separados por una línea vertical */}
        <nav aria-label="Links legales">
          <ul className="flex flex-wrap justify-center text-xs">
            {footerLinks.map((link) => (
              <li key={link.label} className="px-4 border-l border-white first:border-l-0">
                <a href={link.href} className="hover:underline">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </footer>
  );
};
