// Rearrange every mule item into numbered mules, from saves parsed by the WASM wrapper (wasm/).
// Level 1 characters are mules: they are emptied (their starting kit is dropped) and everything goes
// into new mules cloned from a level 1 Barbarian. Other characters are not touched. Shared stash
// pages are emptied into the mules too; the stackable page is left alone.
// Uniques and set items get fixed slots laid out from the whole catalog, so an empty slot is one not
// owned yet. Extra copies, runewords, charms, jewels, rings and amulets, other magic/rare items, bases
// and the rest are packed into their own mules.
import { uniques, sets, uniqueKey, setItemKey, keyOf, codeOfNumber } from "./gameData";
import items from "../data/items.json";

const GRIDS = [["Stash", 10, 10], ["Inventory", 10, 4]];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const GOLD_STATS = new Set([14, 15]);
const STARTER_SCROLLS = new Set(["tsc", "isc"]);

// Item type first, then table row (normal, exceptional, elite), so similar items end up together
const rowOf = new Map(Object.keys(items).map((code, i) => [code, i]));
const typeRank = new Map();
for (const it of Object.values(items)) if (!typeRank.has(it.type)) typeRank.set(it.type, typeRank.size);
const byOrder = (a, b) => typeRank.get(items[a].type) - typeRank.get(items[b].type) || rowOf.get(a) - rowOf.get(b);

const emptyMule = () => GRIDS.map(([page, W, H]) => ({ page, W, H, used: Array.from({ length: H }, () => Array(W).fill(false)) }));

function place(mule, w, h) {
  for (const g of mule) {
    for (let x = 0; x + w <= g.W; x++) {
      for (let y = 0; y + h <= g.H; y++) {
        const cells = [];
        for (let i = 0; i < w; i++) for (let j = 0; j < h; j++) cells.push([x + i, y + j]);
        if (cells.some(([i, j]) => g.used[j][i])) continue;
        cells.forEach(([i, j]) => (g.used[j][i] = true));
        return { page: g.page, x, y };
      }
    }
  }
  return null;
}

// Fill mules PREFIX-A, PREFIX-B... in order; a unit (one item, or a whole set) never spans two mules.
// Units are [{ ref, code }]; returns [{ name, slots: [{ ref, page, x, y }] }].
function pack(prefix, units) {
  const mules = [];
  let grid;
  const open = () => {
    if (mules.length === LETTERS.length) throw new Error(`more than ${LETTERS.length} ${prefix} mules`);
    grid = emptyMule();
    mules.push({ name: `${prefix}-${LETTERS[mules.length]}`, slots: [] });
  };
  open();
  for (const unit of units) {
    const backup = structuredClone(grid);
    let spots = unit.map((u) => place(grid, items[u.code].w, items[u.code].h));
    if (spots.includes(null)) {
      grid.splice(0, grid.length, ...backup);
      if (mules.at(-1).slots.length) open();
      spots = unit.map((u) => place(grid, items[u.code].w, items[u.code].h));
      if (spots.includes(null)) throw new Error(`${unit[0].ref} does not fit in an empty mule`);
    }
    unit.forEach((u, i) => mules.at(-1).slots.push({ ref: u.ref, ...spots[i] }));
  }
  return mules;
}

// Fixed slots for every collectible unique and set item: key -> { mule, page, x, y }
function museumLayout() {
  const groups = { UW: [], UA: [], UJ: [] };
  const prefixOf = { weapons: "UW", armor: "UA", misc: "UJ" };
  for (const u of uniques) if (!u.legacy) groups[prefixOf[items[u.code].table]].push(u);
  const bySize = (a, b) => items[b.code].h - items[a.code].h || items[b.code].w - items[a.code].w;
  const mules = [
    ...Object.entries(groups).flatMap(([prefix, list]) =>
      pack(prefix, list.sort((a, b) => byOrder(a.code, b.code)).map((u) => [{ ref: uniqueKey(u), code: u.code }])),
    ),
    ...pack("SET", sets.map((s) => [...s.items].sort(bySize).map((i) => ({ ref: setItemKey(i), code: i.code })))),
  ];
  const slots = new Map(mules.flatMap((m) => m.slots.map((s) => [s.ref, { mule: m.name, ...s }])));
  return { names: mules.map((m) => m.name), slots };
}

