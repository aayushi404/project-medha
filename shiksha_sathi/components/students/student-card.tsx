"use client";

import Link from "next/link";
import { ChevronRight, Phone } from "lucide-react";

import type { StudentRosterItem } from "@/lib/api";
import { useCopy } from "@/lib/copy";
import { formatIndianPhone } from "@/lib/phone-format";
import { ProfileImage } from "@/components/ui/profile-image";

/** One student in a list. The phone is the contact a teacher uses day to day,
 * so it's on the card; email is only on the full profile. */
export function StudentCard({ student, href }: { student: StudentRosterItem; href: string }) {
  const copy = useCopy();
  const phone = formatIndianPhone(student.login_phone);

  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl bg-card p-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
    >
      <ProfileImage url={student.photo_url} name={student.full_name} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm font-medium text-foreground">{student.full_name}</div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
          {student.roll_number != null && <span>{copy.students.roll(String(student.roll_number))}</span>}
          {phone && (
            <span className="inline-flex items-center gap-1 text-foreground">
              <Phone className="size-3" aria-hidden />
              {phone}
            </span>
          )}
        </div>
      </div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" aria-hidden />
    </Link>
  );
}
