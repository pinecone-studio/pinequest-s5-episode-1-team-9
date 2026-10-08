import type { VisualCandidate, VisualSearchProvider } from "@/lib/visuals/types";

type PexelsPhoto = {
  id: number;
  alt?: string;
  width: number;
  height: number;
  src?: { large?: string; medium?: string };
};

type PexelsVideo = {
  id: number;
  duration?: number;
  image?: string;
  video_files?: { link?: string; width?: number; height?: number }[];
};

export function createPexelsProvider(key = process.env.PEXELS_API_KEY ?? "", fetchImpl: typeof fetch = fetch): VisualSearchProvider {
  return {
    async search(input): Promise<VisualCandidate[]> {
      if (!key) return [];
      const query = [...input.keywords.slice(0, 3), input.description].join(" ").trim().slice(0, 80);
      if (!query) return [];
      if (input.type === "BROLL") return searchVideos(fetchImpl, key, query);
      return searchPhotos(fetchImpl, key, query);
    },
  };
}

async function searchPhotos(fetchImpl: typeof fetch, key: string, query: string): Promise<VisualCandidate[]> {
  const response = await fetchImpl(`https://api.pexels.com/v1/search?query=${encodeURIComponent(query)}&per_page=8&orientation=portrait`, {
    headers: { Authorization: key },
  });
  if (!response.ok) throw new Error("Pexels photo search failed");
  const payload = (await response.json()) as { photos?: PexelsPhoto[] };
  return (payload.photos ?? []).flatMap((photo) => {
    const url = photo.src?.large ?? photo.src?.medium;
    if (!url) return [];
    return [
      {
        id: `pexels-photo-${photo.id}`,
        type: "IMAGE" as const,
        url,
        thumbnail: photo.src?.medium ?? url,
        title: photo.alt ?? query,
        duration: null,
        width: photo.width,
        height: photo.height,
        source: "pexels",
        license: "Pexels License",
      },
    ];
  });
}

async function searchVideos(fetchImpl: typeof fetch, key: string, query: string): Promise<VisualCandidate[]> {
  const response = await fetchImpl(
    `https://api.pexels.com/videos/search?query=${encodeURIComponent(query)}&per_page=8&orientation=portrait`,
    { headers: { Authorization: key } },
  );
  if (!response.ok) throw new Error("Pexels video search failed");
  const payload = (await response.json()) as { videos?: PexelsVideo[] };
  return (payload.videos ?? []).flatMap((video) => {
    const file = [...(video.video_files ?? [])].sort((a, b) => (a.width ?? 0) - (b.width ?? 0)).find((item) => item.link);
    if (!file?.link) return [];
    return [
      {
        id: `pexels-video-${video.id}`,
        type: "BROLL" as const,
        url: file.link,
        thumbnail: video.image ?? file.link,
        title: query,
        duration: video.duration ?? null,
        width: file.width ?? 0,
        height: file.height ?? 0,
        source: "pexels",
        license: "Pexels License",
      },
    ];
  });
}
