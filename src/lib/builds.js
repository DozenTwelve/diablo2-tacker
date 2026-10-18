// Recommended gear per build, src/data/builds.json: copied by hand from the "Gear Options" of the linked guides.
// Guides age and disagree, so this is a suggestion, not best in slot. An option names a unique, set item or
// runeword by its English name ({ item, kind?, note? }) or is free text ({ text }), each text in every language.
import builds from "../data/builds.json";
import { catalog } from "./gameData";

export { builds };
export const SLOTS = ["weapon", "offhand", "swap", "helm", "armor", "gloves", "belt", "boots", "amulet", "ring", "charm"];

// English name -> keys. Names are unique but for Crescent Moon (a unique amulet and a runeword), so an option
// may add the catalog kind: { item: "Crescent Moon", kind: "Unique" }. A current item wins over a legacy one.
const keysByName = new Map();
for (const [key, entry] of catalog)
  if (entry.kind !== "runes") keysByName.set(entry.names.en, [...(keysByName.get(entry.names.en) ?? []), key]);
export const keysOfOption = (option) =>
  (keysByName.get(option.item) ?? []).filter((k) => !option.kind || catalog.get(k).kind === option.kind);
export const keyOfOption = (option) => {
  const keys = keysOfOption(option);
  return keys.find((k) => !catalog.get(k).legacy) ?? keys[0];
};
export const buildsOf = (cls) => builds.filter((b) => b.cls === cls);
