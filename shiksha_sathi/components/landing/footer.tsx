import Image from "next/image";
import Link from "next/link";

type FooterLink = { label: string; href: string; external?: boolean };

const columns: { heading: string; links: FooterLink[] }[] = [
  {
    heading: "Product",
    links: [
      { label: "For Teachers", href: "#teachers" },
      { label: "For Students", href: "#students" },
      { label: "How it works", href: "#workflow" },
    ],
  },
  {
    heading: "Get started",
    links: [
      { label: "Create account", href: "#get-started" },
      { label: "Log in", href: "/login", external: true },
      { label: "Vision", href: "#heritage" },
    ],
  },
];

export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary px-6 py-16 sm:px-8">
      <div className="mx-auto grid w-full max-w-6xl gap-12 md:grid-cols-12">
        <div className="md:col-span-5">
          <Image
            src="/Logo.jpeg"
            alt="Medha logo"
            width={80}
            height={80}
            className="mb-5 h-20 w-20 rounded-sm object-contain"
          />
          <p className="display text-xl tracking-[0.32em] uppercase">Medha</p>
          <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted-foreground">
            Intelligence for better teaching.
            <br />
            Curiosity for better learning.
          </p>
        </div>

        {columns.map((col) => (
          <nav key={col.heading} className="md:col-span-3" aria-label={col.heading}>
            <p className="eyebrow text-muted-foreground">{col.heading}</p>
            <ul className="mt-5 space-y-3">
              {col.links.map((l) => (
                <li key={l.label}>
                  {l.external ? (
                    <Link
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </Link>
                  ) : (
                    <a
                      href={l.href}
                      className="text-sm text-muted-foreground transition-colors hover:text-foreground"
                    >
                      {l.label}
                    </a>
                  )}
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mx-auto mt-14 flex w-full max-w-6xl flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>© {new Date().getFullYear()} Medha</p>
        <p>An education initiative for Bihar</p>
      </div>
    </footer>
  );
}
