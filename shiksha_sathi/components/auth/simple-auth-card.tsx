import type { ReactNode } from "react";

/** Centered card in the login page's visual style, for the small
 * account-recovery pages (forgot / reset / verify). */
export function SimpleAuthCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <main className="mlogin-root">
      <div className="mlogin-card">
        <div className="mlogin-heading">
          <h1>{title}</h1>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {children}
      </div>
    </main>
  );
}
