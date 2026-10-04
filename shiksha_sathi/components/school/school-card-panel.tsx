"use client";

import { useState } from "react";

import { useAuth } from "@/lib/auth-context";
import { useSchool } from "@/lib/school-context";
import { SchoolCard } from "@/components/school/school-card";
import { SchoolCardEditor } from "@/components/school/school-card-editor";

/** What the sidebars mount. Reads the shared school context, and shows the
 * editor only for the principal. Renders nothing for a signed-out or school-less account. */
export function SchoolCardPanel({ collapsed }: { collapsed: boolean }) {
  const { accessToken } = useAuth();
  const { school, loading, reload } = useSchool();
  const [editing, setEditing] = useState(false);

  if (loading) {
    return (
      <div aria-hidden className={collapsed ? "mx-auto size-9 animate-pulse rounded-xl bg-muted" : "h-[120px] animate-pulse rounded-2xl bg-muted/60"} />
    );
  }
  if (!school) return null;

  return (
    <>
      <SchoolCard school={school} editable={school.can_edit} collapsed={collapsed} onEdit={() => setEditing(true)} />
      {school.can_edit && editing ? (
        <SchoolCardEditor
          token={accessToken}
          school={school}
          onClose={() => setEditing(false)}
          onChanged={() => void reload()}
        />
      ) : null}
    </>
  );
}
