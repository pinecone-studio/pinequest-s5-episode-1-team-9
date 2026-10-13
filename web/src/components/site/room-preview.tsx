"use client";

import { useEffect, useRef, useState } from "react";
import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const YOU_PHOTOS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=640&h=800&q=80",
  "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?auto=format&fit=crop&w=640&h=800&q=80",
  "https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=640&h=800&q=80",
];

const PARTNER_PHOTOS = [
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=crop&w=640&h=800&q=80",
  "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?auto=format&fit=crop&w=640&h=800&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=640&h=800&q=80",
];

function RotatingPortrait({ name, tone, photos }: { name: string; tone: string; photos: string[] }) {
  const [photoLayers, setPhotoLayers] = useState<[string | null, string | null]>([null, null]);
  const [activeLayer, setActiveLayer] = useState(0);
  const activeLayerRef = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    Promise.all(
      photos.map(
        (src) =>
          new Promise<string | null>((resolve) => {
            const image = new Image();
            image.onload = () => resolve(src);
            image.onerror = () => resolve(null);
            image.src = src;
          }),
      ),
    ).then((results) => {
      if (cancelled) return;

      const loadedPhotos = results.filter((src): src is string => src !== null);
      if (loadedPhotos.length === 0) return;

      setPhotoLayers([loadedPhotos[0], loadedPhotos[1] ?? null]);
      if (loadedPhotos.length < 2) return;

      let nextPhoto = 2;
      interval = setInterval(() => {
        const nextLayer = 1 - activeLayerRef.current;
        setPhotoLayers((layers) => {
          const updated = [...layers] as [string | null, string | null];
          updated[nextLayer] = loadedPhotos[nextPhoto];
          return updated;
        });
        activeLayerRef.current = nextLayer;
        setActiveLayer(nextLayer);
        nextPhoto = (nextPhoto + 1) % loadedPhotos.length;
      }, 2000);
    });

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
    };
  }, [photos]);

  return (
    <div className={`relative aspect-[4/5] rounded-xl bg-gradient-to-br ${tone}`}>
      {photoLayers.map(
        (src, layer) =>
          src && (
            <img
              key={layer}
              src={src}
              alt=""
              className={`absolute inset-0 size-full rounded-xl object-cover transition-opacity duration-700 ${
                activeLayer === layer ? "opacity-100" : "opacity-0"
              }`}
            />
          ),
      )}
      <span className="absolute bottom-2 left-2 z-10 rounded-md bg-black/40 px-2 py-0.5 text-[11px] text-white">
        {name}
      </span>
    </div>
  );
}

export function RoomPreview() {
  return (
    <div className="relative rounded-2xl border bg-card p-3 shadow-xl shadow-primary/5" aria-hidden>
      <div className="mb-3 flex items-center justify-between px-1 text-xs">
        <div className="flex items-center gap-2">
          <Badge variant="secondary">English</Badge>
          <Badge variant="outline">B1</Badge>
        </div>
        <span className="text-muted-foreground font-mono">08:42</span>
      </div>
      <div className="grid grid-cols-2 gap-2">
        <RotatingPortrait name="You" tone="from-indigo-200 to-violet-300" photos={YOU_PHOTOS} />
        <RotatingPortrait name="Partner · B1" tone="from-emerald-200 to-teal-300" photos={PARTNER_PHOTOS} />
      </div>
      <div className="mt-3 rounded-xl border bg-background p-4">
        <div className="text-primary flex items-center gap-1.5 text-xs font-medium">
          <Sparkles className="size-3.5" /> Today's topic
        </div>
        <div className="mt-1.5 font-medium">Big city or small town?</div>
        <div className="text-muted-foreground mt-1 text-xs">Explain your choice and give at least two reasons.</div>
        <div className="text-muted-foreground mt-3 flex items-center gap-2 text-[11px]">
          <span className="relative flex size-2">
            <span className="animate-pulse-ring absolute inline-flex size-full rounded-full bg-emerald-500" />
            <span className="relative inline-flex size-2 rounded-full bg-emerald-500" />
          </span>
          Listening…
        </div>
      </div>
    </div>
  );
}