// Generate src/data/*.json from D2R game tables extracted from CASC.
// Usage: node scripts/gen-data.mjs [gamedata dir]   (default: ~/Projects/Diablo2/d2r-gamedata)
// The dir must contain data/global/excel/*.txt and data/local/lng/strings/*.json.
import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const root = process.argv[2] ?? join(homedir(), "Projects/Diablo2/d2r-gamedata");
const excel = join(root, "data/global/excel");
const outDir = new URL("../src/data/", import.meta.url);

const table = (name) => {
  const [header, ...lines] = readFileSync(join(excel, `${name}.txt`), "utf8").split(/\r?\n/);
  const cols = header.split("\t");
  return lines.filter(Boolean).map((l) => Object.fromEntries(l.split("\t").map((v, i) => [cols[i], v])));
};

const strings = new Map();
for (const f of ["item-modifiers", "item-nameaffixes", "item-gems", "item-runes", "item-names"]) {
  const raw = readFileSync(join(root, `data/local/lng/strings/${f}.json`), "utf8").replace(/^﻿/, "");
  for (const s of JSON.parse(raw)) strings.set(s.Key, s);
}
const str = (key, lang) => {
  const v = strings.get(key)?.[lang];
  if (!v) throw new Error(`missing ${lang} string for "${key}"`);
  return v;
};

// Base item code -> item type, and item type -> parent types (Equiv1/Equiv2)
const baseType = new Map();
for (const t of ["armor", "weapons", "misc"]) for (const r of table(t)) baseType.set(r.code, r.type);
const equiv = new Map(table("itemtypes").map((r) => [r.Code, [r.Equiv1, r.Equiv2].filter(Boolean)]));

// Checked in order, so more specific types come first (grimoires are shields, javelins are thrown)
const CATEGORIES = [
  ["grim", "魔法书", "魔法書"], ["jave", "标枪", "標槍"], ["thro", "投掷武器", "投擲武器"], ["helm", "头盔", "頭盔"],
  ["tors", "护甲", "護甲"], ["shld", "盾牌", "盾牌"], ["glov", "手套", "手套"], ["boot", "鞋子", "鞋子"],
  ["belt", "腰带", "腰帶"], ["ring", "戒指", "戒指"], ["amul", "护身符", "護身符"], ["char", "神符", "咒符"],
  ["jewl", "珠宝", "珠寶"], ["h2h", "拳刃", "拳刃"], ["orb", "法珠", "法珠"], ["axe", "斧", "斧"],
  ["swor", "刀剑", "刀劍"], ["xbow", "弩", "弩"], ["bow", "弓", "弓"], ["pole", "长柄武器", "長柄武器"],
  ["spea", "长矛", "長矛"], ["staf", "法杖", "法杖"], ["knif", "匕首", "匕首"], ["hamm", "重锤", "重鎚"],
  ["wand", "魔杖", "魔杖"], ["scep", "权杖", "權杖"], ["mace", "钉锤", "釘鎚"], ["club", "短棒", "短棒"],
];
const ancestors = (type) => {
  const seen = new Set();
  const walk = (t) => !seen.has(t) && (seen.add(t), equiv.get(t)?.forEach(walk));
  walk(type);
  return seen;
};
const category = (code) => {
  const all = ancestors(baseType.get(code));
  const hit = CATEGORIES.find(([t]) => all.has(t));
  if (!hit) throw new Error(`no category for item code "${code}" (types: ${[...all]})`);
  return hit;
};

const names = (key) => ({ en: str(key, "enUS"), zh: str(key, "zhCN"), zh_tw: str(key, "zhTW") });

// Collections count what the in-game Chronicle tracks; other uniques (old Sunder charms, unused items)
// are kept as legacy so saves holding them still get names. One entry per name; variants (Rainbow Facet) keep all ids
const uniques = new Map();
for (const r of table("uniqueitems")) {
  if (!r["*ID"] || !r.code) continue;
  const id = Number(r["*ID"]);
  const legacy = r.disableChronicle === "1";
  const prev = uniques.get(r.index);
  if (prev) {
    prev.ids.push(id);
    prev.legacy &&= legacy;
  } else {
    const [, cn, tw] = category(r.code);
    uniques.set(r.index, { ids: [id], ...names(r.index), category: cn, category_tw: tw, legacy });
  }
}

