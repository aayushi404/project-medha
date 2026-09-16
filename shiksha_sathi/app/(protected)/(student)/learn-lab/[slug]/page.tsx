"use client";

import { useParams } from "next/navigation";

import { SimulationPlayer } from "@/components/simulations/simulation-player";

export default function StudentSimulationPlayerPage() {
  const { slug } = useParams<{ slug: string }>();
  return <SimulationPlayer slug={slug} basePath="/learn-lab" />;
}
