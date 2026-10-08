import type { Metadata } from "next";
import { AppHeader } from "@/components/studio/AppHeader";
import { UploadStudio } from "@/components/upload/UploadStudio";
import { mn } from "@/lib/i18n/mn";

export const metadata: Metadata = {
  title: mn.upload.title,
};

export default function UploadPage() {
  return (
    <div className="flex min-h-dvh flex-col">
      <AppHeader action={<span className="text-sm text-mute">{mn.nav.newReel}</span>} />
      <UploadStudio />
    </div>
  );
}
