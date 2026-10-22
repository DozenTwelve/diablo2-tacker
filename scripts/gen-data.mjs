// Generate src/data/*.json from D2R game tables extracted from CASC.
// Usage: node scripts/gen-data.mjs [gamedata dir]   (default: ~/Projects/Diablo2/d2r-gamedata)
// The dir must contain data/global/excel/*.txt, data/local/lng/strings/*.json, data/hd/items/{items,uniques,sets}.json
// and the icon sprites in data/hd/global/ui/items/<group>/<type>/*.sprite (only their names are read here).
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
  const raw = readFileSync(join(root, `data/local/lng/strings/${f}.json`), "utf8").replace(/^\uFEFF/, "");
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
  ["grim", "魔法书", "魔法書", "Grimoires", "마법서"], ["jave", "标枪", "標槍", "Javelins", "투창"],
  ["thro", "投掷武器", "投擲武器", "Throwing", "투척 무기"], ["helm", "头盔", "頭盔", "Helms", "투구"],
  ["tors", "护甲", "護甲", "Armor", "갑옷"], ["shld", "盾牌", "盾牌", "Shields", "방패"], ["glov", "手套", "手套", "Gloves", "장갑"],
  ["boot", "鞋子", "鞋子", "Boots", "장화"], ["belt", "腰带", "腰帶", "Belts", "허리띠"], ["ring", "戒指", "戒指", "Rings", "반지"],
  ["amul", "护身符", "護身符", "Amulets", "목걸이"], ["char", "神符", "咒符", "Charms", "부적"], ["jewl", "珠宝", "珠寶", "Jewels", "주얼"],
  ["h2h", "拳刃", "拳刃", "Claws", "클로"], ["orb", "法珠", "法珠", "Orbs", "오브"], ["axe", "斧", "斧", "Axes", "도끼"],
  ["swor", "刀剑", "刀劍", "Swords", "검"], ["xbow", "弩", "弩", "Crossbows", "석궁"], ["bow", "弓", "弓", "Bows", "활"],
  ["pole", "长柄武器", "長柄武器", "Polearms", "장병기"], ["spea", "长矛", "長矛", "Spears", "창"], ["staf", "法杖", "法杖", "Staves", "지팡이"],
  ["knif", "匕首", "匕首", "Daggers", "단검"], ["hamm", "重锤", "重鎚", "Hammers", "망치"], ["wand", "魔杖", "魔杖", "Wands", "마법봉"],
  ["scep", "权杖", "權杖", "Scepters", "홀"], ["mace", "钉锤", "釘鎚", "Maces", "철퇴"], ["club", "短棒", "短棒", "Clubs", "곤봉"],
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

// Languages kept, by the game's string column: Simplified and Traditional Chinese, English, Korean
const LANGS = { en: "enUS", zh: "zhCN", zh_tw: "zhTW", ko: "koKR" };
const names = (key) => Object.fromEntries(Object.entries(LANGS).map(([lang, column]) => [lang, str(key, column)]));

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
// are kept as legacy so saves holding them still get names. One entry per name; variants (Rainbow Facet) keep all ids,
// and their own props by id when they differ: { variants: { id: props } }
const uniques = new Map();
const uniqueOf = (r, legacy) => {
  const [, zh, zh_tw, en, ko] = category(r.code);
  return {
    code: r.code, img: imgOf(uniqueImg, r.index, r.code), ...names(r.index), category: { en, zh, zh_tw, ko }, legacy,
    lvl: Number(r.lvl) || 1, // lowest item level, for skills whose level comes from it (see src/lib/props.js)
    props: propsOf(r, ITEM_PROPS),
  };
};
for (const r of table("uniqueitems")) {
  if (!r["*ID"] || !r.code) continue;
  const id = Number(r["*ID"]);
  const legacy = r.disableChronicle === "1";
  const prev = uniques.get(r.index);
  if (prev) {
    prev.ids.push(id);
    // The Chronicle's row describes the item: Azurewrath is a Phase Blade, not the old Crystal Sword row
    if (prev.legacy && !legacy) Object.assign(prev, uniqueOf(r, legacy));
    else if (!legacy && JSON.stringify(propsOf(r, ITEM_PROPS)) !== JSON.stringify(prev.props))
      (prev.variants ??= { [prev.ids[0]]: prev.props })[id] = propsOf(r, ITEM_PROPS);
  } else uniques.set(r.index, { ids: [id], ...uniqueOf(r, legacy) });
}

