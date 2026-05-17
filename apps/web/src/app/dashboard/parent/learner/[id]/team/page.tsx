"use client";
import { useParams } from "next/navigation";
import { redirect } from "next/navigation";

export default function TeamPage() {
  const params = useParams();
  const learnerId = params.id as string;
  redirect(`/dashboard/parent/learner/${learnerId}/collaboration`);
}
