// Generate src/data/*.json from D2R game tables extracted from CASC.
// Usage: node scripts/gen-data.mjs [gamedata dir]   (default: ~/Projects/Diablo2/d2r-gamedata)
// The dir must contain data/global/excel/*.txt and data/local/lng/strings/*.json.
import { readdirSync, readFileSync, writeFileSync } from "node:fs";
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

// Item properties as [property code, param, min, max], the param as a skill id when it names a skill.
// src/lib/props.js turns them into stats with the property definitions (stats.json "properties").
const skillIds = new Map(table("skills").map((r) => [r.skill.toLowerCase(), Number(r["*Id"])]));
const paramOf = (par) => (!par ? 0 : skillIds.get(par.toLowerCase()) ?? (Number.isNaN(Number(par)) ? par : Number(par)));
const propsOf = (r, columns) =>
  columns
    .filter(([prop]) => r[prop])
    .map(([prop, par, min, max]) => [r[prop].toLowerCase(), paramOf(r[par]), Number(r[min]) || 0, Number(r[max]) || 0]);
const numbered = (n, f) => Array.from({ length: n }, (_, i) => f(i + 1));
const ITEM_PROPS = numbered(12, (i) => [`prop${i}`, `par${i}`, `min${i}`, `max${i}`]);
const RUNEWORD_PROPS = numbered(7, (i) => [`T1Code${i}`, `T1Param${i}`, `T1Min${i}`, `T1Max${i}`]);

// Inventory icon assets (public/items/<asset>.webp, see scripts/gen-images.mjs): by base code, and by unique
// and set item index in snake case ("Fechmar's Axe" -> fechmars_axe). The few named otherwise use their base's icon
const hdItems = (name) =>
  Object.assign({}, ...JSON.parse(readFileSync(join(root, `data/hd/items/${name}.json`), "utf8").replace(/^\uFEFF/, "")));
const baseImg = Object.fromEntries(Object.entries(hdItems("items")).map(([code, v]) => [code, v.asset]));
const uniqueImg = hdItems("uniques");
const setImg = hdItems("sets");
const snake = (index) => index.toLowerCase().replace(/'/g, "").replace(/[^a-z0-9]+/g, "_");
// Some assets are relative paths ("../misc/body_part/fragment_fire"); icons are stored by their last two parts
// Rings, amulets, charms and jewels have numbered looks ("ring/ring1"...), picked per item by its gfx id
const spriteDir = join(root, "data/hd/global/ui/items");
const sprites = new Set(
  readdirSync(spriteDir).flatMap((g) => readdirSync(join(spriteDir, g)).flatMap((sub) => readdirSync(join(spriteDir, g, sub)).map((f) => `${sub}/${f.replace(/\.sprite$/, "")}`))),
);
const variantsOf = (asset) => {
  let n = 0;
  while (sprites.has(`${asset}${n + 1}`)) n++;
  return n || undefined;
};
const imgOf = (table, index, code) => (table[snake(index)]?.normal ?? baseImg[code]).split("/").slice(-2).join("/");

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
    uniques.set(r.index, {
      ids: [id], code: r.code, img: imgOf(uniqueImg, r.index, r.code), ...names(r.index), category: cn, category_tw: tw, legacy,
      props: propsOf(r, ITEM_PROPS),
    });
  }
}

// Set bonuses as [[pieces worn, props]]: an item's own (setitems aprop1-5, from 2 pieces; "add func" 1 means
// with specific other pieces instead, shown the same way) and the set's (sets.txt PCode2-5), plus the full set's
const tiers = (r, from, columns) =>
  numbered(5, (i) => [i + from - 1, propsOf(r, columns(i))]).filter(([, props]) => props.length);
const setBonus = new Map(
  table("sets").map((r) => [
    r.index,
    {
      bonus: tiers(r, 2, (i) => ["a", "b"].map((x) => [`PCode${i + 1}${x}`, `PParam${i + 1}${x}`, `PMin${i + 1}${x}`, `PMax${i + 1}${x}`])),
      full: propsOf(r, numbered(8, (i) => [`FCode${i}`, `FParam${i}`, `FMin${i}`, `FMax${i}`])),
    },
  ]),
);
const sets = new Map();
for (const r of table("setitems")) {
  if (!r["*ID"] || r.disableChronicle === "1") continue;
  if (!sets.has(r.set)) sets.set(r.set, { ...names(r.set), ...setBonus.get(r.set), items: [] });
  sets.get(r.set).items.push({
    id: Number(r["*ID"]), code: r.item, img: imgOf(setImg, r.index, r.item), ...names(r.index), props: propsOf(r, ITEM_PROPS),
    bonus: tiers(r, 2, (i) => ["a", "b"].map((x) => [`aprop${i}${x}`, `apar${i}${x}`, `amin${i}${x}`, `amax${i}${x}`])),
  });
}

// id is the runes.txt row; a save's runeword_id maps to it as (runeword_id & 0xfff) - 27
const runewords = [];
table("runes").forEach((r, id) => {
  const recipe = [1, 2, 3, 4, 5, 6].map((i) => r[`Rune${i}`]).filter(Boolean);
  if (r.complete === "1") runewords.push({ id, ...names(r.Name), runes: recipe, props: propsOf(r, RUNEWORD_PROPS) });
});

const runes = [];
for (let i = 1; i <= 33; i++) {
  const code = `r${String(i).padStart(2, "0")}`;
  const n = names(code);
  runes.push({ code, en: n.en.replace(/ Rune$/, ""), zh: n.zh.replace(/符文$/, ""), zh_tw: n.zh_tw.replace(/^符文：|符文$/g, "") });
}

// Every base item code -> name, for bases, gems, charms, rares and anything else found in saves.
// Also its table, item type, inventory size (w x h cells) and icon, in table order, for laying out mules and stashes
const items = {};
for (const t of ["armor", "weapons", "misc"]) {
  for (const r of table(t)) {
    const key = r.namestr || r.code;
    if (r.code && strings.has(key))
      items[r.code] = {
        ...names(key), table: t, type: r.type, w: Number(r.invwidth) || 1, h: Number(r.invheight) || 1,
        img: baseImg[r.code], variants: variantsOf(baseImg[r.code]),
        stack: r.AdvancedStashStackable === "1" || undefined, // goes in the stackable tab
      };
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
// Random skill properties (skill-rand, randclassskill), which have no stat description of their own
useString("ChronicleItemModifierClassSkillRandom");
useString("ChronicleRandomClassSkillLevel");

const write = (name, data) => writeFileSync(new URL(`${name}.json`, outDir), JSON.stringify(data, null, 2) + "\n");
write("uniques", [...uniques.values()]);
write("sets", [...sets.values()]);
write("runewords", runewords);
write("runes", runes);
write("items", items);
// Property code -> what it sets: [[func, stat id, val]] (properties.txt; func semantics in src/lib/props.js)
const statIds = new Map(table("itemstatcost").map((r) => [r.Stat, Number(r["*ID"])]));
const properties = {};
for (const r of table("properties")) {
  if (r.code) properties[r.code.toLowerCase()] = numbered(7, (i) => r[`func${i}`] && [Number(r[`func${i}`]), statIds.get(r[`stat${i}`]) ?? null, Number(r[`val${i}`]) || 0]).filter(Boolean);
}
write("stats", { stats, classes, skills, strings: statStrings, properties });
console.log(`uniques ${uniques.size}, sets ${sets.size}, runewords ${runewords.length}, runes ${runes.length}, items ${Object.keys(items).length}, stats ${Object.keys(stats).length}, skills ${Object.keys(skills).length}`);
