# Changing the organizing rules

All rules live in `src/lib/organize.js`. The command line (`scripts/organize.mjs`) and the app's Organize page both
use it, so after a change the player can also run the app locally (`npm run dev`) and organize from its page with
their rules. Change only that file, on a branch of their clone so `git pull` keeps working:

```bash
git switch -c my-rules
```

Ask what they want in their words ("charms with life first", "no museum, just pack uniques", "keep every grand
charm"), find the rule below, change it, dry-run, and show them the difference. Commit on their branch when they are
happy. Never loosen the checks in `organizeFiles`: they are what makes writing safe.

## Where each rule is

| What | Where | Notes |
|---|---|---|
| Which mule group an item goes to | `groupOf`, `MAGIC_GROUPS` | Groups by item key: `u:`/`s:` uniques and sets not in a museum slot (extra copies, legacy items) go to `DUP`, `w:` to `RW`, then junk, then magic/rare by base type (`MAGIC_GROUPS`, the rest `MAG`), then plain items to `BASE` (weapons, armor) or `MISC`. |
| The order groups are packed in, and their names | the `loose` object in `organize()` | A new group name **must** be added here too, or the run crashes. The key is the mule prefix (`CHARM` makes `CHARM-A`, `CHARM-B`...). |
| The order inside charms, jewels, rings | `PURPOSE`, `byPurpose` | Each function returns `[rank, sub rank, value]`; lower rank first, then higher value first. The comment above `RESISTS` lists the current order. Other groups sort by item type and tier (`byOrder`). |
| What counts as likely junk | `isJunk`, `KEEP_AT`, `ALL_RESIST_AT`, `JUNK_BASES` | An item is junk only if it is magic, its base is in `JUNK_BASES` (small, large, grand charm, jewel), and every stat is below its `KEEP_AT` value for that base; a stat not in `KEEP_AT` keeps the item. `Infinity` means never worth keeping alone. To turn junk off, make `isJunk` return `false`. |
| The museum (fixed slots for every unique and set item) | `museumLayout` | Laid out from the whole catalog: unique weapons `UW`, armor `UA`, jewelry and charms `UJ`, sets `SET` (a whole set never spans two mules). The app's character page draws empty museum slots from the same function, so a changed layout shows there too. To drop the museum, return `{ names: [], slots: new Map() }`; all uniques and sets then go to `DUP`. |
| Non-ethereal copy takes the museum slot | the `entries.sort` line in `organize()` | Reverse it to put ethereal copies in the museum. |
| Starting kit dropped | `isStarter` | Only plain items from the game's starting kit, still in the inventory. To keep everything, return `false`. Widening it to items that are not starting kit fails the check (`dropped something that is not starting kit`); widening it to starting kit in other places (the stash) passes. |
| Mule grids | `GRIDS` | Stash 10×10 and inventory 10×4, the game's sizes; don't change. |
| Mule names | `pack`, `suffix`, `modePrefix` | `PREFIX-A`, then `-B`... `-AA`, with `H`/`L` in front for hardcore and legacy saves (`HUW-A`). Character names can't hold digits and are at most 15 characters, so prefixes stay short and letters only. The app's character page spots museum and TRASH mules by name (`MUSEUM` in `src/components/CharacterView.jsx`); renaming those groups means changing it too. |

## Stat ids

Rules use stat ids from the game's `itemstatcost` table. To find one by its English text:

```bash
node -e 'const d=require("./src/data/stats.json");for(const[id,s]of Object.entries(d.stats)){const t=d.strings[s.pos];if(t&&/life/i.test(t[0]))console.log(id,t[0])}'
```

Common ones: 0 strength, 1 energy, 2 dexterity, 3 vitality, 7 life, 9 mana, 19 attack rating, 21/22 min/max damage,
39 fire, 41 lightning, 43 cold, 45 poison resistance, 79 gold find, 80 magic find, 83 class skills, 93 attack speed,
99 hit recovery, 105 cast rate, 107 single skill, 127 all skills, 188 skill tab. Life (7) and some others are
stored shifted (`shift` in stats.json); `isJunk` already undoes it, `PURPOSE` compares raw values.

## Check a change

1. `node scripts/check-junk.mjs`: made-up items against the junk rules. It asserts the default thresholds, so after
   changing them, update its expectations to the new rules rather than deleting it.
2. Dry-run on the player's saves and compare with the dry run before the change: the mule list and the TRASH list
   show what moved. Explain the difference before writing.
3. `npm run lint`.
