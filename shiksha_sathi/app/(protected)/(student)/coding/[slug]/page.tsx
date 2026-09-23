"use client";

import { useParams } from "next/navigation";

import { CourseDetail } from "@/components/coding/course-detail";

export default function CodingCoursePage() {
  const { slug } = useParams<{ slug: string }>();
  return <CourseDetail slug={slug} />;
}
