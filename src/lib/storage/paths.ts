import path from "node:path";

const root = path.resolve(process.cwd(), "data", "uploads");

export function uploadPath(key: string): string {
  const full = path.resolve(root, key);
  if (full !== root && !full.startsWith(`${root}${path.sep}`)) {
    throw new Error("Invalid storage key");
  }
  return full;
}

export function storageRoot(): string {
  return root;
}
