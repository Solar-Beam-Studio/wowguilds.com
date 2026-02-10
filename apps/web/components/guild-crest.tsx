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

  return (
    <div
      className={`relative shrink-0 ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Background — clipped to border shape */}
      {borderUrl ? (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: parseColor(bgColor),
            maskImage: `url(${borderUrl})`,
            WebkitMaskImage: `url(${borderUrl})`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      ) : (
        <div
          className="absolute inset-[10%] rounded-sm"
          style={{ background: parseColor(bgColor) }}
        />
      )}

      {/* Border */}
      {borderId && (
        <div
          className="absolute inset-0"
          style={{
            backgroundColor: parseColor(borderColor),
            maskImage: `url(${BORDER_URL(borderId)})`,
            WebkitMaskImage: `url(${BORDER_URL(borderId)})`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      )}

      {/* Emblem */}
      {emblemId && (
        <div
          className="absolute inset-[15%]"
          style={{
            backgroundColor: parseColor(emblemColor),
            maskImage: `url(${EMBLEM_URL(emblemId)})`,
            WebkitMaskImage: `url(${EMBLEM_URL(emblemId)})`,
            maskSize: "contain",
            WebkitMaskSize: "contain",
            maskRepeat: "no-repeat",
            WebkitMaskRepeat: "no-repeat",
            maskPosition: "center",
            WebkitMaskPosition: "center",
          }}
        />
      )}
    </div>
  );
}
