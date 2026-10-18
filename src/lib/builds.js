// Recommended gear per build, src/data/builds.json: copied by hand from the "Gear Options" of the linked guides.
// Guides age and disagree, so this is a suggestion, not best in slot. An option names a unique, set item or
// runeword by its English name ({ item, kind?, note? }) or is free text ({ text }), each text in every language.
import builds from "../data/builds.json";
import { catalog } from "./gameData";
import { useStoredState } from "./useStoredState";

export { builds };
export const SLOTS = ["weapon", "offhand", "swap", "helm", "armor", "gloves", "belt", "boots", "amulet", "ring", "charm"];

// Build slot of each equipment slot (body_location); charms work from the inventory
export const SLOT_OF = {
  RightArm: "weapon",
  LeftArm: "offhand",
  RightHand: "swap",
  LeftHand: "swap",
  Head: "helm",
  Torso: "armor",
  Gloves: "gloves",
  Belt: "belt",
  Feet: "boots",
  Neck: "amulet",
  RightRing: "ring",
  LeftRing: "ring",
};

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

// The build picked for a character and how to pick one; picking the picked one again unpicks it
export function useBuild(owner) {
  const [picked, setPicked] = useStoredState("builds", {}); // character -> build id
  const list = buildsOf(owner.cls);
  const build = list.find((b) => b.id === picked[owner.name]);
  const pick = (id) => setPicked({ ...picked, [owner.name]: id === build?.id ? undefined : id });
  return { list, build, pick };
}