const sets = new Map();
for (const r of table("setitems")) {
  if (!r["*ID"] || r.disableChronicle === "1") continue;
  if (!sets.has(r.set)) sets.set(r.set, { ...names(r.set), items: [] });
  sets.get(r.set).items.push({ id: Number(r["*ID"]), ...names(r.index) });
}

// id is the runes.txt row; a save's runeword_id maps to it as (runeword_id & 0xfff) - 27
const runewords = [];
table("runes").forEach((r, id) => {
  const recipe = [1, 2, 3, 4, 5, 6].map((i) => r[`Rune${i}`]).filter(Boolean);
  if (r.complete === "1") runewords.push({ id, ...names(r.Name), runes: recipe });
});

const runes = [];
for (let i = 1; i <= 33; i++) {
  const code = `r${String(i).padStart(2, "0")}`;
  const n = names(code);
  runes.push({ code, en: n.en.replace(/ Rune$/, ""), zh: n.zh.replace(/符文$/, ""), zh_tw: n.zh_tw.replace(/^符文：|符文$/g, "") });
}

// Every base item code -> name, for bases, gems, charms, rares and anything else found in saves
const items = {};
for (const t of ["armor", "weapons", "misc"]) {
  for (const r of table(t)) {
    const key = r.namestr || r.code;
    if (r.code && strings.has(key)) items[r.code] = names(key);
  }
}

// Stat descriptions (itemstatcost.txt) with every string they need, as [en, zh, zh_tw].
// Formatting lives in src/lib/stats.js.
for (const f of ["skills", "ui"]) {
  const raw = readFileSync(join(root, `data/local/lng/strings/${f}.json`), "utf8").replace(/^﻿/, "");
  for (const s of JSON.parse(raw)) if (!strings.has(s.Key)) strings.set(s.Key, s);
}
const statStrings = {};
const useString = (key) => {
  if (key && strings.has(key)) statStrings[key] = [str(key, "enUS"), str(key, "zhCN"), str(key, "zhTW")];
  return key || undefined;
};
const stats = {};
for (const r of table("itemstatcost")) {
  if (!r["*ID"] || !r.descfunc) continue;
  stats[r["*ID"]] = {
    priority: Number(r.descpriority),
    func: Number(r.descfunc),
    pos: useString(r.descstrpos),
    neg: useString(r.descstrneg),
    str2: useString(r.descstr2),
    shift: Number(r.ValShift) || undefined,
    // op 2-5: value is per character level, scaled by 2^(op param)
    perLevel: ["2", "3", "4", "5"].includes(r.op) ? Number(r["op param"]) : undefined,
    group: Number(r.dgrp) || undefined,
    groupPos: useString(r.dgrpstrpos),
  };
}
const playerClasses = table("playerclass").filter((r) => r.Code).map((r) => r.Code);
const classes = table("charstats")
  .filter((r) => r.class !== "Expansion")
  .map((r) => ({
    all: useString(r.StrAllSkills),
    tabs: [1, 2, 3].map((i) => useString(r[`StrSkillTab${i}`])),
    only: useString(r.StrClassOnly),
  }));
const skillDescs = new Map(table("skilldesc").map((r) => [r.skilldesc, r["str name"]]));
const skills = {};
for (const r of table("skills")) {
  const name = useString(skillDescs.get(r.skilldesc));
  if (r["*Id"] && name) skills[r["*Id"]] = { name, cls: r.charclass ? playerClasses.indexOf(r.charclass) : undefined };
}
// Damage pairs shown as one line: "<key>Range" for "Adds X-Y", "<key>" when min equals max
for (const key of ["strModMinDamage", "strModFireDamage", "strModColdDamage", "strModLightningDamage", "strModMagicDamage", "strModPoisonDamage"]) {
  useString(key);
  useString(`${key}Range`);
}
useString("strModEnhancedDamage");

const write = (name, data) => writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(data, null, 2) + "\n");
write("uniques", [...uniques.values()]);
write("sets", [...sets.values()]);
write("runewords", runewords);
write("runes", runes);
write("items", items);
write("stats", { stats, classes, skills, strings: statStrings });
console.log(`uniques ${uniques.size}, sets ${sets.size}, runewords ${runewords.length}, runes ${runes.length}, items ${Object.keys(items).length}, stats ${Object.keys(stats).length}, skills ${Object.keys(skills).length}`);
