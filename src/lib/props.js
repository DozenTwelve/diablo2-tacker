// Catalog item properties ([code, param, min, max] from uniqueitems/setitems/runes.txt, see scripts/gen-data.mjs)
// as the stats a save holds ([statId, layer, value], see src/lib/stats.js), and as description lines with
// ranges: "+60-70% Enhanced Damage".
import data from "../data/stats.json";
import items from "../data/items.json";
import { describeStats, format, str } from "./stats";
import { t } from "./i18n";
import { catalog } from "./gameData";

const { stats, properties, skills, gems } = data;
const CLASSES = ["Amazon", "Sorceress", "Necromancer", "Paladin", "Barbarian", "Druid", "Assassin", "Warlock"];
const INDESTRUCTIBLE = 152;

// Stats for the lowest (pick 0) or highest (pick 1) roll. func is the properties.txt function:
// 1/2/8 roll a value, 3 copies the previous value (all resistances), 5/6/7 min/max/% damage,
// 10 skill tab (param 0-20, three per class), 11 skill on event, 15/16 use min/max, 17 use the param,
// 19 charges, 20 indestructible,
// 21 class (val) skills, 22/24 skill or monster (param). Random skills (12, 36) can't be shown as a range.
// A skill on event with level 0 takes it from the item level: (item level - skill's required level) / 3.9,
// lowest from lvl (the item's lowest level), highest from 99.
// ponytail: formula from the Phrozen Keep notes, checked on one save (Snowclash, item level 87 -> 16)
function propStats(props, pick, lvl = 1) {
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
        case 11: {
          const level = max || Math.max(1, Math.floor(((pick ? 99 : lvl) - (skills[par]?.req ?? 1)) / 3.9));
          entry = [stat, (par << 6) | level, min];
          break;
        }
        case 15: entry = [stat, 0, shift(min)]; break;
        case 16: entry = [stat, 0, shift(max)]; break;
        case 17: entry = [stat, 0, shift(par || roll)]; break; // per level: par in uniques, min/max in runes and sets
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

// "+60%" and "+70%" -> "+60-70%". Where that would read wrong, in a line with several numbers
// ("Adds 1-12" and "Adds 1-15") or with negatives, the range goes in parentheses: "Adds 1-(12~15)".
const NUMBER = /((?<!\d)-?\d+(?:\.\d+)?)/;
function merge(lo, hi) {
  if (lo === hi) return lo;
  const a = lo.split(NUMBER);
  const b = hi.split(NUMBER);
  if (a.length !== b.length) return hi;
  const several = a.length > 3;
  return a
    .map((part, i) => {
      if (i % 2 === 0 || part === b[i]) return part;
      return several || part.startsWith("-") || b[i].startsWith("-") ? `(${part}~${b[i]})` : `${part}-${b[i]}`;
    })
    .join("");
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

export function propLines(props, lang, lvl) {
  const special = props.filter(([code]) => SPECIAL[code]).map((prop) => SPECIAL[prop[0]](prop, lang));
  const lo = describeStats(propStats(props, 0, lvl), lang);
  const hi = describeStats(propStats(props, 1, lvl), lang);
  return [...special, ...(lo.length === hi.length ? lo.map((line, i) => merge(line, hi[i])) : hi)];
}

// Set bonuses ([[pieces worn, props]], see scripts/gen-data.mjs) as lines ending in "(2 Items)"
export const setBonusLines = (tiers = [], lang) =>
  tiers.flatMap(([pieces, props]) => propLines(props, lang).map((line) => `${line} ${t("setPieces", lang, pieces)}`));

// How good an owned copy's rolls are, 0-100: the mean position of each variable property within its range
// (one stat per property, so "all resistances" counts once), from what the item rolled itself: not what its
// runes, gems or jewels add (saves read before rolls were recorded have only stats). null when nothing on it
// can roll differently.
export function rollScore(record, props) {
  const have = new Map((record.rolls ?? record.stats).map(([id, layer, value]) => [`${id}:${layer}`, value]));
  const parts = [];
  for (const prop of props) {
    const [lo] = propStats([prop], 0);
    const [hi] = propStats([prop], 1);
    const value = lo && have.get(`${lo[0]}:${lo[1]}`);
    if (value == null || !hi || lo[2] === hi[2]) continue;
    parts.push(Math.min(1, Math.max(0, (value - lo[2]) / (hi[2] - lo[2]))));
  }
  return parts.length ? Math.round((parts.reduce((a, b) => a + b, 0) / parts.length) * 100) : null;
}

// rollScore of an owned copy against its catalog entry; a unique with several versions (Rainbow Facet) against
// its own version's ranges
export function copyScore(record) {
  const entry = catalog.get(record.key)?.names;
  return rollScore(record, entry?.variants?.[record.variant] ?? entry?.props ?? []);
}

// What a socketed rune or gem adds to the item it is in (gems.txt, by the item's slot), as stats;
// null for anything else (a jewel brings its own stats)
export const socketStats = (parentCode, childCode) => {
  const mods = gems[childCode]?.[items[parentCode]?.gemSlot];
  return mods ? propStats(mods, 0) : null;
};

// A runeword's lines: its own properties plus its runes' bonuses. When it can be made in different kinds of
// base (Spirit: swords and shields), the rune bonuses are listed per kind under a header.
export function runewordLines(word, lang) {
  const runeProps = (slot) => word.runes.flatMap((rune) => gems[rune]?.[slot] ?? []);
  if (word.slots.length === 1) return propLines([...word.props, ...runeProps(word.slots[0])], lang);
  return [...propLines(word.props, lang), ...word.slots.flatMap((slot) => [`— ${t(`${slot}Slot`, lang)} —`, ...propLines(runeProps(slot), lang)])];
}
