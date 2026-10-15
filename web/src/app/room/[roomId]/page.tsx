"use client";

import { useParams, useRouter } from "next/navigation";
import { useCallback } from "react";
import { FullPageSpinner } from "@/components/site/header";
import { LiveCall } from "@/components/stage/live-call";
import { useRequireUser } from "@/lib/auth";

export default function RoomPage() {
  const { roomId } = useParams<{ roomId: string }>();
  const user = useRequireUser();
  const router = useRouter();

  const onNext = useCallback(() => router.push("/"), [router]);
  const onFeedback = useCallback((id: string) => router.push(`/feedback/${id}`), [router]);

  if (!user) return <FullPageSpinner />;
  return <LiveCall roomId={roomId} onNext={onNext} onFeedback={onFeedback} />;
}
