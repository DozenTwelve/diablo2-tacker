// Game modes of saves, for organizing (src/lib/organize.js) and reading (src/lib/parseSaves.js).

// Game mode of a character or shared stash file: "SoftCore:Modern" (Reign of the Warlock), "HardCore:Legacy"
// (Lord of Destruction), "SoftCore:Classic" (no expansion: no shared stash, can't hold expansion items)...
// Saves before v104 say expansion or not in a flag only
export const modeOfCharacter = (json) => {
  const { flags, preview } = json.character;
  const version = json.version >= 104 ? preview.game_version : flags.includes("EXPANSION") ? "Expansion" : "Classic";
  return `${flags.includes("HARDCORE") ? "HardCore" : "SoftCore"}:${{ ReignOfTheWarlock: "Modern", Classic: "Classic" }[version] ?? "Legacy"}`;
};
// Only the file names the game reads; a copy beside them ("... - Copy.d2i") has no mode and is never emptied
export const modeOfStash = (name) => {
  const m = /^(modern)?sharedstash(softcore|hardcore)(v2)?(\.d2i)?$/i.exec(name);
  return m && `${/^hard/i.test(m[2]) ? "HardCore" : "SoftCore"}:${m[1] ? "Modern" : "Legacy"}`;
};
