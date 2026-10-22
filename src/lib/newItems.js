// What each new find on the inbox pages of the shared stash is worth, before organizing: the same rules as
// src/lib/organize.js (museum slots, the best copy in the museum, copies worth having, likely junk).
import { copiesNeeded, isJunk, modePrefix, museumLayout } from "./organize";
import { copyScore } from "./props";
import items from "../data/items.json";

const museums = new Map();
const museumSlots = (mode) => {
  const prefix = modePrefix(mode ?? "SoftCore:Modern");
  if (!museums.has(prefix)) museums.set(prefix, museumLayout(prefix).slots);
  return museums.get(prefix);
};

// The inbox pages' items: records on those shared stash pages of a mode's stash. inboxes: { mode: [page numbers] }
export function inboxItems(saveData, inboxes) {
  const modeOf = new Map(saveData.owners.map((o) => [o.name, o.mode]));
  return saveData.items.filter((r) => {
    const page = r.place.match(/^shared(\d+)$/)?.[1];
    return page && (inboxes[modeOf.get(r.owner)] ?? []).includes(Number(page));
  });
}

// One find's verdict: { kind, ... }, kind one of
//   new: nothing like it anywhere else; museum: owned elsewhere (worn...) but its museum slot is empty;
//   upgrade: better rolls than the museum copy { score, museum }; needed: a copy still worth having
//   { have, need, merc }; extra: past what is worth having, organizing puts it in TRASH { have, need };
//   junk: a magic charm or jewel that is likely junk; keep: one worth keeping; newRune: a rune type not owned yet;
//   other: anything else (runes, bases, rares...)
// all: every owned record (saveData.items); mode: the stash's game mode.
export function verdictOf(record, all, mode) {
  const others = all.filter((r) => r !== record && r.key === record.key);
  if (record.key.startsWith("r:")) return { kind: others.length ? "other" : "newRune" };
  if (/^[us]:/.test(record.key)) {
    const slot = museumSlots(mode).get(record.key);
    if (!slot) return { kind: others.length ? "other" : "new" }; // legacy items have no museum slot
    if (!others.length) return { kind: "new" };
    const inMuseum = others.find((r) => r.owner === slot.mule);
    if (!inMuseum) return { kind: "museum" };
    const score = copyScore(record);
    const museum = copyScore(inMuseum);
    if (score != null && museum != null && score > museum && record.ethereal === inMuseum.ethereal)
      return { kind: "upgrade", score, museum };
    const need = copiesNeeded(record.key);
    const merc = record.ethereal && need > 0 && ["weapons", "armor"].includes(items[record.code]?.table);
    if (merc && !others.some((r) => r.ethereal)) return { kind: "needed", have: others.length, need, merc };
    const plain = others.filter((r) => !r.ethereal).length;
    if (!record.ethereal && plain < need) return { kind: "needed", have: plain, need };
    return { kind: "extra", have: plain, need };
  }
  // isJunk reads a save item's quality and stats ({ id, value }); a record's stats are [id, layer, value]
  const asItem = { quality: record.quality, stats: record.stats.map(([id, , value]) => ({ id, value })) };
  if (record.quality === "Magic" && ["scha", "mcha", "lcha", "jewl"].includes(items[record.code]?.type))
    return { kind: isJunk(asItem, record.code) ? "junk" : "keep" };
  return { kind: "other" };
}

export const KINDS = ["new", "museum", "upgrade", "newRune", "needed", "keep", "extra", "junk", "other"];
