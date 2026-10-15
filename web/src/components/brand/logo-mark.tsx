export function LogoMark({ scale = 1, waiting = false }: { scale?: number; waiting?: boolean }) {
  const px = (n: number) => `${n * scale}px`;
  return (
    <span
      aria-hidden="true"
      className={waiting ? "lm-wait flex" : "flex"}
      style={{ gap: px(3) }}
    >
      <span
        className="bg-brand-you block"
        style={{ width: px(22), height: px(12), borderRadius: px(6) }}
      />
      <span
        className="bg-brand-partner block"
        style={{ width: px(14), height: px(12), borderRadius: px(6) }}
      />
    </span>
  );
}

export function LogoWord({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display text-[19px] leading-none font-bold ${className}`}>LinguaMatch</span>
  );
}
