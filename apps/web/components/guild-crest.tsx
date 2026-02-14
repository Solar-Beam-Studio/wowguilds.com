"use client";

interface GuildCrestProps {
  emblemId: number | null;
  emblemColor: string | null; // "r,g,b,a"
  borderId: number | null;
  borderColor: string | null;
  bgColor: string | null;
  size?: number;
  className?: string;
}

function parseColor(rgba: string | null): string {
  if (!rgba) return "rgba(128,128,128,1)";
  const parts = rgba.split(",");
  return `rgba(${parts[0]},${parts[1]},${parts[2]},${parts[3] ?? 1})`;
}

function isTransparent(rgba: string | null): boolean {
  if (!rgba) return true;
  const parts = rgba.split(",");
  const r = Number(parts[0]) || 0;
  const g = Number(parts[1]) || 0;
  const b = Number(parts[2]) || 0;
  const a = parts[3] !== undefined ? Number(parts[3]) : 1;
  return a < 0.1 || (r + g + b < 30 && a < 0.5);
}

const EMBLEM_URL = (id: number) =>
  `https://render.worldofwarcraft.com/us/guild/tabards/emblem_${id}.png`;

const BORDER_URL = (id: number) =>
  `https://render.worldofwarcraft.com/us/guild/tabards/border_${id}.png`;

export function GuildCrest({
  emblemId,
  emblemColor,
  borderId,
  borderColor,
  bgColor,
  size = 48,
  className = "",
}: GuildCrestProps) {
  if (!emblemId && !borderId) {
    // Fallback: colored square
    return (
      <div
        className={`rounded-lg flex items-center justify-center font-bold text-white shrink-0 ${className}`}
        style={{
          width: size,
          height: size,
          background: bgColor ? parseColor(bgColor) : "var(--accent)",
        }}
      />
    );
  }

  const borderUrl = borderId ? BORDER_URL(borderId) : null;
  const maskProps = (url: string) => ({
    maskImage: `url(${url})`,
    WebkitMaskImage: `url(${url})`,
    maskSize: "contain",
    WebkitMaskSize: "contain",
    maskRepeat: "no-repeat",
    WebkitMaskRepeat: "no-repeat",
    maskPosition: "center",
    WebkitMaskPosition: "center",
  } as const);

  const needsBg = isTransparent(bgColor);
  const effectiveBg = needsBg ? "rgba(255,255,255,0.12)" : parseColor(bgColor);

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Base fill — clipped to border shape */}
      {borderUrl ? (
        <div
          className="absolute inset-0"
          style={{ backgroundColor: effectiveBg, ...maskProps(borderUrl) }}
        />
      ) : (
        <div
          className="absolute inset-[10%] rounded-sm"
          style={{ background: effectiveBg }}
        />
      )}

      {/* Emblem */}
      {emblemId && (
        <div
          className="absolute inset-[15%]"
          style={{ backgroundColor: parseColor(emblemColor), ...maskProps(EMBLEM_URL(emblemId)) }}
        />
      )}
    </div>
  );
}
