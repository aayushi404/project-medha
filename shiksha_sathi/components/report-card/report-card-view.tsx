import type { ReportCard } from "@/lib/api";
import { useCopy } from "@/lib/copy";

export function ReportCardView({ card }: { card: ReportCard | null }) {
  const copy = useCopy();
  const t = copy.reportCardPage;

  if (!card || card.marks.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {t.empty}
      </p>
    );
  }

  const byTerm = new Map<string, typeof card.marks>();
  for (const m of card.marks) {
    byTerm.set(m.term, [...(byTerm.get(m.term) ?? []), m]);
  }

  return (
    <div className="flex flex-col gap-4">
      {Array.from(byTerm.entries()).map(([term, marks]) => (
        <div key={term} className="overflow-hidden rounded-xl bg-card ring-1 ring-foreground/10">
          <div className="border-b border-border bg-muted/40 px-4 py-2 text-xs font-medium text-muted-foreground">
            {t.term}: {term}
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-muted-foreground">
                <th className="px-4 py-2 font-medium">{t.subject}</th>
                <th className="px-4 py-2 font-medium">{t.marks}</th>
                <th className="px-4 py-2 font-medium">{t.remarksLabel}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {marks.map((m) => (
                <tr key={m.subject_id}>
                  <td className="px-4 py-2 text-foreground">{m.subject_name}</td>
                  <td className="px-4 py-2 tabular-nums text-foreground">
                    {m.marks_obtained}/{m.max_marks}
                  </td>
                  <td className="px-4 py-2 text-muted-foreground">{m.remarks ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ))}
    </div>
  );
}
