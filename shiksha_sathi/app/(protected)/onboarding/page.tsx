"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Teacher onboarding is gone: the principal assigns each teacher's school,
 * classes and subjects. Old /onboarding links land on the dashboard.
 */
export default function OnboardingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return null;
}
