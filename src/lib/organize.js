// Rearrange every mule item into numbered mules, from saves parsed by the WASM wrapper (wasm/).
// Level 1 characters are mules: they are emptied (their starting kit is dropped) and everything goes
// into new mules cloned from a level 1 Barbarian. Other characters and the shared stash are not touched.
// Uniques and set items get fixed slots laid out from the whole catalog, so an empty slot is one not
// owned yet. Extra copies, runewords, magic/rare items, bases and the rest are packed into their own mules.
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

function groupOf(key, item, code) {
  if (key.startsWith("u:") || key.startsWith("s:")) return "DUP"; // extra copies and legacy uniques
  if (key.startsWith("w:")) return "RW";
  if (!["Normal", "Superior", "Inferior"].includes(item.quality)) return "MAG";
  return ["weapons", "armor"].includes(items[code]?.table) ? "BASE" : "MISC";
}

const isStarter = (item) =>
  item.position.mode === "Equipped" || item.position.mode === "InBelt" || STARTER_SCROLLS.has(codeOfNumber(item.code));
const moveTo = (item, { page, x, y }) => ({
  ...item,
  position: { ...item.position, mode: "Stored", body_location: "None", inv_x: x, inv_y: y, store_page: page },
});

// saves: [{ name, ext: "d2s" | "d2i", json }] (shared stashes only for their names) -> { saves: [{ name, ext, json, template? }], report }.
// Only changed saves are returned; new mules carry `template`, the save they were cloned from.
export function organize(saves) {
  const mules = saves.filter((s) => s.ext === "d2s" && s.json.character.level === 1);
  const template = mules.find((s) => s.json.character.class === "Barbarian");
  if (!template) throw new Error("no level 1 Barbarian to clone mules from");

  const source = []; // { item, code, key }
  let dropped = 0;
  const out = [];
  for (const s of mules) {
    for (const item of s.json.items) {
      if (isStarter(item)) dropped++;
      else source.push(item);
    }
    out.push({ ...s, json: { ...s.json, items: [] } });
  }

  const museum = museumLayout();
  const filled = new Map(); // museum key -> item
  const loose = { DUP: [], RW: [], MAG: [], BASE: [], MISC: [] };
  const entries = source.map((item) => ({ item, code: codeOfNumber(item.code), key: keyOf(item, codeOfNumber(item.code)) }));
  // Non-ethereal copies take the museum slot first
  entries.sort((a, b) => a.item.flags.includes("ETHEREAL") - b.item.flags.includes("ETHEREAL"));
  for (const e of entries) {
    if (museum.slots.has(e.key) && !filled.has(e.key)) filled.set(e.key, e.item);
    else loose[groupOf(e.key, e.item, e.code)].push(e);
  }

  const placed = new Map(museum.names.map((name) => [name, []]));
  for (const [key, item] of filled) placed.get(museum.slots.get(key).mule).push(moveTo(item, museum.slots.get(key)));
  for (const [prefix, list] of Object.entries(loose)) {
    if (!list.length) continue;
    list.sort((a, b) => byOrder(a.code, b.code) || a.key.localeCompare(b.key));
    for (const m of pack(prefix, list.map((e, i) => [{ ref: i, code: e.code }]))) {
      placed.set(m.name, m.slots.map((s) => moveTo(list[s.ref].item, s)));
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
  };
  return { saves: out, report };
}
