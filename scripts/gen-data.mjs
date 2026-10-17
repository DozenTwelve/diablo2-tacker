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
for (const f of ["item-names", "item-runes"]) {
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
  ["belt", "腰带", "腰帶"], ["ring", "戒指", "戒指"], ["amul", "护身符", "護身符"], ["char", "咒符", "咒符"],
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

// Include what the in-game Chronicle tracks. Uniques: one entry per name; variants (Rainbow Facet) keep all ids
const uniques = new Map();
for (const r of table("uniqueitems")) {
  if (!r["*ID"] || r.disableChronicle === "1") continue;
  const id = Number(r["*ID"]);
  const prev = uniques.get(r.index);
  if (prev) prev.ids.push(id);
  else {
    const [, cn, tw] = category(r.code);
    uniques.set(r.index, { ids: [id], category: cn, category_tw: tw, zh: str(r.index, "zhCN"), zh_tw: str(r.index, "zhTW"), en: str(r.index, "enUS") });
  }
}

const sets = {};
for (const r of table("setitems")) {
  if (!r["*ID"] || r.disableChronicle === "1") continue;
  const set = str(r.set, "enUS");
  sets[set] ??= { chinese_name: str(r.set, "zhCN"), zh_tw: str(r.set, "zhTW"), items: [] };
  sets[set].items.push({ id: Number(r["*ID"]), name: str(r.index, "enUS"), name_zh: str(r.index, "zhCN"), zh_tw: str(r.index, "zhTW") });
}

// id is the runes.txt row; a save's runeword_id maps to it as (runeword_id & 0xfff) - 27
const runewords = {};
table("runes").forEach((r, id) => {
  if (r.complete === "1") runewords[str(r.Name, "enUS")] = { id, 中文名: str(r.Name, "zhCN"), zh_tw: str(r.Name, "zhTW") };
});

const runes = {};
for (let i = 1; i <= 33; i++) {
  const key = `r${String(i).padStart(2, "0")}`;
  runes[str(key, "enUS").replace(/ Rune$/, "")] = { code: key, chinese_name: str(key, "zhCN").replace(/符文$/, ""), zh_tw: str(key, "zhTW").replace(/^符文：|符文$/g, "") };
}

const write = (name, data) => writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(data, null, 2) + "\n");
write("uniques", [...uniques.values()]);
write("sets", sets);
write("runewords", runewords);
write("runes", runes);
console.log(`uniques ${uniques.size}, sets ${Object.keys(sets).length}, runewords ${Object.keys(runewords).length}, runes ${Object.keys(runes).length}`);
