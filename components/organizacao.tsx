const selos = [
  {
    href: "https://comitepopular.org.br/",
    src: "/organizacao/comite.webp",
    alt: "Comitê Popular de Luta",
  },
  {
    href: "https://censuradigital.lula.com.br/",
    src: "/organizacao/denuncie.webp",
    alt: "Censura Digital. Denuncie.",
  },
] as const;

export function Organizacao() {
  return (
    <section aria-label="Organização" className="mt-8 flex flex-col gap-4 border-t border-border pt-6">
      <header className="relative overflow-hidden rounded-lg bg-card">
        <img
          src="/organizacao/ato.jpg"
          alt="Ato popular com cartazes e bandeiras"
          className="h-48 w-full object-cover object-[28%_42%] sm:h-60"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black via-black/10 to-black/30" />
        <img
          src="/organizacao/lula-logo.svg"
          alt="Lula Presidente"
          className="absolute bottom-3 left-3 w-[min(230px,62%)] drop-shadow-[0_8px_18px_rgba(0,0,0,0.55)]"
        />
      </header>
      <div>
        <p className="mb-2 text-xs font-semibold tracking-wider text-muted-foreground uppercase">Conheça também</p>
        <div className="grid grid-cols-2 gap-2">
          {selos.map((selo) => (
            <a
              key={selo.href}
              href={selo.href}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-16 items-center justify-center rounded-lg border border-border bg-card px-2 py-2 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-primary"
            >
              <img src={selo.src} alt={selo.alt} className="max-h-20 w-full object-contain" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}
