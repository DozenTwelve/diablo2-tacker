// Rearrange every mule item into numbered mules, from saves parsed by the WASM wrapper (wasm/).
// Works on one game mode at a time (softcore/hardcore, Reign of the Warlock or not): its mules (level 1
// characters, or the ones named) are emptied, their starting kit dropped, and everything they and the
// mode's shared stash pages hold goes into new mules cloned from one of them (a Barbarian if any).
// With inbox pages given, only those shared stash pages are emptied; the others stay as they are.
// Other characters, other modes and the stackable stash page are not touched.
// Uniques and set items get fixed slots laid out from the whole catalog, so an empty slot is one not
// owned yet. Extra copies, runewords, charms, jewels, rings and amulets, other magic/rare items, bases
// and the rest are packed into their own mules.
import { uniques, sets, uniqueKey, setItemKey, keyOf, codeOfNumber } from "./gameData";
import { modeOfCharacter, modeOfStash } from "./modes";
import { scoreOfItem } from "./parseSaves";
import { builds, keyOfOption } from "./builds";
import items from "../data/items.json";
import statData from "../data/stats.json";

const GRIDS = [["Stash", 10, 10], ["Inventory", 10, 4]];
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
// Mule suffixes A..Z, then AA, AB... (names can't hold digits)
const suffix = (i) => (i < 26 ? LETTERS[i] : suffix(Math.floor(i / 26) - 1) + LETTERS[i % 26]);
const GOLD_STATS = new Set([14, 15]);

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
// Units are [{ ref, code }]; returns [{ name, slots: [{ ref, code, page, x, y }] }].
function pack(prefix, units) {
  const mules = [];
  let grid;
  const open = () => {
    grid = emptyMule();
    mules.push({ name: `${prefix}-${suffix(mules.length)}`, slots: [] });
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
    unit.forEach((u, i) => mules.at(-1).slots.push({ ref: u.ref, code: u.code, ...spots[i] }));
  }
  return mules;
}

// Mule names start with H for hardcore, L for legacy and C for classic saves ("HUW-A"), so every mode's mules fit in one folder
export const modePrefix = (mode) =>
  (mode.startsWith("HardCore") ? "H" : "") + (mode.endsWith("Legacy") ? "L" : mode.endsWith("Classic") ? "C" : "");

// Fixed slots for every collectible unique and set item: key -> { mule, code, page, x, y }
export function museumLayout(namePrefix = "") {
  const groups = { UW: [], UA: [], UJ: [] };
  const prefixOf = { weapons: "UW", armor: "UA", misc: "UJ" };
  for (const u of uniques) if (!u.legacy) groups[prefixOf[items[u.code].table]].push(u);
  const bySize = (a, b) => items[b.code].h - items[a.code].h || items[b.code].w - items[a.code].w;
  const mules = [
    ...Object.entries(groups).flatMap(([prefix, list]) =>
      pack(namePrefix + prefix, list.sort((a, b) => byOrder(a.code, b.code)).map((u) => [{ ref: uniqueKey(u), code: u.code }])),
    ),
    ...pack(
      `${namePrefix}SET`,
      sets.filter((s) => !s.legacy).map((s) => s.items.filter((i) => !i.legacy).sort(bySize).map((i) => ({ ref: setItemKey(i), code: i.code }))),
    ),
  ];
  const slots = new Map(mules.flatMap((m) => m.slots.map((s) => [s.ref, { mule: m.name, ...s }])));
  return { names: mules.map((m) => m.name), slots };
}

// How many copies of a unique or set item are worth having: one for each class with a build recommending it,
// two where it is a ring (src/data/builds.json), so every class could wear it; none for one no build uses. In
// single player nothing can be traded: a copy no character would wear only takes room.
const NEEDED = new Map();
{
  const perClass = new Map(); // key -> Map(class -> copies)
  for (const b of builds)
    for (const [slot, options] of Object.entries(b.slots))
      for (const o of options.filter((o) => o.item)) {
        const key = keyOfOption(o);
        if (!key) continue;
        if (!perClass.has(key)) perClass.set(key, new Map());
        const classes = perClass.get(key);
        classes.set(b.cls, Math.max(classes.get(b.cls) ?? 0, slot === "ring" ? 2 : 1));
      }
  for (const [key, classes] of perClass) NEEDED.set(key, [...classes.values()].reduce((a, b) => a + b, 0));
}
export const copiesNeeded = (key) => NEEDED.get(key) ?? 0;

