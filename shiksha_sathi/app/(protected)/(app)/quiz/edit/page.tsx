"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { GenerationEditView } from "@/components/generation/generation-edit-view";

function Inner() {
  const params = useSearchParams();
  return <GenerationEditView type="quiz" id={params.get("id") ?? ""} from={params.get("from")} />;
}

export default function QuizEditPage() {
  return (
    <Suspense fallback={null}>
      <Inner />
    </Suspense>
  );
}
