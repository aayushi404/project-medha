"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronLeft, Loader2, Mail, Phone } from "lucide-react";
import { toast } from "sonner";

import { getTeacherProfile, type TeacherProfile } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/copy";
import { ProfileImage } from "@/components/ui/profile-image";

/** A teacher's full record, read-only from the principal's side -- contact,
 * employment detail, and every class/subject they teach. */
export function TeacherDetail({ teacherId }: { teacherId: string }) {
  const { accessToken } = useAuth();
  const { locale } = useLocale();
  const isHi = locale === "hi";
  const router = useRouter();

  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!accessToken) return;
    getTeacherProfile(accessToken, teacherId)
      .then(setProfile)
      .catch((e: unknown) => {
        setNotFound(true);
        toast.error(e instanceof Error ? e.message : "Could not load this teacher.");
      });
  }, [accessToken, teacherId]);

  if (notFound) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm text-muted-foreground">
          {isHi ? "यह शिक्षक नहीं मिले।" : "This teacher couldn't be found."}
        </p>
        <Link href="/principal" className="text-xs font-medium text-terracotta hover:underline">
          {isHi ? "वापस जाएं" : "Back to dashboard"}
        </Link>
      </div>
    );
  }

  if (profile === null) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="size-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => router.back()}
          className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          aria-label={isHi ? "वापस" : "Back"}
        >
          <ChevronLeft className="size-4" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">
          {isHi ? "शिक्षक प्रोफ़ाइल" : "Teacher Profile"}
        </h1>
      </div>

      <div className="rounded-2xl bg-card p-6 ring-1 ring-foreground/10">
        <div className="flex items-center gap-4">
          <ProfileImage url={profile.photo_url} name={profile.full_name} size="lg" />
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-base font-semibold text-foreground">{profile.full_name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {profile.qualification ?? ""}
              {profile.years_of_experience != null
                ? `${profile.qualification ? " · " : ""}${profile.years_of_experience} yr experience`
                : ""}
            </p>
          </div>
          <span className="shrink-0 rounded-lg bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-600 capitalize dark:text-emerald-400">
            {profile.approval_status}
          </span>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {isHi ? "संपर्क" : "Contact"}
          </p>
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2">
            <div className="flex items-center gap-2">
              <Mail className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="truncate text-foreground">{profile.email}</span>
            </div>
            <div className="flex items-center gap-2">
              <Phone className="size-3.5 shrink-0 text-muted-foreground" />
              <span className="text-terracotta">{profile.mobile_number ?? "—"}</span>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {isHi ? "नियोजन विवरण" : "Employment"}
          </p>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-xs text-muted-foreground">{isHi ? "कर्मचारी कोड" : "Employee code"}</dt>
              <dd className="text-foreground">{profile.employee_code ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">{isHi ? "अनुमोदित" : "Approved on"}</dt>
              <dd className="text-foreground">
                {profile.approved_at ? new Date(profile.approved_at).toLocaleDateString() : "—"}
              </dd>
            </div>
          </dl>
        </div>

        <div className="mt-5 border-t border-border pt-4">
          <p className="mb-2 text-xs font-medium text-muted-foreground">
            {isHi ? "पढ़ाई जाने वाली कक्षाएँ" : "Classes taught"}
          </p>
          {profile.sections_taught.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {isHi ? "अभी कोई कक्षा असाइन नहीं है।" : "No classes assigned yet."}
            </p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {profile.sections_taught.map((s) => (
                <li
                  key={s}
                  className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-foreground"
                >
                  {s}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
