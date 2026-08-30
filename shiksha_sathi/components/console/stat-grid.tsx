type Stat = { label: string; value: number | string };

export function StatGrid({ stats }: { stats: Stat[] }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {stats.map((s) => (
        <div
          key={s.label}
          className="rounded-xl bg-card p-4 ring-1 ring-foreground/10"
        >
          <div className="text-2xl font-semibold tabular-nums text-foreground">
            {s.value}
          </div>
          <div className="mt-0.5 text-xs text-muted-foreground">{s.label}</div>
        </div>
      ))}
    </div>
  );
}
