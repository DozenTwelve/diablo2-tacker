---
name: organize-stash
description: Organize a Diablo II Resurrected player's mules and shared stash with scripts/organize.mjs from the diablo2-tacker repository, first time or as upkeep (inbox pages, likely-junk TRASH mules), with the default rules or the player's own. Use when someone wants their D2R saves sorted into mules, new finds put away, or the sorting rules changed (整理骡子, 整理仓库, 整理騾子, 整理倉庫).
---

# Organize a D2R stash

The player's saves are theirs. Never change them in place: read from their folder (or a copy), write to a new
folder, and let them copy the result back. Saves stay on this machine; never send them to any service. Talk to the
player in their language and in plain words; they are a player, not a programmer.

## 0. Work from a clone of the repository

Everything here runs the repository's own code. Check that the working directory is a clone of it:

```bash
test -f scripts/organize.mjs && test -f src/lib/organize.js && echo ok
```

If not (the skill was installed on its own, with `npx` or by copying this file), stop and tell the player to clone
it first, then open the agent again inside the folder:

```bash
git clone https://github.com/DozenTwelve/diablo2-tacker
cd diablo2-tacker
```

Then check Node.js 20 or newer (`node -v`; if missing, point them to https://nodejs.org) and run `npm install` once.
Rust is not needed: the save parser in `wasm/pkg/` is committed.

## 1. Is this skill needed?

Ask whether they want the default rules or their own.

- **Default rules**: the Organize page at https://d2r.diamonddoge.org does the same thing in the browser, with
  the same checks, and hands back a zip. Offer it; carry on here only if they prefer the agent.
- **Their own rules** (different groups, order, junk thresholds, no museum...): read [rules.md](rules.md) after
  the dry run in step 3, change the rules there, and dry-run again.

## 2. Get the saves and a backup

[docs/saves.md](../../../docs/saves.md) has every path and command. Offer to do the copying yourself; if they
would rather do it, walk them through it.

- **Saves on this computer**: Windows `%USERPROFILE%\Saved Games\Diablo II Resurrected`; on Linux or a Deck in
  desktop mode, find it with the `find` command in docs/saves.md.
- **Saves on a Steam Deck, agent on another computer**: with SSH on the Deck (docs/saves.md says how), copy the
  folder into a new local folder with the `tar` command there; `scp` breaks on the spaces in the path.

D2R must be closed first: it writes the saves when it exits. Then the backup, before anything else: a copy of the
whole folder, every file, e.g. `<save dir>-backup-<date>`. A folder pulled off a Deck is already a copy; leave it
as it is, as the backup, and organize from it (the script only reads its input). Then read the saves:

```bash
node scripts/check-saves.mjs <save dir>
```

It lists every character by game mode, highest level first (class, level, how many items), and how many items each
shared stash page holds. Show the player this list in plain words: step 3 asks about it. Exit code 1 means a save
it can't read (see "When it fails").

## 3. Decide what to organize, then dry-run

- **Game mode**: one per run, `--mode SoftCore:Modern` by default. Modern is Reign of the Warlock, Legacy older
  saves, HardCore for hardcore characters; the list from step 2 shows which modes they have. More than one: see
  "Several game modes" below.
- **Mules**: by default every level 1 character of the mode is emptied. Go through the list with them: is every
  level 1 character a mule? If one is a new main, or a higher level one is a mule, name the mules:
  `--mules a,b,c`.
- **Inbox pages**: which shared stash pages hold new finds, e.g. `--inbox 4,5`. Without it every shared stash page
  is emptied: right for a first run, wrong when other pages are working sets (a main's charm page, for example).
  Ask; the stackable page (gems, runes) is never touched.

```bash
node scripts/organize.mjs <save dir> <out dir> [--mode ...] [--mules ...] [--inbox ...]
```

`<out dir>` must not exist yet, e.g. `~/D2R-organized-<date>`. Without `--yes` nothing is written; it prints the
plan. Explain it before going on:

- Which characters are emptied (listed with class and level), and that every other character is left alone.
- How many mules it makes and what goes where:
  - `UW-*` unique weapons, `UA-*` unique armor, `UJ-*` unique rings, amulets, charms and jewels, `SET-*` set
    items: the "museum", one fixed slot per item in the game, so an empty slot is an item still missing;
  - `DUP-*` extra copies of uniques and set items, `RW-*` runewords, `CHARM-*`, `JEWEL-*`, `RING-*` (rings and
    amulets), `MAG-*` other magic and rare items, `BASE-*` plain weapons and armor, `MISC-*` everything else;
  - `TRASH-*` likely junk: magic charms and jewels where every stat is a low roll. The dry run lists each one.
    Nothing is deleted; the player looks through these in game and drops what they don't want.
- That starting kit on the emptied characters (starter weapons, potions, scrolls) is dropped.
- What the inbox pages bring: new museum items, new duplicates, likely junk.
- The museum line (`UW 50/86` ...) is how much of the collection they have.
- `left empty`: emptied characters no new mule takes the name of. Ask which of them to delete, none by default;
  name them with `--delete a,b` (only these names are taken). The rest stay as empty characters.

## 4. Write and hand back

Only after the player agrees, run the same command again with `--yes` (and `--delete` for
the characters they picked). Before writing it checks that every item is
kept exactly once (only starting kit dropped), that nothing overlaps or sits outside a grid, and that shared stash
pages that are not inboxes come back unchanged. The new mules are clones of one emptied character (a Barbarian if
there is one), with its `.ctl`/`.key`/`.ma0`/`.map` files copied alongside. `plan.txt` lists every move, in
Traditional Chinese: from where, the item, to which mule, page and cell. For a player who reads another language,
don't hand it over; answer their questions ("where did my Shako go?") from it in their language.

Then the files go back into the save folder ("Putting changed saves back" in docs/saves.md). Offer to copy them
yourself, and do it only when the player says yes for this run: D2R closed, the backup from step 2 still there,
then copy every file from `<out dir>` except `plan.txt` and `delete.txt` into the save folder, replacing what is
there, then delete the files `delete.txt` lists from the save folder, and nothing else. To a Deck, use the two
commands from docs/saves.md (without `COPYFILE_DISABLE=1` macOS adds `._*` files).
Ask them to start the game and look at a few mules. If anything looks wrong: quit and put the backup back.

## Several game modes

One run per mode, each reading the same save folder and writing to its own output folder:

```bash
node scripts/organize.mjs <save dir> ~/D2R-organized-<date> --yes
node scripts/organize.mjs <save dir> ~/D2R-organized-<date>-hardcore --mode HardCore:Modern --yes
```

Mule names start with `H` for hardcore and `L` for legacy (`HUW-A`, `LDUP-A`, `HLSET-A`), so the modes never share
a file name; only `plan.txt` repeats. Each mode has its own shared stash, so ask about inbox pages per mode. Dry-run
and explain each mode first (the same commands without `--yes`), then copy every output folder back.

## Upkeep, later runs

The player keeps dropping finds on their inbox pages and runs this again with the same `--inbox`. The mules made
last time are level 1 characters, so they are emptied and rebuilt with everything else; nothing needs listing,
and the new layout may reuse their names. Characters with clashing names that are not being emptied stop the run.

## When it fails

| Message | What it means, what to do |
|---|---|
| `no mules in <mode>` | No level 1 character in that mode: wrong `--mode`, or name the mules with `--mules`. |
| `<file> does not round-trip, not touching it` | The parser can't write that save back exactly; nothing is written. Leave that file out of a copy of the folder and run again; report it as a GitHub issue. |
| `mule names already used by other characters: ...` | A character that is not being emptied has a mule's name (`UW-A`...). Add it to `--mules` if it is an old mule, or have the player rename it. |
| `<out dir> or <out dir>.partial already exists` | Pick a new output folder, or delete the old one after checking it is not needed. |
| `... does not fit in an empty mule` / `item check failed` | A bug, or a rule change that broke something. Nothing was written. With the default rules, report it as a GitHub issue. |
