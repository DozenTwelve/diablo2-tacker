import { useState } from "react";
import { labelOf } from "../lib/gameData";
import { SLOT_OF } from "../lib/builds";
import { t } from "../lib/i18n";
import { colorOf, ItemImage, Tooltip, tipHandlers, useTip } from "./StashGrid";

// Equipment slots laid out as the in-game character screen, on an 8 x 7 cell grid: [column, row, width, height].
// Weapon set II (RightHand/LeftHand) takes the weapon and shield spots when switched to.
const SLOTS = {
  Head: [3, 0, 2, 2],
  Neck: [5, 1, 1, 1],
  RightArm: [0, 1, 2, 4],
  Torso: [3, 2, 2, 3],
  LeftArm: [6, 1, 2, 4],
  RightRing: [2, 5, 1, 1],
  Belt: [3, 5, 2, 1],
  LeftRing: [5, 5, 1, 1],
  Gloves: [0, 5, 2, 2],
  Feet: [6, 5, 2, 2],
};
const SWITCH = { RightArm: "RightHand", LeftArm: "LeftHand" };
const CELL = 44;

// records: equipped items (with slot); slots: which slots to draw (a mercenary has fewer);
// onSlot: called with the slot (RightHand/LeftHand for weapon set II) when one is clicked, instead of the tooltip
export default function Paperdoll({ records, slots = Object.keys(SLOTS), onSlot, lang }) {
  const [tip, setTip] = useTip();
  const [second, setSecond] = useState(false);
  const bySlot = new Map(records.map((r) => [r.slot, r]));
  const hasSwitch = Boolean(onSlot) || records.some((r) => r.slot === "RightHand" || r.slot === "LeftHand");

  return (
    <div className="w-full" style={{ maxWidth: 8 * CELL }}>
      {hasSwitch && (
        <div className="flex gap-2 mb-2">
          {["I", "II"].map((label, i) => (
            <button
              key={label}
              className={`gothic-tab-btn ${second === Boolean(i) ? "active" : ""}`}
              style={{ padding: "0.15rem 0.8rem" }}
              onClick={() => setSecond(Boolean(i))}
            >
              {label}
            </button>
          ))}
        </div>
      )}
      <div
        className="grid gap-1"
        style={{ gridTemplateColumns: "repeat(8, minmax(0, 1fr))", gridTemplateRows: "repeat(7, minmax(0, 1fr))", aspectRatio: "8 / 7" }}
      >
        {slots.map((slot) => {
          const [x, y, w, h] = SLOTS[slot];
          const shown = second && SWITCH[slot] ? SWITCH[slot] : slot;
          const item = bySlot.get(shown);
          const show = (e) => item && setTip({ item, rect: e.currentTarget.getBoundingClientRect() });
          return (
            <button
              type="button"
              key={slot}
              aria-label={`${t(`slot_${SLOT_OF[shown]}`, lang)}${item ? `${t("colon", lang)}${labelOf(item.key, lang)}` : ""}`}
              {...tipHandlers(show, setTip)}
              onClick={onSlot ? () => (setTip(null), onSlot(shown)) : show}
              className="flex items-center justify-center"
              style={{
                gridColumn: `${x + 1} / span ${w}`,
                gridRow: `${y + 1} / span ${h}`,
                background: "rgba(0, 0, 0, 0.55)",
                border: `1px solid ${item ? `${colorOf(item)}66` : "var(--color-border-metal)"}`,
              }}
            >
              {item && <ItemImage item={item} lang={lang} />}
            </button>
          );
        })}
      </div>
      {tip && <Tooltip tip={tip} lang={lang} />}
    </div>
  );
}
