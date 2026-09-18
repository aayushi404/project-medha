"use client";

import { useParams } from "next/navigation";

import { CourseDetail } from "@/components/skills/course-detail";

export default function SkillsCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  return <CourseDetail slug={slug} />;
}
