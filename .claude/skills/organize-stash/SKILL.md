---
name: organize-stash
description: Organize a D2R player's mules and shared stash with scripts/organize.mjs, first time or as upkeep (inbox pages, likely-junk TRASH mules). Use when someone wants their Diablo II Resurrected saves sorted into mules, or new finds put away.
---

# Organize a D2R stash

The player's saves are theirs. Never change them in place: read from their folder (or a copy), write to a new
folder, and let them copy the result back. Saves stay on this machine; never send them to any service.

## 1. Get the saves

Ask where the save folder is, or point them to [docs/saves.md](../../../docs/saves.md) (Windows, Steam Deck).
Ask them to quit D2R and to back up the whole folder before anything else. Check it parses:

```bash
node scripts/check-saves.mjs <save dir>
```

## 2. Decide what to organize

- **Game mode**: one at a time, `--mode SoftCore:Modern` by default (Modern = Reign of the Warlock, Legacy = older
  saves, HardCore for hardcore). Shared stash files are per mode.
- **Mules**: by default every level 1 character of the mode. If a level 1 character is a new main, or a higher
  level one is a mule, pass the mules by name: `--mules a,b,c`. The app's character page can mark them and prints
  the list.
- **Inbox pages** (upkeep): which shared stash pages hold new finds, e.g. `--inbox 4,5`. Without it every shared
  stash page is emptied, which is right for a first run but not when other pages are working sets (charm pages
  for a main, for example). Ask.

## 3. Dry run, then explain

```bash
node scripts/organize.mjs <save dir> <out dir> [--mode ...] [--mules ...] [--inbox ...]
```

Without `--yes` it only prints the plan. Explain it in the player's language, in plain words, before writing:

- Which characters are emptied, and that other characters and the stackable stash page are not touched.
- How many mules it makes and what goes where:
  - `UW-*` unique weapons, `UA-*` unique armor, `UJ-*` unique rings, amulets, charms and jewels, `SET-*` set
    items, each with a fixed slot per item, so empty slots are items still missing;
  - `DUP-*` extra copies of uniques and set items, `RW-*` runewords, `CHARM-*`, `JEWEL-*`, `RING-*` (rings and
    amulets), `MAG-*` other magic and rare items, `BASE-*` plain weapons and armor, `MISC-*` everything else;
  - `TRASH-*` likely junk: magic charms and jewels where every stat is a low roll (rules in `isJunk`,
    `src/lib/organize.js`). Nothing is deleted; the player looks through these and drops what they don't want.
- That starting kit on the emptied characters (starter weapons, potions, scrolls) is dropped.
- What the inbox pages bring: new museum items, new duplicates, likely junk.

Mule names must not clash with other characters; the script refuses if they do.

## 4. Write and hand back

Only after the player agrees, run again with `--yes`. It writes to `<out dir>` after checking every item is kept
exactly once and nothing overlaps; `plan.txt` there lists every move (in Traditional Chinese). Then walk them
through putting the files back ("Putting changed saves back" in docs/saves.md): game closed, backup, copy every
file from the output folder into the save folder, start the game and check.
