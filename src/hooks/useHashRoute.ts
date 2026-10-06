import { useEffect, useState } from "react";

function readPath(): string {
  const path = window.location.hash.replace(/^#/, "");
  return path === "" ? "/" : path;
}

export function navigate(to: string): void {
  window.location.hash = to;
}

export function useHashRoute(): string {
  const [path, setPath] = useState<string>(readPath);

  useEffect(() => {
    const onChange = () => setPath(readPath());
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  return path;
}