// Magic, rare and crafted items by base type
const MAGIC_GROUPS = { scha: "CHARM", mcha: "CHARM", lcha: "CHARM", csch: "CHARM", jewl: "JEWEL", cjwl: "JEWEL", ring: "RING", amul: "RING" };

// Within those groups, items sort by what they are for (a rank, then a sub rank), then base type, then
// the stat's value, highest first. Ranks per group, first to last:
//   charms: skills, resistances (all, fire, cold, lightning, poison), life, attack, attributes, magic find
//   jewels: attack (enhanced/max damage, attack speed), hit recovery, resistances, life, attributes
//   rings, amulets: skills (by class), cast rate (with magic find first), magic find, life leech, attack
const RESISTS = [39, 43, 41, 45];
const ATTACK = [17, 18, 19, 21, 22, 48, 49, 50, 51, 54, 55, 57, 58, 93];
const SKILLS = [83, 107, 127, 188];
const statsOf = (item) => new Map(item.stats.map((s) => [s.id, s.value]));
const layerOf = (item, id) => item.stats.find((s) => s.id === id)?.layer;
function resistRank(v) {
  const res = RESISTS.map((id) => v.get(id) ?? 0);
  const best = Math.max(...res);
  return best > 0 ? [res.every(Boolean) ? 0 : res.indexOf(best) + 1, best] : null;
}
const sumOf = (v, ids) => ids.reduce((n, id) => n + (v.get(id) ?? 0), 0);
const PURPOSE = {
  CHARM(item, v, has) {
    if (has(SKILLS)) return [0, 0, v.get(127) ?? v.get(188) ?? v.get(83) ?? 0];
    const res = resistRank(v);
    if (res) return [1, ...res];
    if (v.has(7)) return [2, 0, v.get(7)];
    if (has(ATTACK)) return [3, 0, v.get(22) ?? v.get(19) ?? 0];
    if (has([0, 1, 2, 3])) return [4, 0, sumOf(v, [0, 1, 2, 3])];
    if (has([79, 80])) return [5, 0, v.get(80) ?? 0];
    return [6, 0, 0];
  },
  JEWEL(item, v, has) {
    if (has(ATTACK)) return [0, 0, v.get(17) ?? v.get(22) ?? v.get(93) ?? 0];
    if (v.has(99)) return [1, 0, v.get(99)];
    const res = resistRank(v);
    if (res) return [2, ...res];
    if (v.has(7)) return [3, 0, v.get(7)];
    if (has([0, 1, 2, 3])) return [4, 0, sumOf(v, [0, 1, 2, 3])];
    return [5, 0, 0];
  },
  RING(item, v, has) {
    if (has(SKILLS)) {
      const cls = v.has(83) ? layerOf(item, 83) : v.has(188) ? Math.floor(layerOf(item, 188) / 8) : -1;
      return [0, cls, sumOf(v, SKILLS)];
    }
    if (v.has(105)) return [1, v.has(80) ? 0 : 1, v.get(80) ?? v.get(105)];
    if (v.has(80)) return [2, 0, v.get(80)];
    if (v.has(60)) return [3, 0, v.get(60)];
    if (has(ATTACK)) return [4, 0, v.get(19) ?? 0];
    return [5, 0, 0];
  },
};
const purpose = (group, item) => {
  const v = statsOf(item);
  return PURPOSE[group](item, v, (ids) => ids.some((id) => v.has(id)));
};
const byPurpose = (group) => (a, b) => {
  const [pa, pb] = [purpose(group, a.item), purpose(group, b.item)];
  return byOrder(a.code, b.code) * (group === "RING") || pa[0] - pb[0] || pa[1] - pb[1] || byOrder(a.code, b.code) || pb[2] - pa[2];
};

function groupOf(key, item, code) {
  if (key.startsWith("u:") || key.startsWith("s:")) return "DUP"; // extra copies and legacy uniques
  if (key.startsWith("w:")) return "RW";
  if (!["Normal", "Superior", "Inferior"].includes(item.quality)) return MAGIC_GROUPS[items[code].type] ?? "MAG";
  return ["weapons", "armor"].includes(items[code].table) ? "BASE" : "MISC";
}

