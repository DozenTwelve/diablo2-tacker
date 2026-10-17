import { useState } from "react";
import items from "../data/items.json";
import { baseNameOf, imageOf, labelOf } from "../lib/gameData";
import { locationLines, statLines } from "../lib/inventory";
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
const STAT_COLOR = "#7878f5";
const GREY = "#8a8a8a";

const CELL = 44; // max cell size in px; the grid shrinks to fit narrow screens

// Item box in game style: name, base (for named items), ethereal/sockets, stats.
// For a ghost: where else it is owned (main characters...), or "missing"
function Tooltip({ tip, lang }) {
  const { item, ghost, rect } = tip;
  const above = rect.top > innerHeight / 2;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 160), innerWidth - 160);
  const named = /^[usw]:/.test(item.key);
  return (
    <div
      className="fixed z-50 pointer-events-none text-center text-sm leading-snug px-3 py-2"
      style={{
        left,
        top: above ? rect.top - 6 : rect.bottom + 6,
        transform: `translate(-50%, ${above ? "-100%" : "0"})`,
        maxWidth: 300,
        background: "rgba(0, 0, 0, 0.92)",
        border: "1px solid #3a3a3a",
      }}
    >
      <div style={{ color: ghost ? GREY : colorOf(item) }}>{labelOf(item.key, lang)}</div>
      {named && <div style={{ color: ghost ? GREY : colorOf(item) }}>{baseNameOf(item.code, lang)}</div>}
      {ghost && !item.elsewhere.length && <div style={{ color: GREY }}>{t("missing", lang)}</div>}
      {ghost && item.elsewhere.length > 0 && (
        <>
          <div style={{ color: GREY }}>{t("ownedElsewhere", lang)}</div>
          {locationLines(item.elsewhere, lang).map((l) => (
            <div key={l.text} className="gothic-text-gold">
              {l.text}
              {l.count > 1 && ` ×${l.count}`}
            </div>
          ))}
        </>
      )}
      {!ghost && (
        <>
          {item.ethereal && <div style={{ color: GREY }}>{t("ethereal", lang)}</div>}
          {item.sockets > 0 && <div style={{ color: GREY }}>{t("sockets", lang, item.sockets)}</div>}
          {statLines(item, lang).map((line, i) => (
            <div key={i} style={{ color: STAT_COLOR }}>
              {line}
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// A W x H storage grid as in game. records: items in it, with x/y; ghosts: [{ key, code, x, y }] empty fixed slots.
export default function StashGrid({ width, height, records, ghosts = [], lang }) {
  const [tip, setTip] = useState(null);
  const cell = (item, x, y, ghost) => {
    const { w, h } = items[item.code];
    const show = (e) => setTip({ item, ghost, rect: e.currentTarget.getBoundingClientRect() });
    return (
      <div
        key={ghost ? `ghost:${item.key}` : `${x}:${y}`}
        onMouseEnter={show}
        onMouseLeave={() => setTip(null)}
        onClick={show}
        className="relative flex items-center justify-center"
        style={{
          gridColumn: `${x + 1} / span ${w}`,
          gridRow: `${y + 1} / span ${h}`,
          border: ghost ? `1px dashed ${item.elsewhere.length ? "var(--color-gold-dark)" : "#555"}` : `1px solid ${colorOf(item)}40`,
          background: ghost ? "transparent" : item.ethereal ? "rgba(120, 120, 170, 0.22)" : "rgba(30, 30, 40, 0.6)",
        }}
      >
        <img
          src={imageOf(item)}
          alt={labelOf(item.key, lang)}
          loading="lazy"
          className="w-full h-full object-contain"
          style={
            ghost
              ? item.elsewhere.length
                ? { opacity: 0.55 }
                : { opacity: 0.25, filter: "grayscale(1)" }
              : item.ethereal
                ? { opacity: 0.6 }
                : undefined
          }
        />
      </div>
    );
  };
  return (
    <>
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
        {ghosts.map((g) => cell(g, g.x, g.y, true))}
        {records.map((r) => cell(r, r.x, r.y, false))}
      </div>
      {tip && <Tooltip tip={tip} lang={lang} />}
    </>
  );
}
