// Parse D2R save files in the browser with the d2s WASM wrapper (wasm/).
// Output: owners (characters and shared stashes) and a flat list of owned items:
// { key, code, quality, ethereal, sockets, stats, rolls?, variant?, owner, place, x, y, slot, gfx, count }
// (x/y: grid position in stash/inventory/cube; slot: body location when equipped, e.g. "Head";
// gfx: which look a ring, amulet, charm or jewel has),
// stats as [statId, layer, value] (see src/lib/stats.js).
import { codeOfNumber, keyOf, variantOf } from "./gameData";
import { modeOfCharacter, modeOfStash } from "./modes";
import { copyScore, socketStats } from "./props";

let parser;
export async function loadParser() {
  if (!parser) {
    parser = await import("../../wasm/pkg/d2_parser.js");
    await parser.default();
  }
  return parser;
}

function placeOf(item) {
  const { mode, store_page } = item.position;
  if (mode === "Equipped") return "equipped";
  if (mode === "InBelt") return "belt";
  return store_page === "Null" ? mode.toLowerCase() : store_page.toLowerCase();
}

// Stats added up as in game; one set by several sources that comes to 0 (Malice's -1 light radius and an El's +1)
// shows nothing in game and is left out
const summed = (list) => {
  const sums = new Map();
  const added = new Set();
  for (const { id, layer, value } of list) {
    const key = `${id}:${layer}`;
    if (sums.has(key)) added.add(key);
    sums.set(key, (sums.get(key) ?? 0) + value);
  }
  return [...sums].filter(([key, value]) => value || !added.has(key)).map(([key, value]) => [...key.split(":").map(Number), value]);
};

// Item, runeword and socket stats together (runes and gems by gems.txt, jewels their own), summed as in game
export function statsOf(item, code) {
  const sockets = item.sockets
    .filter(Boolean)
    .flatMap((s) => (socketStats(code, codeOfNumber(s.code)) ?? s.stats.map((x) => [x.id, x.layer, x.value])).map(([id, layer, value]) => ({ id, layer, value })));
  return summed([...item.stats, ...(item.runeword_stats ?? []), ...sockets]);
}

// What the item rolled itself, for the roll score: without its runes, gems or jewels, and for a runeword without
// its base's own (superior) bonuses. Only when that differs from statsOf.
export const rollsOf = (item) =>
  item.runeword_id != null ? summed(item.runeword_stats ?? []) : item.sockets.some(Boolean) ? summed(item.stats) : undefined;

// Which version of an item a copy is, where one item comes in several: Rainbow Facet's (its uniqueitems id), a
// class skills item's (Hellfire Torch: the class). undefined for the rest.
export const versionOf = (item) => variantOf(item) ?? item.stats.find((s) => s.id === 83)?.layer;

// A save item's roll score against its catalog entry (copyScore), for organizing: the best copy takes the museum slot
export function scoreOfItem(item) {
  const code = codeOfNumber(item.code);
  return copyScore({ key: keyOf(item, code), stats: statsOf(item, code), rolls: rollsOf(item), variant: variantOf(item) });
}

function collect(item, owner, place, out) {
  // Stackable stash tabs keep a slot for every gem/rune type, even when the count is 0
  const count = place === "advanced" ? item.advanced_stash_stack_size : 1;
  if (!count) return;
  const code = codeOfNumber(item.code);
  out.push({
    key: keyOf(item, code),
    code,
    quality: item.quality,
    ethereal: item.flags.includes("ETHEREAL"),
    sockets: item.sockets.length,
    stats: statsOf(item, code),
    rolls: rollsOf(item),
    variant: variantOf(item),
    owner,
    place,
    x: item.position.inv_x,
    y: item.position.inv_y,
    slot: item.position.mode === "Equipped" ? item.position.body_location : undefined,
    gfx: item.variable_gfx_id ?? undefined,
    count,
  });
  // Runes inside a runeword are part of it, not loose runes
  if (item.runeword_id == null) item.sockets.forEach((s) => s && collect(s, owner, "socketed", out));
}

