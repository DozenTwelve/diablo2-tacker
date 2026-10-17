import { useEffect, useState } from "react";
import items from "../data/items.json";
import { baseNameOf, catalog, imageOf, labelOf } from "../lib/gameData";
import { propLines, runewordLines, setBonusLines } from "../lib/props";
import { locationLines, statLines } from "../lib/inventory";
import { t } from "../lib/i18n";

// In-game item name colors
const QUALITY_COLORS = {
  Unique: "#c7b377",
  Set: "#00c400",
  Rare: "#ffff64",
  Magic: "#6969ff",
  Craft: "#ffa500",
  Tempered: "#ffa500",
};
export const SET_GREEN = QUALITY_COLORS.Set;
export const colorOf = (r) => (r.key.startsWith("w:") ? QUALITY_COLORS.Unique : QUALITY_COLORS[r.quality] ?? "#ddd");
export const STAT_COLOR = "#7878f5";
const GREY = "#8a8a8a";

const CELL = 44; // max cell size in px; the grid shrinks to fit narrow screens

// Item box in game style: name, base (for named items), then ethereal/sockets and stats of an owned item,
// or for a ghost (not owned here) its catalog properties as ranges; a set item's bonuses for more pieces;
// for a ghost where else it is owned (main characters...) or "missing"; tip.extra lines in gold.
// tip.summary: an owned item shown by its catalog ranges (several copies), not one copy's stats.
const Lines = ({ lines, color }) =>
  lines.map((line, i) => (
    <div key={i} style={{ color }}>
      {line}
    </div>
  ));

// Tooltip state for things shown on hover, keyboard focus or tap; scrolling closes it so it never floats
// over unrelated content
export function useTip() {
  const [tip, setTip] = useState(null);
  useEffect(() => {
    if (!tip) return;
    const close = () => setTip(null);
    addEventListener("scroll", close, true);
    addEventListener("resize", close);
    return () => {
      removeEventListener("scroll", close, true);
      removeEventListener("resize", close);
    };
  }, [tip]);
  return [tip, setTip];
}
export const tipHandlers = (show, setTip) => ({ onMouseEnter: show, onFocus: show, onMouseLeave: () => setTip(null), onBlur: () => setTip(null) });

export function Tooltip({ tip, lang }) {
  const { item, ghost, summary, rect, extra = [] } = tip;
  // On the side with more room, never taller than that room
  const above = rect.top > innerHeight / 2;
  const left = Math.min(Math.max(rect.left + rect.width / 2, 160), innerWidth - 160);
  const named = /^[usw]:/.test(item.key) && item.code; // a missing runeword has no base
  const elsewhere = item.elsewhere ?? [];
  const entry = catalog.get(item.key)?.names;
  const nameColor = ghost ? GREY : colorOf(item);
  return (
    <div
      className="fixed z-50 pointer-events-none text-center text-sm leading-snug px-3 py-2"
      style={{
        left,
        top: above ? rect.top - 6 : rect.bottom + 6,
        transform: `translate(-50%, ${above ? "-100%" : "0"})`,
        maxWidth: 300,
        maxHeight: above ? rect.top - 12 : innerHeight - rect.bottom - 12,
        overflow: "hidden",
        background: "rgba(0, 0, 0, 0.92)",
        border: "1px solid #3a3a3a",
      }}
    >
      <div style={{ color: nameColor }}>{labelOf(item.key, lang)}</div>
      {named && <div style={{ color: nameColor }}>{baseNameOf(item.code, lang)}</div>}
      {ghost || summary ? (
        <Lines lines={entry?.runes ? runewordLines(entry, lang) : propLines(entry?.props ?? [], lang, entry?.lvl)} color={STAT_COLOR} />
      ) : (
        <>
          {item.ethereal && <div style={{ color: GREY }}>{t("ethereal", lang)}</div>}
          {item.sockets > 0 && <div style={{ color: GREY }}>{t("sockets", lang, item.sockets)}</div>}
          <Lines lines={statLines(item, lang)} color={STAT_COLOR} />
        </>
      )}
      <Lines lines={setBonusLines(entry?.bonus, lang)} color={SET_GREEN} />
      {ghost && !elsewhere.length && <div style={{ color: GREY }}>{t("missing", lang)}</div>}
      {ghost && elsewhere.length > 0 && (
        <>
          <div style={{ color: GREY }}>{t("ownedElsewhere", lang)}</div>
          <Lines lines={locationLines(elsewhere, lang).map((l) => `${l.text}${l.count > 1 ? ` ×${l.count}` : ""}`)} color="var(--color-gold)" />
        </>
      )}
      <Lines lines={extra} color="var(--color-gold)" />
    </div>
  );
}

export function ItemImage({ item, ghost, lang }) {
  const style = ghost
    ? item.elsewhere.length
      ? { opacity: 0.55 }
      : { opacity: 0.25, filter: "grayscale(1)" }
    : item.ethereal
      ? { opacity: 0.6 }
      : undefined;
  return <img src={imageOf(item)} alt={labelOf(item.key, lang)} loading="lazy" className="w-full h-full object-contain" style={style} />;
}

// A W x H storage grid as in game. records: items in it, with x/y; ghosts: [{ key, code, x, y }] empty fixed slots.
export default function StashGrid({ width, height, records, ghosts = [], lang }) {
  const [tip, setTip] = useTip();
  const cell = (item, x, y, ghost) => {
    const { w, h } = items[item.code];
    const show = (e) => setTip({ item, ghost, rect: e.currentTarget.getBoundingClientRect() });
    return (
      <button
        type="button"
        key={ghost ? `ghost:${item.key}` : `${x}:${y}`}
        aria-label={labelOf(item.key, lang)}
        {...tipHandlers(show, setTip)}
        onClick={show}
        className="relative flex items-center justify-center"
        style={{
          gridColumn: `${x + 1} / span ${w}`,
          gridRow: `${y + 1} / span ${h}`,
          border: ghost ? `1px dashed ${item.elsewhere.length ? "var(--color-gold-dark)" : "#555"}` : `1px solid ${colorOf(item)}40`,
          background: ghost ? "transparent" : item.ethereal ? "rgba(120, 120, 170, 0.22)" : "rgba(30, 30, 40, 0.6)",
        }}
      >
        <ItemImage item={item} ghost={ghost} lang={lang} />
      </button>
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
