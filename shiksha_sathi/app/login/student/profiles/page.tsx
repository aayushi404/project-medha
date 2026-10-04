"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { motion } from "motion/react";

import { maskPhone, useStudentLoginFlow } from "@/components/auth/student-login-flow";
import { useCopy } from "@/lib/copy";

/** Step 2: pick which student profile on this number to log in to. */
export default function StudentProfilesPage() {
  const copy = useCopy();
  const router = useRouter();
  const flow = useStudentLoginFlow();
  const ready = flow.phone !== null && flow.profiles.length > 0;

  // Nothing to pick from (a refresh, or a direct visit): start again.
  useEffect(() => {
    if (!ready) router.replace("/login/student");
  }, [ready, router]);

  if (!ready || !flow.phone) return null;

  return (
    <motion.div
      className="flex flex-col gap-4"
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.18 }}
    >
      <div className="text-center">
        <h2 className="text-base font-semibold text-foreground">{copy.login.profilesTitle}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{copy.login.profilesHint(maskPhone(flow.phone))}</p>
      </div>

      <ul className="flex flex-col gap-2">
        {flow.profiles.map((profile) => (
          <li key={profile.id}>
            <button
              type="button"
              className="mlogin-profile"
              onClick={() => {
                flow.choose(profile);
                router.push("/login/student/password");
              }}
            >
              <span className="mlogin-profile-name">{profile.full_name}</span>
              <span className="mlogin-profile-meta">
                {profile.class_label ?? copy.login.classNotSet}
                {profile.roll_number ? ` · ${copy.login.rollNumber(profile.roll_number)}` : ""}
              </span>
            </button>
          </li>
        ))}
      </ul>

      <button
        type="button"
        className="mlogin-link-muted self-center"
        onClick={() => {
          flow.restart();
          router.replace("/login/student");
        }}
      >
        {copy.login.useAnotherNumber}
      </button>
    </motion.div>
  );
}
