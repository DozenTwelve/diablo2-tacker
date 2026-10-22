// Helpers over the owned item list from parseSaves.
import { t } from "./i18n";
import { describeStats } from "./stats";

export function groupByKey(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.key)) map.set(it.key, []);
    map.get(it.key).push(it);
  }
  return map;
}

export const totalCount = (records = []) => records.reduce((n, r) => n + r.count, 0);

export function ownerLabel(owner, lang) {
  const hardcore = /HardCore/i.test(owner) ? ` · ${t("hardcore", lang)}` : "";
  if (owner.startsWith("ModernSharedStash")) return t("sharedStash", lang) + hardcore;
  if (owner.startsWith("SharedStash")) return t("legacyStash", lang) + hardcore;
  return owner;
}

export function placeLabel(place, lang) {
  const page = place.match(/^shared(\d+)$/);
  return page ? t("sharedPage", lang, page[1]) : t(place, lang);
}

// Saves loaded before stats were recorded have none
export const statLines = (record, lang) => describeStats(record.stats ?? [], lang);

// Copies in the same spot with identical stats collapse into one line with a count.
export function locationLines(records, lang) {
  const lines = new Map();
  for (const r of records) {
    const details = [r.ethereal && t("ethereal", lang), r.sockets > 0 && t("sockets", lang, r.sockets)].filter(Boolean);
    const text = [ownerLabel(r.owner, lang), placeLabel(r.place, lang), ...details].join(" · ");
    const stats = statLines(r, lang);
    const key = [text, ...stats].join("\n");
    const line = lines.get(key) ?? { text, stats, count: 0 };
    line.count += r.count;
    lines.set(key, line);
  }
  return [...lines.values()];
}

// A character is a mule or a main character as the player marked it (roles, see CharacterView), else by level 1 or not
export const roleOf = (o, roles) => roles[o.name] ?? (o.level > 1 ? "main" : "mule");

// Owners from saveData; saves loaded before owners were recorded only have item owners
export const ownersOf = (saveData) =>
  saveData.owners ?? [...new Set(saveData.items.map((i) => i.owner))].map((name) => ({ name }));

// One owner's items as place groups in a fixed order, identical items collapsed with a count.
const PLACE_ORDER = ["equipped", "merc", "corpse", "inventory", "belt", "cube", "stash", "advanced"];
const placeRank = (place) => {
  const i = PLACE_ORDER.indexOf(place);
  if (i >= 0) return i;
  const page = place.match(/^shared(\d+)$/);
  return page ? PLACE_ORDER.length + Number(page[1]) : 100;
};

export function itemsByPlace(items, owner, lang) {
  const places = new Map();
  for (const r of items) {
    if (r.owner !== owner) continue;
    const stats = statLines(r, lang);
    const id = [r.key, r.ethereal, r.sockets, ...stats].join("\n");
    if (!places.has(r.place)) places.set(r.place, new Map());
    const lines = places.get(r.place);
    const line = lines.get(id) ?? { record: r, stats, count: 0 };
    line.count += r.count;
    lines.set(id, line);
  }
  return [...places]
    .sort(([a], [b]) => placeRank(a) - placeRank(b))
    .map(([place, lines]) => ({ place, lines: [...lines.values()] }));
}
