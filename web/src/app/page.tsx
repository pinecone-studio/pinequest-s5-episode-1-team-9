import type { Metadata } from "next";
import { HomeSections } from "@/components/home/home-sections";
import { CallStage } from "@/components/stage/call-stage";

export const metadata: Metadata = {
  title: "LinguaMatch — Talk to a real person. Get coached while you speak.",
};

export default function HomePage() {
  return (
    <div className="bg-paper text-ink min-h-dvh">
      <CallStage />
      <HomeSections />
    </div>
  );
}
