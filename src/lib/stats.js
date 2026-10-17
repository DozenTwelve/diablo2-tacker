// Turn item stats from a save ([statId, layer, value]) into the lines the game shows,
// using the descriptions from itemstatcost.txt (src/data/stats.json, see scripts/gen-data.mjs).
import data from "../data/stats.json";

const { stats, classes, skills, strings } = data;
const LANG_INDEX = { en: 0, zh: 1, zh_tw: 2 };
const str = (key, lang) => strings[key]?.[LANG_INDEX[lang]] ?? "";

// The printf subset D2R strings use: %d %+d %s %%. Pre-formatted string args are inserted as is.
function format(template, args) {
  let i = 0;
  return template.replace(/%(\+?)([ds%])/g, (_, plus, type) => {
    if (type === "%") return "%";
    const v = args[i++];
    if (type === "s" || typeof v === "string") return v ?? "";
    return plus && v >= 0 ? `+${v}` : String(v);
  });
}

const skillName = (id, lang) => str(skills[id]?.name, lang) || `#${id}`;

function describe(id, layer, value, lang) {
  const stat = stats[id];
  if (!stat?.pos) return null;
  const v = stat.shift ? value >> stat.shift : value;
  const template = str(v < 0 && stat.neg ? stat.neg : stat.pos, lang);
  switch (stat.func) {
    case 5: return format(template, [Math.floor((v * 100) / 128)]);
    case 13: return format(str(classes[layer]?.all, lang), [v]);
    // layer is class * 8 + tab
    case 14: return format(str(classes[layer >> 3]?.tabs[layer & 7], lang), [v]);
    // skill events and charges pack (skill << 6) | level into layer
    case 15: return format(template, [v, layer & 63, skillName(layer >> 6, lang)]);
    case 24: return format(template, [layer & 63, skillName(layer >> 6, lang), v & 255, v >> 8]);
    case 16: return format(template, [v, skillName(layer, lang)]);
    case 27: return format(template, [v, skillName(layer, lang), str(classes[skills[layer]?.cls]?.only, lang)]);
    case 28: return format(template, [v, skillName(layer, lang)]);
  }
  if (stat.perLevel != null) {
    const per = v / 2 ** stat.perLevel;
    return `${format(template, [`${per >= 0 ? "+" : ""}${per}/Lv`])} ${str(stat.str2, lang)}`;
  }
  return format(template, [v]);
}

// Min/max stat pairs the game shows as one line: "Adds X-Y" (<key>Range), or "+X" when equal
const RANGES = [
  [21, 22, "strModMinDamage"],
  [48, 49, "strModFireDamage"],
  [54, 55, "strModColdDamage"],
  [50, 51, "strModLightningDamage"],
  [52, 53, "strModMagicDamage"],
];
const range = (key, min, max, lang, ...rest) =>
  min === max ? format(str(key, lang), [min, ...rest]) : format(str(`${key}Range`, lang), [min, max, ...rest]);
// Two-handed / thrown copies of min/max damage, shown once
const DUPLICATE_DAMAGE = [23, 24, 159, 160];

const groupMembers = {};
for (const [id, s] of Object.entries(stats)) if (s.group) (groupMembers[s.group] ??= []).push(Number(id));

export function describeStats(list, lang) {
  const byId = new Map(list.map(([id, layer, value]) => [`${id}:${layer}`, value]));
  const get = (id) => byId.get(`${id}:0`);
  const lines = [];
  const take = (ids, priorityOf, text) => {
    ids.forEach((id) => byId.delete(`${id}:0`));
    lines.push({ priority: stats[priorityOf]?.priority ?? 0, text });
  };

  for (const [min, max, key] of RANGES) {
    if (get(min) != null && get(max) != null) take([min, max], max, range(key, get(min), get(max), lang));
  }
  if (get(21) != null || get(22) != null) DUPLICATE_DAMAGE.forEach((id) => byId.delete(`${id}:0`));
  if (get(57) != null && get(58) != null && get(59) != null) {
    // poison damage is stored per frame; the game shows the total over its length (25 frames/s)
    const len = get(59);
    const total = (n) => Math.round((n * len) / 256);
    take([57, 58, 59], 57, range("strModPoisonDamage", total(get(57)), total(get(58)), lang, Math.round(len / 25)));
  }
  if (get(17) != null && get(17) === get(18)) take([17, 18], 17, format(str("strModEnhancedDamage", lang), [get(17)]));
  // All attributes / all resistances when every member has the same value
  for (const ids of Object.values(groupMembers)) {
    const values = ids.map(get);
    if (values[0] != null && values.every((x) => x === values[0])) {
      take(ids, ids[0], format(str(stats[ids[0]].groupPos, lang), [values[0]]));
    }
  }

  for (const [key, value] of byId) {
    const [id, layer] = key.split(":").map(Number);
    const text = describe(id, layer, value, lang);
    if (text) lines.push({ priority: stats[id].priority, text });
  }
  return lines.sort((a, b) => b.priority - a.priority).map((l) => l.text);
}
