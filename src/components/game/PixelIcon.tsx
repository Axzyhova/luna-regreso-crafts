import { ITEMS } from "@/game/items";

const hex = (n: number) => `#${n.toString(16).padStart(6, "0")}`;
export function PixelIcon({ item, size = 24 }: { item: string; size?: number }) {
  const it = ITEMS[item];
  if (!it) return null;
  return (
    <svg width={size} height={size} viewBox="0 0 8 8" shapeRendering="crispEdges" aria-hidden>
      {it.icon.flatMap((row, y) => [...row].map((ch, x) => {
        const col = it.colors[ch];
        return col === undefined ? null : <rect key={`${x}-${y}`} x={x} y={y} width={1} height={1} fill={hex(col)} />;
      }))}
    </svg>
  );
}