const isStarter = (item) =>
  item.position.mode === "Equipped" || item.position.mode === "InBelt" || STARTER_SCROLLS.has(codeOfNumber(item.code));
const moveTo = (item, { page, x, y }) => ({
  ...item,
  position: { ...item.position, mode: "Stored", body_location: "None", inv_x: x, inv_y: y, store_page: page },
});

// saves: [{ name, ext: "d2s" | "d2i", json }] -> { saves: [{ name, ext, json, template? }], report }.
// Only changed saves are returned; new mules carry `template`, the save they were cloned from.
// report.moves lists every moved item: { from, key, to, page, x, y }.
export function organize(saves) {
  const mules = saves.filter((s) => s.ext === "d2s" && s.json.character.level === 1);
  const template = mules.find((s) => s.json.character.class === "Barbarian");
  if (!template) throw new Error("no level 1 Barbarian to clone mules from");

  const source = []; // { item, from }
  let dropped = 0;
  const out = [];
  for (const s of mules) {
    for (const item of s.json.items) {
      if (isStarter(item)) dropped++;
      else source.push({ item, from: `${s.name} ${item.position.store_page}` });
    }
    out.push({ ...s, json: { ...s.json, items: [] } });
  }
  for (const s of saves.filter((s) => s.ext === "d2i")) {
    const tabs = s.json.map((tab, i) => {
      if (tab.tab_type !== "Normal") return tab;
      source.push(...tab.items.map((item) => ({ item, from: `${s.name} ${i + 1}` })));
      return { ...tab, items: [] };
    });
    out.push({ ...s, json: tabs });
  }

  const museum = museumLayout();
  const filled = new Map(); // museum key -> item
  const loose = { DUP: [], RW: [], CHARM: [], JEWEL: [], RING: [], MAG: [], BASE: [], MISC: [] };
  const entries = source.map((e) => ({ ...e, code: codeOfNumber(e.item.code), key: keyOf(e.item, codeOfNumber(e.item.code)) }));
  // Non-ethereal copies take the museum slot first
  entries.sort((a, b) => a.item.flags.includes("ETHEREAL") - b.item.flags.includes("ETHEREAL"));
  for (const e of entries) {
    if (museum.slots.has(e.key) && !filled.has(e.key)) filled.set(e.key, e);
    else loose[groupOf(e.key, e.item, e.code)].push(e);
  }

  const placed = new Map(museum.names.map((name) => [name, []]));
  const moves = [];
  const put = (mule, e, spot) => {
    placed.get(mule).push(moveTo(e.item, spot));
    moves.push({ from: e.from, key: e.key, to: mule, page: spot.page, x: spot.x, y: spot.y });
  };
  for (const [key, e] of filled) put(museum.slots.get(key).mule, e, museum.slots.get(key));
  for (const [prefix, list] of Object.entries(loose)) {
    if (!list.length) continue;
    list.sort(PURPOSE[prefix] ? byPurpose(prefix) : (a, b) => byOrder(a.code, b.code) || a.key.localeCompare(b.key));
    for (const m of pack(prefix, list.map((e, i) => [{ ref: i, code: e.code }]))) {
      placed.set(m.name, []);
      m.slots.forEach((s) => put(m.name, list[s.ref], s));
    }
  }

  const taken = new Set(saves.map((s) => s.name.toLowerCase()));
  const clash = [...placed.keys()].filter((name) => taken.has(name.toLowerCase()));
  if (clash.length) throw new Error(`mule names already used: ${clash.join(", ")}`);
  for (const [name, list] of placed) {
    const json = structuredClone(template.json);
    json.character.preview.name = name;
    json.items = list;
    json.stats = json.stats.filter((s) => !GOLD_STATS.has(s.id));
    json.corpses = [];
    out.push({ name, ext: "d2s", json, template: template.name });
  }

  const owned = (prefix) => [...museum.slots.values()].filter((s) => s.mule.startsWith(`${prefix}-`));
  const report = {
    moved: source.length,
    dropped,
    museum: Object.fromEntries(
      ["UW", "UA", "UJ", "SET"].map((p) => [p, { owned: owned(p).filter((s) => filled.has(s.ref)).length, total: owned(p).length }]),
    ),
    mules: [...placed].map(([name, list]) => ({ name, items: list.length })),
    moves,
  };
  return { saves: out, report };
}
