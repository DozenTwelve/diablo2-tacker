// Helpers over the owned item list from parseSaves.
import { t } from "./i18n";

export function groupByKey(items) {
  const map = new Map();
  for (const it of items) {
    if (!map.has(it.key)) map.set(it.key, []);
    map.get(it.key).push(it);
  }
  return map;
}

export const totalCount = (records = []) => records.reduce((n, r) => n + r.count, 0);

function ownerLabel(owner, lang) {
  if (owner.startsWith("ModernSharedStash")) return t("sharedStash", lang);
  if (owner.startsWith("SharedStash")) return t("legacyStash", lang);
  return owner;
}

function placeLabel(place, lang) {
  const page = place.match(/^shared(\d+)$/);
  return page ? t("sharedPage", lang, page[1]) : t(place, lang);
}

// Identical copies in the same spot collapse into one line with a count.
export function locationLines(records, lang) {
  const lines = new Map();
  for (const r of records) {
    const details = [r.ethereal && t("ethereal", lang), r.sockets > 0 && t("sockets", lang, r.sockets)].filter(Boolean);
    const text = [ownerLabel(r.owner, lang), placeLabel(r.place, lang), ...details].join(" · ");
    lines.set(text, (lines.get(text) ?? 0) + r.count);
  }
  return [...lines].map(([text, count]) => ({ text, count }));
}