// Copies of unique and set items, decided together so organizing and the New finds page (src/lib/newItems.js)
// agree. The museum slot takes the best copy: non-ethereal first, then the best rolls, then on a tie the copy
// already there, so organizing again moves nothing. Copies past what is worth having (copiesNeeded, the museum
// copy counting as one, plus one ethereal weapon or armor for a mercenary when any build uses the item) go to
// TRASH, the lowest rolls first. Items without a museum slot (legacy) stay in DUP.
// copies: [{ key, code, eth, score (-1: none), home (in its museum slot now) }], slots: museumLayout().slots
// -> Map copy -> "MUSEUM" | "DUP" | "TRASH", in the order they were decided
export function placeCopies(copies, slots) {
  const order = [...copies].sort((a, b) => a.eth - b.eth || b.score - a.score || b.home - a.home);
  const where = new Map();
  const museum = new Map(); // key -> the copy in its slot
  for (const c of order) {
    if (slots.has(c.key) && !museum.has(c.key)) {
      museum.set(c.key, c);
      where.set(c, "MUSEUM");
    }
  }
  const keep = new Map(); // key -> { plain, eth } copies still to keep
  for (const c of order) {
    if (where.has(c)) continue;
    const kept = museum.get(c.key);
    if (!kept) {
      where.set(c, "DUP");
      continue;
    }
    if (!keep.has(c.key)) {
      const needed = copiesNeeded(c.key);
      const merc = needed > 0 && ["weapons", "armor"].includes(items[c.code]?.table);
      keep.set(c.key, { plain: Math.max(0, needed - (kept.eth ? 0 : 1)), eth: merc && !kept.eth ? 1 : 0 });
    }
    const left = keep.get(c.key);
    const kind = c.eth ? "eth" : "plain";
    if (left[kind] > 0) {
      left[kind]--;
      where.set(c, "DUP");
    } else where.set(c, "TRASH");
  }
  return where;
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

// Likely junk, gathered in TRASH mules for the player to delete: a magic charm or jewel on which every
// stat is below what is worth keeping. Values as the game shows them, for [small, large, grand charm, jewel];
// Infinity: never worth keeping on its own. Any stat not listed (skills, attack speed, hit recovery, run
// speed, enhanced damage...) keeps the item, so does all resistances at its own value.
// ponytail: fixed thresholds, make them a setting if players disagree
const JUNK_BASES = ["scha", "mcha", "lcha", "jewl"];
const ATTRIBUTE = [2, 4, 6, 6];
const RESIST = [8, 12, 20, 20];
const KEEP_AT = {
  7: [15, 25, 35, 15], // life
  0: ATTRIBUTE, 1: ATTRIBUTE, 2: ATTRIBUTE, 3: ATTRIBUTE,
  39: RESIST, 41: RESIST, 43: RESIST, 45: RESIST,
  80: [6, 10, 10, 10], // magic find
  19: [20, 48, 76, 40], // attack rating
  21: [2, 4, 6, 8], 22: [3, 6, 10, 15], // min / max damage
  ...Object.fromEntries([9, 11, 31, 79, 89, 48, 49, 50, 51, 54, 55, 57, 58, 59].map((id) => [id, Array(4).fill(Infinity)])),
};
const ALL_RESIST_AT = [3, 6, 10, 10];
export function isJunk(item, code) {
  const base = JUNK_BASES.indexOf(items[code]?.type);
  if (item.quality !== "Magic" || base < 0) return false;
  const v = new Map();
  for (const s of item.stats) v.set(s.id, (v.get(s.id) ?? 0) + (s.value >> (statData.stats[s.id]?.shift ?? 0)));
  const res = RESISTS.map((id) => v.get(id));
  if (res.every((r) => r === res[0] && r >= ALL_RESIST_AT[base])) return false;
  return v.size > 0 && [...v].every(([id, value]) => KEEP_AT[id] && value < KEEP_AT[id][base]);
}

function groupOf(key, item, code) {
  if (key.startsWith("u:") || key.startsWith("s:")) return "DUP"; // extra copies and legacy uniques
  if (key.startsWith("w:")) return "RW";
  if (isJunk(item, code)) return "TRASH";
  if (!["Normal", "Superior", "Inferior"].includes(item.quality)) return MAGIC_GROUPS[items[code].type] ?? "MAG";
  return ["weapons", "armor"].includes(items[code].table) ? "BASE" : "MISC";
}

// Starting kit: a plain weapon, buckler, potion or scroll the game gave a new character (its own flag says so),
// never socketed, still where it started. A white hand axe found later, or one made into a runeword, is kept.
const isStarter = (item) =>
  items[codeOfNumber(item.code)]?.starter &&
  item.flags.includes("STARTER_ITEM") &&
  !item.flags.includes("SOCKETED") &&
  item.quality === "Normal" &&
  (item.position.mode !== "Stored" || item.position.store_page === "Inventory");
const moveTo = (item, { page, x, y }) => ({
  ...item,
  position: { ...item.position, mode: "Stored", body_location: "None", inv_x: x, inv_y: y, store_page: page },
});

const goldOf = (json) => json.stats.filter((s) => GOLD_STATS.has(s.id)).reduce((n, s) => n + s.value, 0);
const deadHardcore = (json) => json.character.flags.includes("HARDCORE") && json.character.flags.includes("DEAD");

export { modeOfCharacter, modeOfStash };

// Mules of a mode: the named characters, or else every level 1 character; never a dead hardcore hero (it
// can't be played, its items stay with it)
export const mulesOf = (saves, mode, names) =>
  saves.filter(
    (s) =>
      s.ext === "d2s" &&
      modeOfCharacter(s.json) === mode &&
      !deadHardcore(s.json) &&
      (names ? names.some((n) => n.toLowerCase() === s.name.toLowerCase()) : s.json.character.level === 1),
  );

// A character's own files among a save folder's file names: its save and what the game keeps beside it
export const filesOfCharacter = (name, fileNames) =>
  fileNames.filter((f) => f.startsWith(`${name}.`) && /^(d2s|ctl|key|map|ma\d+)$/.test(f.slice(name.length + 1)));

// saves: [{ name, ext: "d2s" | "d2i", json }]; options: { mode, mules: names, inbox: shared stash page numbers }
// -> { saves: [{ name, ext, json, template? }], report }. Only changed saves are returned; new mules carry
// `template`, the save they were cloned from. Mules whose names the new layout uses are rewritten in place.
// report: { mules: names emptied, leftEmpty: emptied level 1 mules without gold no new mule is named after, other
//   than this mode's own mule names (an empty CHARM-B is kept for when charms grow again): the player may delete them,
//   moved, dropped: [item], moves: [{ from, key, to, page, x, y, group }],
//   inbox: what the shared stash pages brought: { museum: keys, dup: keys, trash: keys, other }, ... }
export function organize(saves, { mode = "SoftCore:Modern", mules: names, inbox } = {}) {
  // By name: the same saves give the same result whatever order the files came in (folder picker, Deck, Node)
  // "RW-A.d2s" and "rw-a.d2s" side by side (a case-sensitive file system): one would shadow the other
  const seen = new Set();
  for (const s of saves) {
    const key = `${s.name}.${s.ext}`.toLowerCase();
    if (seen.has(key)) throw new Error(`two saves named ${s.name}.${s.ext} apart from upper and lower case: keep one`);
    seen.add(key);
  }
  const mules = mulesOf(saves, mode, names).sort((a, b) => a.name.localeCompare(b.name));
  const named = (n) => saves.some((s) => s.ext === "d2s" && modeOfCharacter(s.json) === mode && s.name.toLowerCase() === n.toLowerCase());
  const unknown = names?.filter((n) => !named(n)) ?? [];
  if (unknown.length) throw new Error(`not characters of ${mode}: ${unknown.join(", ")}`);
  if (!mules.length) throw new Error(`no mules in ${mode}`);
  // Items on a corpse or in an Iron Golem are not the mule's to move: the player picks them up first
  for (const s of mules) {
    if (s.json.corpses?.some((c) => c.items.length) || s.json.iron_golem?.golem_item)
      throw new Error(`${s.name} has items on its corpse or in its Iron Golem: pick them up in the game first`);
  }
  // New mules copy a level 1 mule, a Barbarian if any: never a main's level
  const blank = mules.filter((s) => s.json.character.level === 1);
  const template = blank.find((s) => s.json.character.class === "Barbarian") ?? blank[0];
  if (!template) throw new Error(`no level 1 character among the mules of ${mode} to make new mules from`);

  const source = []; // { item, from }
  const dropped = [];
  const out = new Map(); // name (lower case) -> changed save
  for (const s of mules) {
    for (const item of s.json.items) {
      if (isStarter(item)) dropped.push(item);
      else source.push({ item, from: `${s.name} ${item.position.store_page === "Null" ? "equipped" : item.position.store_page}` });
    }
    const merc = s.json.merc_items?.items ?? [];
    source.push(...merc.map((item) => ({ item, from: `${s.name} merc` })));
    const json = { ...s.json, items: [] };
    if (merc.length) json.merc_items = { ...s.json.merc_items, items: [] };
    out.set(s.name.toLowerCase(), { ...s, json });
  }
  for (const s of saves.filter((s) => s.ext === "d2i" && modeOfStash(s.name) === mode)) {
    const missing = inbox?.filter((n) => s.json[n - 1]?.tab_type !== "Normal") ?? [];
    if (missing.length) throw new Error(`${s.name} has no page ${missing.join(", ")} to empty`);
    const tabs = s.json.map((tab, i) => {
      if (tab.tab_type !== "Normal" || (inbox && !inbox.includes(i + 1))) return tab;
      source.push(...tab.items.map((item) => ({ item, from: `${s.name} ${i + 1}`, stash: true })));
      return { ...tab, items: [] };
    });
    out.set(s.name.toLowerCase(), { ...s, json: tabs });
  }

  const namePrefix = modePrefix(mode);
  const museum = museumLayout(namePrefix);
  const filled = new Map(); // museum key -> item
  const loose = { DUP: [], RW: [], CHARM: [], JEWEL: [], RING: [], MAG: [], BASE: [], MISC: [], TRASH: [] };
  const entries = source.map((e) => ({ ...e, code: codeOfNumber(e.item.code), key: keyOf(e.item, codeOfNumber(e.item.code)) }));
  // Unique and set item copies are placed together (placeCopies); everything else by groupOf, non-ethereal first
  const home = (e) => e.from.split(" ")[0].toLowerCase() === museum.slots.get(e.key)?.mule.toLowerCase();
  const isCopy = (e) => /^[us]:/.test(e.key);
  const copies = entries
    .filter(isCopy)
    .map((e) => ({ e, key: e.key, code: e.code, eth: e.item.flags.includes("ETHEREAL"), score: scoreOfItem(e.item) ?? -1, home: home(e) }));
  for (const [c, group] of placeCopies(copies, museum.slots)) {
    if (group === "MUSEUM") filled.set(c.key, c.e);
    else loose[group].push(c.e);
  }
  entries.sort((a, b) => a.item.flags.includes("ETHEREAL") - b.item.flags.includes("ETHEREAL"));
  for (const e of entries.filter((e) => !isCopy(e))) loose[groupOf(e.key, e.item, e.code)].push(e);

  const placed = new Map(museum.names.map((name) => [name, []]));
  const moves = [];
  const put = (mule, e, spot, group) => {
    placed.get(mule).push(moveTo(e.item, spot));
    moves.push({ from: e.from, key: e.key, to: mule, page: spot.page, x: spot.x, y: spot.y, group, stash: e.stash, item: e.item });
  };
  for (const [key, e] of filled) put(museum.slots.get(key).mule, e, museum.slots.get(key), "MUSEUM");
  for (const [prefix, list] of Object.entries(loose)) {
    if (!list.length) continue;
    list.sort(PURPOSE[prefix] ? byPurpose(prefix) : (a, b) => byOrder(a.code, b.code) || a.key.localeCompare(b.key));
    for (const m of pack(namePrefix + prefix, list.map((e, i) => [{ ref: i, code: e.code }]))) {
      placed.set(m.name, []);
      m.slots.forEach((s) => put(m.name, list[s.ref], s, prefix));
    }
  }

  // A new mule may take the name of a mule being emptied (organizing again), never another character's
  const others = new Set(saves.filter((s) => s.ext === "d2s" && !out.has(s.name.toLowerCase())).map((s) => s.name.toLowerCase()));
  const clash = [...placed.keys()].filter((name) => others.has(name.toLowerCase()));
  if (clash.length) throw new Error(`mule names already used by other characters: ${clash.join(", ")}`);
  for (const [name, list] of placed) {
    // A mule being emptied keeps its own save (its gold, its name as written: "rw-a" stays one file); a new
    // one copies the template without its gold
    const own = mules.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (own) {
      const save = out.get(name.toLowerCase());
      save.json = { ...save.json, items: list };
      continue;
    }
    const json = structuredClone(template.json);
    json.character.preview.name = name;
    if (json.character.name) json.character.name = name; // saves before v98 keep the name here
    json.items = list;
    json.stats = json.stats.filter((s) => !GOLD_STATS.has(s.id));
    json.corpses = [];
    if (json.merc_items) json.merc_items = { ...json.merc_items, items: [] };
    if (json.iron_golem) json.iron_golem = { ...json.iron_golem, golem_item: null };
    out.set(name.toLowerCase(), { name, ext: "d2s", json, template: template.name });
  }

  const fromStash = (group) => moves.filter((m) => m.stash && m.group === group).map((m) => m.key);
  const owned = (prefix) => [...museum.slots.values()].filter((s) => s.mule.startsWith(`${namePrefix}${prefix}-`));
  const groups = ["UW", "UA", "UJ", "SET", ...Object.keys(loose)].join("|");
  const ownName = new RegExp(`^${namePrefix}(${groups})-[A-Z]+$`, "i");
  const report = {
    mode,
    mules: mules.map((s) => s.name),
    leftEmpty: mules
      .filter((s) => s.json.character.level === 1 && !goldOf(s.json) && !ownName.test(s.name) && ![...placed.keys()].some((n) => n.toLowerCase() === s.name.toLowerCase()))
      .map((s) => s.name)
      .sort((a, b) => a.localeCompare(b)),
    template: template.name,
    moved: source.length,
    dropped,
    museum: Object.fromEntries(
      ["UW", "UA", "UJ", "SET"].map((p) => [p, { owned: owned(p).filter((s) => filled.has(s.ref)).length, total: owned(p).length }]),
    ),
    newMules: [...placed].map(([name, list]) => ({ name, items: list.length })),
    // Every mule character after this run: the emptied ones (as written) and the new ones
    muleNames: [...mules.map((s) => s.name), ...[...placed.keys()].filter((n) => !mules.some((s) => s.name.toLowerCase() === n.toLowerCase()))],
    moves,
    inbox: {
      museum: fromStash("MUSEUM"),
      dup: fromStash("DUP"),
      trash: fromStash("TRASH"),
      other: moves.filter((m) => m.stash && !["MUSEUM", "DUP", "TRASH"].includes(m.group)).length,
    },
  };
  return { saves: [...out.values()], report };
}

// D2R lists characters by when their save last changed, newest first. After organizing every mule gets a time just
// before the oldest other character's, in name order, so the characters being played stay on top.
// times: { "Name.d2s": ms } of the folder's characters; mules: mule names -> { "Mule.d2s": ms } (none without others)
export function muleTimes(times, mules) {
  const isMule = new Set(mules.map((n) => `${n}.d2s`.toLowerCase()));
  const others = Object.entries(times).filter(([f]) => /\.d2s$/i.test(f) && !isMule.has(f.toLowerCase()));
  if (!others.length) return {};
  const start = Math.min(...others.map(([, ms]) => ms)) - 60_000;
  return Object.fromEntries([...mules].sort((a, b) => a.localeCompare(b)).map((n, i) => [`${n}.d2s`, start - i * 1000]));
}

// Organize save files and write the result, checked before anything is returned: every item is kept exactly
// once (only starting kit is dropped), gold stays, and every written character holds only stored items, inside its stash
// (10x10) or inventory (10x4), not overlapping. Throws when a check fails or a save would not round-trip.
// files: [{ name: "Zanna.d2s", bytes }]; wasm: the parser (parseD2s, parseD2i, writeD2s, writeD2i); options as organize()
// -> { files: [{ name, bytes, template? }] (only saves whose bytes change), saves (as read), report }
export function organizeFiles(files, wasm, options) {
  const parse = (ext, bytes) => JSON.parse(ext === "d2s" ? wasm.parseD2s(bytes) : wasm.parseD2i(bytes));
  const write = (ext, json) => (ext === "d2s" ? wasm.writeD2s : wasm.writeD2i)(JSON.stringify(json));
  const equal = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  // A save must come back byte for byte from its JSON: JavaScript numbers can't hold every 64-bit value
  const saves = files
    // Lower case only, as written back: "X.D2S" would come back as a second file "X.d2s" next to it
    .filter((f) => /\.d2[si]$/.test(f.name))
    .map((f) => {
      const save = { name: f.name.slice(0, -4), ext: f.name.slice(-3) };
      save.json = parse(save.ext, f.bytes);
      if (!equal(write(save.ext, save.json), f.bytes)) throw new Error(`${f.name} does not round-trip, not touching it`);
      return save;
    });
  const { saves: changed, report } = organize(saves, options);
  const out = changed.map((s) => ({ name: `${s.name}.${s.ext}`, bytes: write(s.ext, s.json), template: s.template }));
  const input = new Map(files.map((f) => [f.name, f.bytes]));
  const written = new Map(out.map((f, i) => [f.name, parse(changed[i].ext, f.bytes)]));

  // Items without their position: before (the emptied characters and the emptied shared pages, as read) minus
  // the dropped starting kit must equal after (every written save)
  const fingerprint = (item) => JSON.stringify({ ...item, position: undefined });
  const held = (json, ext, pages) =>
    ext === "d2s"
      ? [...json.items, ...(json.merc_items?.items ?? [])]
      : json.flatMap((tab, i) => (tab.tab_type === "Normal" && (!pages || pages.includes(i + 1)) ? tab.items : []));
  const emptied = new Set(report.mules);
  const before = saves.flatMap((s) =>
    s.ext === "d2s" ? (emptied.has(s.name) ? held(s.json, "d2s") : []) : changed.some((c) => c.name === s.name) ? held(s.json, "d2i", options?.inbox) : [],
  );
  const after = changed.flatMap((s) => held(written.get(`${s.name}.${s.ext}`), s.ext, options?.inbox));
  for (const item of report.dropped) {
    if (!item.flags.includes("STARTER_ITEM") || item.flags.includes("SOCKETED") || item.quality !== "Normal")
      throw new Error("dropped something that is not starting kit");
  }
  // Gold stays where it was: the emptied characters hold as much before as the written characters after
  const gold = (list) => list.reduce((n, json) => n + goldOf(json), 0);
  const writtenD2s = changed.filter((s) => s.ext === "d2s").map((s) => written.get(`${s.name}.d2s`));
  if (gold(saves.filter((s) => s.ext === "d2s" && emptied.has(s.name)).map((s) => s.json)) !== gold(writtenD2s))
    throw new Error("gold check failed: gold was lost or added");
  const remaining = new Map();
  for (const f of before.map(fingerprint)) remaining.set(f, (remaining.get(f) ?? 0) + 1);
  for (const f of [...report.dropped, ...after].map(fingerprint)) {
    if (!remaining.get(f)) throw new Error("item check failed: an item was added or duplicated");
    remaining.set(f, remaining.get(f) - 1);
  }
  if ([...remaining.values()].some(Boolean)) throw new Error("item check failed: an item was lost");
  // Pages that are not inboxes must come back unchanged
  for (const s of changed.filter((s) => s.ext === "d2i")) {
    const original = saves.find((o) => o.name === s.name).json;
    written.get(`${s.name}.d2i`).forEach((tab, i) => {
      if ((tab.tab_type !== "Normal" || (options?.inbox && !options.inbox.includes(i + 1))) && JSON.stringify(tab) !== JSON.stringify(original[i]))
        throw new Error(`${s.name} page ${i + 1} changed`);
    });
  }

  for (const s of changed.filter((s) => s.ext === "d2s")) {
    const used = new Set();
    for (const i of written.get(`${s.name}.d2s`).items) {
      const { w, h } = items[codeOfNumber(i.code)];
      const { mode: where, store_page: page, inv_x: x, inv_y: y } = i.position;
      const [W, H] = { Stash: [10, 10], Inventory: [10, 4] }[page] ?? [0, 0];
      if (where !== "Stored" || x + w > W || y + h > H) throw new Error(`${s.name}: item outside the stash and inventory at ${page} ${x},${y}`);
      for (let a = 0; a < w; a++)
        for (let b = 0; b < h; b++) {
          const cell = `${page}:${x + a}:${y + b}`;
          if (used.has(cell)) throw new Error(`${s.name}: items overlap at ${cell}`);
          used.add(cell);
        }
    }
  }
  // A save that comes out as it went in is not handed back: rewriting it would only make it look newly played
  return { files: out.filter((f) => !(input.has(f.name) && equal(input.get(f.name), f.bytes))), saves, report };
}