// Set bonuses as [[pieces worn, props]]: an item's own (setitems aprop1-5, from 2 pieces; "add func" 1 means
// with specific other pieces instead, shown the same way; no "add func": always on, as the item's own props)
// and the set's (sets.txt PCode2-5), plus the full set's
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
// Set items outside the Chronicle (Warlord's) are kept as legacy, like uniques
const sets = new Map();
for (const r of table("setitems")) {
  if (!r["*ID"]) continue;
  if (!sets.has(r.set)) sets.set(r.set, { ...names(r.set), ...setBonus.get(r.set), legacy: true, items: [] });
  const set = sets.get(r.set);
  const legacy = r.disableChronicle === "1";
  set.legacy &&= legacy;
  const bonus = tiers(r, 2, (i) => ["a", "b"].map((x) => [`aprop${i}${x}`, `apar${i}${x}`, `amin${i}${x}`, `amax${i}${x}`]));
  const always = !r["add func"]; // Civerb's Cudgel, Trang-Oul's Claws
  set.items.push({
    id: Number(r["*ID"]), code: r.item, img: imgOf(setImg, r.index, r.item), ...names(r.index), legacy, lvl: Number(r.lvl) || 1,
    props: [...propsOf(r, ITEM_PROPS), ...(always ? bonus.flatMap(([, props]) => props) : [])],
    bonus: always ? [] : bonus,
  });
}

// Which gems.txt bonuses a socketed rune or gem gives: weapon, shield, or helm (also armor, belt...)
const gemSlotOf = (type) => {
  const all = ancestors(type);
  return all.has("weap") ? "weapon" : all.has("shld") ? "shield" : "helm";
};

// id is the runes.txt row; a save's runeword_id maps to it as (runeword_id & 0xfff) - 27.
// slots: which kinds of base it can be made in, for its runes' bonuses
const runewords = [];
table("runes").forEach((r, id) => {
  const recipe = [1, 2, 3, 4, 5, 6].map((i) => r[`Rune${i}`]).filter(Boolean);
  const slots = [...new Set(numbered(6, (i) => r[`itype${i}`]).filter(Boolean).map(gemSlotOf))];
  if (r.complete === "1") runewords.push({ id, ...names(r.Name), runes: recipe, slots, props: propsOf(r, RUNEWORD_PROPS) });
});

// Socketed rune and gem bonuses by slot (gems.txt)
const gems = {};
for (const r of table("gems")) {
  if (!r.code) continue;
  gems[r.code] = Object.fromEntries(
    ["weapon", "helm", "shield"].map((slot) => [
      slot,
      propsOf(r, numbered(3, (i) => [`${slot}Mod${i}Code`, `${slot}Mod${i}Param`, `${slot}Mod${i}Min`, `${slot}Mod${i}Max`])),
    ]),
  );
}

const runes = [];
for (let i = 1; i <= 33; i++) {
  const code = `r${String(i).padStart(2, "0")}`;
  const n = names(code);
  runes.push({
    code, en: n.en.replace(/ Rune$/, ""), zh: n.zh.replace(/符文$/, ""), zh_tw: n.zh_tw.replace(/^符文：|符文$/g, ""), ko: n.ko.replace(/ 룬$/, ""),
  });
}

