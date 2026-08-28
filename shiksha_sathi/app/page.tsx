import type { Metadata } from "next";
import { Fraunces, Manrope } from "next/font/google";

import { cn } from "@/lib/utils";
import { Navbar } from "@/components/landing/navbar";
import { Hero } from "@/components/landing/hero";
import { HeritageSection } from "@/components/landing/heritage-section";
import { NalandaSection } from "@/components/landing/nalanda-section";
import { BuddhaSection } from "@/components/landing/buddha-section";
import { SunSection } from "@/components/landing/sun-section";
import { ProblemSection } from "@/components/landing/problem-section";
import { MedhaIntroduction } from "@/components/landing/medha-introduction";
import { TwoSidedSection } from "@/components/landing/two-sided-section";
import { TeacherSection } from "@/components/landing/teacher-section";
import { StudentSection } from "@/components/landing/student-section";
import { WorkflowSection } from "@/components/landing/workflow-section";
import { CapabilitiesSection } from "@/components/landing/capabilities-section";
import { VoiceSection } from "@/components/landing/voice-section";
import { PersonalizationSection } from "@/components/landing/personalization-section";
import { ImpactSection } from "@/components/landing/impact-section";
import { GovernmentSection } from "@/components/landing/government-section";
import { AuthSection } from "@/components/landing/auth-section";
import { Footer } from "@/components/landing/footer";

const fraunces = Fraunces({
  subsets: ["latin"],
  weight: ["300", "400", "500"],
  style: ["normal", "italic"],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-manrope",
  display: "swap",
});

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
  return (
    <div className={cn(fraunces.variable, manrope.variable, "medha-landing min-h-screen")}>
      <Navbar />
      <main>
        <Hero />
        <HeritageSection />
        <NalandaSection />
        <BuddhaSection />
        <SunSection />
        <ProblemSection />
        <MedhaIntroduction />
        <TwoSidedSection />
        <TeacherSection />
        <StudentSection />
        <WorkflowSection />
        <CapabilitiesSection />
        <VoiceSection />
        <PersonalizationSection />
        <ImpactSection />
        <GovernmentSection />
        <AuthSection />
      </main>
      <Footer />
    </div>
  );
}
