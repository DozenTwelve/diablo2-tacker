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

function ownerLabel(owner, lang) {
  if (owner.startsWith("ModernSharedStash")) return t("sharedStash", lang);
  if (owner.startsWith("SharedStash")) return t("legacyStash", lang);
  return owner;
}

function placeLabel(place, lang) {
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
