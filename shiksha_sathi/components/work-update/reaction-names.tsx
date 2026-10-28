"use client";

/** A labelled count + the names behind it -- "Students approved (3): A, B, C".
 * Shared by the teacher's own history view and the Principal's feed. */
export function ReactionNames({
  icon,
  label,
  names,
}: {
  icon: React.ReactNode;
  label: string;
  names: string[];
}) {
  return (
    <div className="rounded-lg bg-muted/40 p-2">
      <div className="flex items-center gap-1 font-semibold text-foreground">
        {icon}
        <span>
          {label} ({names.length})
        </span>
      </div>
      <div className="mt-1 text-[11px] leading-snug text-muted-foreground">
        {names.length ? names.join(", ") : "—"}
      </div>
    </div>
  );
}
