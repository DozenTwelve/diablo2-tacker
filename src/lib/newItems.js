// What each new find on the inbox pages of the shared stash is worth, before organizing. Unique and set items are
// placed by organizing's own placeCopies over what organizing would take (the mode's mules and inbox pages), so the
// verdict is what organizing will do; charms and jewels by isJunk.
import { copiesNeeded, isJunk, modePrefix, museumLayout, placeCopies } from "./organize";
import { copyScore } from "./props";
import { ownersOf, roleOf } from "./inventory";
import items from "../data/items.json";

const museums = new Map();
const museumSlots = (mode) => {
  const prefix = modePrefix(mode ?? "SoftCore:Modern");
  if (!museums.has(prefix)) museums.set(prefix, museumLayout(prefix).slots);
  return museums.get(prefix);
};

const pagesOf = (inboxes, mode) => (Array.isArray(inboxes?.[mode]) ? inboxes[mode] : []); // a stored value may be anything

// The inbox pages' items: records on those shared stash pages of a mode's stash. inboxes: { mode: [page numbers] }
export function inboxItems(saveData, inboxes) {
  const modeOf = new Map(ownersOf(saveData).map((o) => [o.name, o.mode]));
  return saveData.items.filter((r) => {
    const page = r.place.match(/^shared(\d+)$/)?.[1];
    return page && pagesOf(inboxes, modeOf.get(r.owner)).includes(Number(page));
  });
}

// Every find with its verdict: [{ r, verdict: { kind, ... } }], kind one of
//   new: nothing like it anywhere; museum: owned elsewhere but organizing puts this one in its empty museum slot;
//   upgrade: organizing swaps it into the museum { score, museum }; needed: a duplicate organizing keeps in DUP
//   { have, need, merc }; extra: organizing puts it in TRASH { have, need, merc }; junk / keep: a magic charm or
//   jewel that is likely junk / worth keeping; newRune: a rune type not owned yet; other: anything else.
// roles: the Characters page's main/mule choice (roleOf), as the Organize page passes it.
export function findsOf(saveData, inboxes, roles = {}) {
  const owners = ownersOf(saveData);
  const finds = inboxItems(saveData, inboxes);
  const verdicts = new Map();
  for (const mode of new Set(finds.map((r) => owners.find((o) => o.name === r.owner)?.mode))) {
    // What organizing this mode takes: its living mules and its inbox pages, not items inside other items
    const mules = new Set(owners.filter((o) => o.cls && o.mode === mode && !o.dead && roleOf(o, roles) === "mule").map((o) => o.name));
    const inbox = new Set(finds.filter((r) => owners.find((o) => o.name === r.owner)?.mode === mode));
    const slots = museumSlots(mode);
    // In organizing's order, which settles ties: the mules by name, each as read, then the inbox pages
    const index = new Map(saveData.items.map((r, i) => [r, i]));
    const copies = saveData.items
      .filter((r) => /^[us]:/.test(r.key) && r.place !== "socketed" && (mules.has(r.owner) || inbox.has(r)))
      .sort((a, b) => inbox.has(a) - inbox.has(b) || a.owner.localeCompare(b.owner) || index.get(a) - index.get(b))
      .map((r) => ({ r, key: r.key, code: r.code, eth: r.ethereal, score: copyScore(r) ?? -1, home: r.owner === slots.get(r.key)?.mule }));
    const where = placeCopies(copies, slots);
    const kept = (key, but) => copies.filter((c) => c.key === key && c.r !== but && where.get(c) !== "TRASH").length;
    for (const c of copies.filter((c) => inbox.has(c.r))) {
      const r = c.r;
      const elsewhere = saveData.items.some((o) => o !== r && o.key === r.key);
      const need = copiesNeeded(r.key);
      const group = where.get(c);
      let verdict;
      if (!slots.has(r.key)) verdict = { kind: elsewhere ? "other" : "new" }; // legacy items have no museum slot
      else if (group === "MUSEUM") {
        const now = copies.find((o) => o.key === r.key && o.home);
        verdict = !elsewhere ? { kind: "new" } : now ? { kind: "upgrade", score: c.score, museum: now.score } : { kind: "museum" };
      } else verdict = { kind: group === "DUP" ? "needed" : "extra", have: kept(r.key, r), need, merc: r.ethereal };
      verdicts.set(r, verdict);
    }
  }
  return finds.map((r) => ({ r, verdict: verdicts.get(r) ?? otherVerdict(r, saveData.items) }));
}

// Finds that are not unique or set items: runes, charms and jewels, the rest
function otherVerdict(record, all) {
  if (record.key.startsWith("r:")) return { kind: all.some((o) => o !== record && o.key === record.key) ? "other" : "newRune" };
  // isJunk reads a save item's quality and stats ({ id, value }); a record's stats are [id, layer, value]
  const asItem = { quality: record.quality, stats: record.stats.map(([id, , value]) => ({ id, value })) };
  if (record.quality === "Magic" && ["scha", "mcha", "lcha", "jewl"].includes(items[record.code]?.type))
    return { kind: isJunk(asItem, record.code) ? "junk" : "keep" };
  return { kind: "other" };
}

export const KINDS = ["new", "museum", "upgrade", "newRune", "needed", "keep", "extra", "junk", "other"];
