import items from "../data/items.json";
import { labelOf } from "../lib/gameData";
import { statLines } from "../lib/inventory";
import { t } from "../lib/i18n";

// In-game item name colors
const QUALITY_COLORS = {
  Unique: "#c7b377",
  Set: "#00c400",
  Rare: "#ffff64",
  Magic: "#6969ff",
  Craft: "#ffa500",
};
export const colorOf = (r) => (r.key.startsWith("w:") ? QUALITY_COLORS.Unique : QUALITY_COLORS[r.quality] ?? "#ddd");

const CELL = 44; // max cell size in px; the grid shrinks to fit narrow screens

const tooltip = (r, lang) =>
  [
    labelOf(r.key, lang),
    r.ethereal && t("ethereal", lang),
    r.sockets > 0 && t("sockets", lang, r.sockets),
    ...statLines(r, lang),
  ]
    .filter(Boolean)
    .join("\n");

// A W x H storage grid as in game. records: items in it, with x/y; ghosts: [{ key, x, y }] empty fixed slots.
export default function StashGrid({ width, height, records, ghosts = [], lang }) {
  const box = (code, x, y) => {
    const { w, h } = items[code];
    return { gridColumn: `${x + 1} / span ${w}`, gridRow: `${y + 1} / span ${h}` };
  };
  return (
    <div
      className="grid"
      style={{
        gridTemplateColumns: `repeat(${width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${height}, minmax(0, 1fr))`,
        aspectRatio: `${width} / ${height}`,
        maxWidth: width * CELL,
        backgroundColor: "rgba(0, 0, 0, 0.45)",
        backgroundImage:
          "linear-gradient(to right, rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.07) 1px, transparent 1px)",
        backgroundSize: `${100 / width}% ${100 / height}%`,
        border: "1px solid var(--color-border-metal)",
      }}
    >
      {ghosts.map((g) => (
        <div
          key={`ghost:${g.key}`}
          title={`${t("missing", lang)}: ${labelOf(g.key, lang)}`}
          className="overflow-hidden text-center leading-tight p-0.5 opacity-40"
          style={{ ...box(g.code, g.x, g.y), fontSize: 10, border: "1px dashed #666", color: "#888" }}
        >
          {labelOf(g.key, lang)}
        </div>
      ))}
      {records.map((r, i) => (
        <div
          key={i}
          title={tooltip(r, lang)}
          className="overflow-hidden text-center leading-tight p-0.5"
          style={{
            ...box(r.code, r.x, r.y),
            fontSize: 10,
            color: colorOf(r),
            border: `1px solid ${colorOf(r)}66`,
            background: r.ethereal ? "rgba(120,120,160,0.25)" : "rgba(20,20,20,0.85)",
          }}
        >
          {labelOf(r.key, lang)}
        </div>
      ))}
    </div>
  );
}
