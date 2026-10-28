import type { Metadata } from "next";

import { LandingGate } from "@/components/landing/landing-gate";

const title = "Medha — AI for better teaching and learning in Bihar";
const description =
  "Medha is an AI teaching and learning companion that helps teachers build engaging lessons and helps students learn how to learn.";

export const metadata: Metadata = {
  title,
  description,
  openGraph: { title, description, type: "website" },
  twitter: { card: "summary_large_image", title, description },
};

export default function LandingPage() {
  return <LandingGate />;
}
