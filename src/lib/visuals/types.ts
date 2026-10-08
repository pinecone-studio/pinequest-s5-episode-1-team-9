export type VisualCandidate = {
  id: string;
  type: "IMAGE" | "BROLL";
  url: string;
  thumbnail: string;
  title: string;
  duration: number | null;
  width: number;
  height: number;
  source: string;
  license: string | null;
};

export interface VisualSearchProvider {
  search(input: { type: string; keywords: string[]; description: string }): Promise<VisualCandidate[]>;
}
