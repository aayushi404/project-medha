"use client";

import { Suspense } from "react";

import { LiveQuizFlow } from "@/components/quiz-live";

export default function LiveQuizPage() {
  return (
    <Suspense fallback={null}>
      <LiveQuizFlow />
    </Suspense>
  );
}
