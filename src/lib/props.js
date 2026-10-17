// Catalog item properties ([code, param, min, max] from uniqueitems/setitems/runes.txt, see scripts/gen-data.mjs)
// as the stats a save holds ([statId, layer, value], see src/lib/stats.js), and as description lines with
// ranges: "+60-70% Enhanced Damage".
import data from "../data/stats.json";
import { describeStats, format, str } from "./stats";
import { t } from "./i18n";

const { stats, properties, skills } = data;
const CLASSES = ["Amazon", "Sorceress", "Necromancer", "Paladin", "Barbarian", "Druid", "Assassin", "Warlock"];
const INDESTRUCTIBLE = 152;

// Stats for the lowest (pick 0) or highest (pick 1) roll. func is the properties.txt function:
// 1/2/8 roll a value, 3 copies the previous value (all resistances), 5/6/7 min/max/% damage,
// 10 skill tab (param 0-20, three per class), 11 skill on event, 15/16 use min/max, 17 use the param,
// 19 charges, 20 indestructible,
// 21 class (val) skills, 22/24 skill or monster (param). Random skills (12, 36) can't be shown as a range.
export function propStats(props, pick) {
  const out = [];
  for (const [code, par, min, max] of props) {
    if (typeof par === "string") continue; // a param naming no skill (e.g. a visual state)
    const roll = pick ? max : min;
    let prev;
    for (const [func, stat, val] of properties[code] ?? []) {
      const shift = (v) => (stats[stat]?.shift ? v * 2 ** stats[stat].shift : v);
      let entry;
      switch (func) {
        case 1: case 2: case 8: case 14: entry = [stat, 0, shift(roll)]; break;
        case 3: entry = prev && [stat, prev[1], prev[2]]; break;
        case 5: entry = [21, 0, roll]; break;
        case 6: entry = [22, 0, roll]; break;
        case 7: out.push([18, 0, roll]); entry = [17, 0, roll]; break;
        case 10: entry = [stat, (Math.floor(par / 3) << 3) | par % 3, roll]; break;
        case 11: entry = [stat, (par << 6) | max, min]; break;
        case 15: entry = [stat, 0, shift(min)]; break;
        case 16: entry = [stat, 0, shift(max)]; break;
        case 17: entry = [stat, 0, shift(par)]; break;
        case 19: entry = [stat, (par << 6) | max, min | (min << 8)]; break;
        case 20: entry = [INDESTRUCTIBLE, 0, 1]; break;
        case 21: entry = [stat, val, roll]; break;
        case 22: case 24: entry = [stat, par, roll]; break;
      }
      if (entry) out.push((prev = entry));
    }
  }
  return out;
}

// "+60%" and "+70%" -> "+60-70%": numbers that differ become ranges
function merge(lo, hi) {
  if (lo === hi) return lo;
  const a = lo.split(/(\d+)/);
  const b = hi.split(/(\d+)/);
  if (a.length !== b.length) return hi;
  return a.map((part, i) => (i % 2 && part !== b[i] ? `${part}-${b[i]}` : part)).join("");
}

// Properties shown without a stat: sockets (min-max, or the param), ethereal, random skills
const span = (min, max) => (min === max ? min : `${min}-${max}`);
const SPECIAL = {
  sock: ([, par, min, max], lang) => t("sockets", lang, min || max ? span(min, max) : par),
  ethereal: (prop, lang) => t("ethereal", lang),
  // +level to a random skill among skill ids min-max, all of one class
  "skill-rand": ([, par, min], lang) =>
    format(str("ChronicleItemModifierClassSkillRandom", lang), [par, t(CLASSES[skills[min]?.cls], lang), ""]).trim(),
  randclassskill: ([code], lang) => format(str("ChronicleRandomClassSkillLevel", lang), [properties[code][0][2]]),
};

export function propLines(props, lang) {
  const special = props.filter(([code]) => SPECIAL[code]).map((prop) => SPECIAL[prop[0]](prop, lang));
  const lo = describeStats(propStats(props, 0), lang);
  const hi = describeStats(propStats(props, 1), lang);
  return [...special, ...(lo.length === hi.length ? lo.map((line, i) => merge(line, hi[i])) : hi)];
}

// Set bonuses ([[pieces worn, props]], see scripts/gen-data.mjs) as lines ending in "(2 Items)"
export const setBonusLines = (tiers = [], lang) =>
  tiers.flatMap(([pieces, props]) => propLines(props, lang).map((line) => `${line} ${t("setPieces", lang, pieces)}`));

// How good an owned copy's rolls are, 0-100: the mean position of its variable stats within their ranges.
// null when nothing on it can roll differently.
export function rollScore(record, props) {
  const key = ([id, layer]) => `${id}:${layer}`;
  const lo = new Map(propStats(props, 0).map((s) => [key(s), s[2]]));
  const hi = new Map(propStats(props, 1).map((s) => [key(s), s[2]]));
  const parts = record.stats
    .filter((s) => lo.has(key(s)) && lo.get(key(s)) !== hi.get(key(s)))
    .map((s) => Math.min(1, Math.max(0, (s[2] - lo.get(key(s))) / (hi.get(key(s)) - lo.get(key(s))))));
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null;
}
