import { useState } from "react";
import items from "../data/items.json";
import { imageOf, keyOf, labelOf } from "../lib/gameData";
import { locationLines, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import { Tooltip } from "./StashGrid";

// Everything the stackable tab holds, in table order, split as the game groups it
const STACKABLE = Object.keys(items).filter((code) => items[code].stack);
const GEM_TYPES = new Set(["gema", "gemt", "gems", "geme", "gemr", "gemd", "gemz"]);
export const SECTIONS = [
  ["gems", STACKABLE.filter((c) => GEM_TYPES.has(items[c].type)), 5],
  ["runes", STACKABLE.filter((c) => items[c].type === "rune"), 11],
  ["materials", STACKABLE.filter((c) => items[c].type === "ques"), 10],
  ["potions", STACKABLE.filter((c) => items[c].type === "rpot"), 10],
];
const CELL = 44;

// Key of an item code as parseSaves records it (runes are r:<code>, the rest b:<code>:Normal)
const keyOfCode = (code) => keyOf({ quality: "Normal" }, code);

// Icon slots with counts; empty ones dimmed. byKey: key -> records (counts summed, locations in the tooltip).
// showWhere: list where the records are (for totals over all characters)
export default function StackTab({ byKey, sections = SECTIONS, showWhere = false, lang }) {
  const [tip, setTip] = useState(null);
  return (
    <div className="space-y-5">
      {sections.map(([name, codes, columns]) => (
        <div key={name}>
          <h4 className="gothic-text-gold text-sm mb-2">{t(name, lang)}</h4>
          <div className="grid gap-1" style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, ${CELL}px))` }}>
            {codes.map((code) => {
              const key = keyOfCode(code);
              const records = byKey.get(key) ?? [];
              const count = totalCount(records);
              const extra = !count
                ? [t("missing", lang)]
                : showWhere
                  ? locationLines(records, lang).map((l) => `${l.text} ×${l.count}`)
                  : [`×${count}`];
              const show = (e) =>
                setTip({ item: { key, code, quality: "Normal", stats: [] }, extra, rect: e.currentTarget.getBoundingClientRect() });
              return (
                <div
                  key={code}
                  onMouseEnter={show}
                  onMouseLeave={() => setTip(null)}
                  onClick={show}
                  className="relative aspect-square"
                  style={{ background: "rgba(0, 0, 0, 0.55)", border: "1px solid var(--color-border-metal)" }}
                >
                  <img
                    src={imageOf({ key, code })}
                    alt={labelOf(key, lang)}
                    loading="lazy"
                    className="w-full h-full object-contain"
                    style={count ? undefined : { opacity: 0.2, filter: "grayscale(1)" }}
                  />
                  {count > 0 && (
                    <span
                      className="absolute right-0.5 bottom-0 text-xs gothic-text-gold"
                      style={{ textShadow: "0 0 3px #000, 0 0 3px #000" }}
                    >
                      {count}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ))}
      {tip && <Tooltip tip={tip} lang={lang} />}
    </div>
  );
}
