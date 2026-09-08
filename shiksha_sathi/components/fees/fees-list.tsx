import type { FeePayment } from "@/lib/api";
import { useCopy } from "@/lib/copy";

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function FeesList({ payments }: { payments: FeePayment[] }) {
  const copy = useCopy();
  const t = copy.feesPage;

  if (payments.length === 0) {
    return (
      <p className="rounded-xl bg-card p-6 text-center text-sm text-muted-foreground ring-1 ring-foreground/10">
        {t.empty}
      </p>
    );
  }

  return (
    <ul className="divide-y divide-border rounded-xl bg-card ring-1 ring-foreground/10">
      {payments.map((p) => (
        <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="text-sm font-medium text-foreground">{p.fee_type}</div>
            <div className="text-xs text-muted-foreground">
              {fmtDate(p.payment_date)} · {t.loggedBy(p.logged_by_name)}
              {p.note ? ` · ${p.note}` : ""}
            </div>
          </div>
          <span className="shrink-0 tabular-nums text-sm font-medium text-foreground">
            ₹{p.amount.toLocaleString("en-IN")}
          </span>
        </li>
      ))}
    </ul>
  );
}
