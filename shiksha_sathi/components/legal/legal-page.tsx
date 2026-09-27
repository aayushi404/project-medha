import Link from "next/link";

export const CONTACT_EMAIL = "homeofirstt@gmail.com";

/**
 * Shared shell for the public policy pages (/privacy, /delete-account). These
 * are linked from the Google Play and Microsoft Store listings, so they must
 * stay reachable without signing in.
 */
export function LegalPage({
  title,
  hindiSummary,
  updated,
  children,
}: {
  title: string;
  hindiSummary: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <main className="mx-auto w-full max-w-2xl px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
        ← Medha
      </Link>
      <h1 className="mt-6 font-heading text-3xl sm:text-4xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: {updated}</p>
      <p lang="hi" className="mt-6 rounded-xl border border-border bg-card p-4 leading-relaxed">
        {hindiSummary}
      </p>
      <div className="mt-8 space-y-6 leading-relaxed [&_h2]:mt-10 [&_h2]:font-heading [&_h2]:text-xl [&_li]:mt-1.5 [&_ul]:list-disc [&_ul]:pl-6 [&_a]:underline [&_a]:underline-offset-2">
        {children}
      </div>
    </main>
  );
}