// Once-per-difficulty rewards, [normal, nightmare, hell]: "available", "used" or null (not unlocked yet).
// Akara's skill/stat reset and Larzuk's socket (Siege on Harrogath)
const rewardOf = (flags = "") => (flags.includes("REWARD_PENDING") ? "available" : flags.includes("REWARD_GRANTED") ? "used" : null);
const questsOf = (q) =>
  q && {
    respec: ["normal", "nightmare", "hell"].map((d) => rewardOf(q[d]?.act5?.akara_respec)),
    socket: ["normal", "nightmare", "hell"].map((d) => rewardOf(q[d]?.act5?.siege_on_harrogath)),
  };

// The picked folder's own saves, not a backup kept in a subfolder of it: the shallowest folder holding saves
// (the one with the most on a tie), with every file in it. Null when files were picked one by one (or come
// from the Deck): no folders to choose from.
export function saveFolder(files) {
  const dirOf = (f) => f.webkitRelativePath.split("/").slice(0, -1).join("/");
  const counts = new Map();
  for (const f of files.filter((f) => /\.d2[si]$/i.test(f.name) && !f.name.startsWith("._") && f.webkitRelativePath))
    counts.set(dirOf(f), (counts.get(dirOf(f)) ?? 0) + 1);
  const depth = (dir) => dir.split("/").length;
  const dir = [...counts].sort((a, b) => depth(a[0]) - depth(b[0]) || b[1] - a[1])[0]?.[0];
  return dir == null ? null : { dir, files: files.filter((f) => f.webkitRelativePath && dirOf(f) === dir) };
}

export async function parseSaveFiles(files) {
  const { parseD2s, parseD2i, writeD2s, writeD2i } = await loadParser();
  const items = [];
  const owners = []; // { name, mode, cls?, level?, quests?, dead? }; shared stashes have no class
  const errors = [];
  const damaged = []; // file names that parse but don't write back the same: cut short or damaged
  // A folder pick includes its subfolders: only the picked folder's own saves, or every backup kept in it
  // would count its items again. Not macOS's "._" metadata files that copying leaves beside every file.
  const isSave = (f) => /\.d2[si]$/i.test(f.name) && !f.name.startsWith("._");
  const folder = saveFolder(files);
  const picked = folder?.files ?? files;
  // Picked a folder above the saves (a parent of several backups): which one was read
  const subfolder = folder?.dir.includes("/") ? folder.dir : undefined;
  const saves = picked.filter(isSave);
  const skipped = files.filter(isSave).length - saves.length; // in other folders
  for (const file of saves) {
    const owner = file.name.replace(/\.d2[si]$/i, "");
    try {
      const bytes = new Uint8Array(await file.arrayBuffer());
      const stash = /\.d2i$/i.test(file.name);
      const json = (stash ? parseD2i : parseD2s)(bytes);
      // A file cut short (copied halfway) or damaged can still parse, missing whole stash pages: a good save
      // writes back to the same bytes. Shown with what could be read, and said.
      const same = (written) => written.length === bytes.length && written.every((x, i) => x === bytes[i]);
      try {
        if (!same((stash ? writeD2i : writeD2s)(json))) throw new Error();
      } catch {
        damaged.push(file.name);
      }
      if (stash) {
        JSON.parse(json).forEach((tab, i) => {
          const place = tab.tab_type === "AdvancedStash" ? "advanced" : `shared${i + 1}`;
          tab.items.forEach((it) => collect(it, owner, place, items));
        });
        owners.push({ name: owner, mode: modeOfStash(file.name) });
      } else {
        const save = JSON.parse(json);
        const { flags } = save.character;
        // A dead hardcore hero can't be played again: what it holds is not the player's any more
        const dead = flags.includes("HARDCORE") && flags.includes("DEAD");
        if (!dead) {
          save.items.forEach((it) => collect(it, owner, placeOf(it), items));
          (save.merc_items?.items ?? []).forEach((it) => collect(it, owner, "merc", items));
          // Left on the corpse after dying: picked up again at the next game
          (save.corpses ?? []).forEach((c) => c.items.forEach((it) => collect(it, owner, "corpse", items)));
          // An Iron Golem made from an item keeps it
          if (save.iron_golem?.golem_item) collect(save.iron_golem.golem_item, owner, "golem", items);
        }
        owners.push({ name: owner, mode: modeOfCharacter(save), cls: save.character.class, level: save.character.level, quests: questsOf(save.quests), dead });
      }
    } catch (e) {
      errors.push(`${file.name}: ${e.message ?? e}`);
    }
  }
  return { items, owners, errors, damaged, subfolder, files: saves.length, skipped, loadedAt: new Date().toISOString() };
}