// What new characters start with (charstats.txt item1-10): weapons, buckler, potions, scrolls
const starterCodes = new Set(table("charstats").flatMap((r) => numbered(10, (i) => r[`item${i}`]).filter((c) => c && c !== "0")));

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
        starter: starterCodes.has(r.code) || undefined,
        gemSlot: t === "misc" ? undefined : gemSlotOf(r.type),
      };
  }
}

// Stat descriptions (itemstatcost.txt) with every string they need, as [en, zh, zh_tw].
// Formatting lives in src/lib/stats.js.
for (const f of ["skills", "ui", "monsters"]) {
  const raw = readFileSync(join(root, `data/local/lng/strings/${f}.json`), "utf8").replace(/^\uFEFF/, "");
  for (const s of JSON.parse(raw)) if (!strings.has(s.Key)) strings.set(s.Key, s);
}
const statStrings = {};
const keepString = (key) => {
  if (key && strings.has(key)) statStrings[key] = Object.values(LANGS).map((column) => str(key, column));
  return key || undefined;
};
const stats = {};
for (const r of table("itemstatcost")) {
  if (!r["*ID"] || !r.descfunc) continue;
  stats[r["*ID"]] = {
    priority: Number(r.descpriority),
    func: Number(r.descfunc),
    pos: keepString(r.descstrpos),
    neg: keepString(r.descstrneg),
    str2: keepString(r.descstr2),
    shift: Number(r.ValShift) || undefined,
    // op 2-5: value is per character level, scaled by 2^(op param)
    perLevel: ["2", "3", "4", "5"].includes(r.op) ? Number(r["op param"]) : undefined,
    group: Number(r.dgrp) || undefined,
    groupPos: keepString(r.dgrpstrpos),
  };
}
const playerClasses = table("playerclass").filter((r) => r.Code).map((r) => r.Code);
const classes = table("charstats")
  .filter((r) => r.class !== "Expansion")
  .map((r) => ({
    all: keepString(r.StrAllSkills),
    tabs: [1, 2, 3].map((i) => keepString(r[`StrSkillTab${i}`])),
    only: keepString(r.StrClassOnly),
  }));
const skillDescs = new Map(table("skilldesc").map((r) => [r.skilldesc, r["str name"]]));
const skills = {};
for (const r of table("skills")) {
  const name = keepString(skillDescs.get(r.skilldesc));
  if (r["*Id"] && name) {
    skills[r["*Id"]] = { name, cls: r.charclass ? playerClasses.indexOf(r.charclass) : undefined, req: Number(r.reqlevel) || 1 };
  }
}
// Damage pairs shown as one line: "<key>Range" for "Adds X-Y", "<key>" when min equals max
for (const key of ["strModMinDamage", "strModFireDamage", "strModColdDamage", "strModLightningDamage", "strModMagicDamage", "strModPoisonDamage"]) {
  keepString(key);
  keepString(`${key}Range`);
}
keepString("strModEnhancedDamage");
// Random skill properties (skill-rand, randclassskill), which have no stat description of their own
keepString("ChronicleItemModifierClassSkillRandom");
keepString("ChronicleRandomClassSkillLevel");
// Repair rate shown as "Repairs 1 durability in N seconds" (item_replenish_durability, desc function 11)
keepString("ModStre9u");

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
// Monsters an item can reanimate targets as (the param of "reanimate"), by monstats.txt row
const monstats = table("monstats");
const monsters = {};
for (const props of [...uniques.values(), ...[...sets.values()].flatMap((s) => s.items), ...runewords].map((e) => e.props)) {
  for (const [code, par] of props) if (code === "reanimate") monsters[par] = keepString(monstats[par]?.NameStr);
}
write("stats", { stats, classes, skills, strings: statStrings, properties, gems, monsters });
console.log(`uniques ${uniques.size}, sets ${sets.size}, runewords ${runewords.length}, runes ${runes.length}, items ${Object.keys(items).length}, stats ${Object.keys(stats).length}, skills ${Object.keys(skills).length}`);
