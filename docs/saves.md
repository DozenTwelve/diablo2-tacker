# Getting saves in and out

The tracker reads a D2R save folder: `.d2s` files are characters, `.d2i` files shared stashes. Only offline
characters are saved locally; online (Battle.net) characters live on Blizzard's servers and can't be read.
Consoles are not supported.

## Where the save folder is

- **Windows**: `%USERPROFILE%\Saved Games\Diablo II Resurrected` (paste it into the folder picker's address bar).
- **Steam Deck**: D2R runs under Proton, usually Battle.net added as a non-Steam game, so its prefix has a
  different number on every Deck. In desktop mode, open Konsole and run:

  ```bash
  find ~/.local/share/Steam/steamapps/compatdata -type d -path "*/Saved Games/Diablo II Resurrected"
  ```

  It prints something like
  `/home/deck/.local/share/Steam/steamapps/compatdata/<number>/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected`.
  In a folder picker, Ctrl+H shows hidden folders such as `.local`.

Each character has several files with the same name (`.d2s`, `.ctl`, `.key`, `.ma0`, `.map`); the tracker only needs
`.d2s` and `.d2i`, but copy the whole folder when backing up.

## Reading saves on another computer

Copy the folder to a USB stick, or over the network. From a Mac or Linux computer, with SSH enabled on the Deck
(`passwd`, then `sudo systemctl enable --now sshd`):

```bash
ssh deck@<deck ip> "cd '<save folder>' && tar -cf - ." < /dev/null | tar -xf - -C ~/D2R-saves
```

`tar` instead of `scp` because `scp` trips over the spaces in the path.

## Putting changed saves back

Saves written by `scripts/organize.mjs` go to a new folder; nothing is changed in place.

1. Quit D2R completely. The game writes its saves on exit and would overwrite the new ones.
2. Back up the whole save folder, e.g. copy it to `D2R-backup-<date>`.
3. Copy every file from the output folder into the save folder, replacing what is there (`plan.txt` is only a list
   of moves and can be left out).
4. Start D2R and check the mules. If anything is wrong, quit and copy the backup back.

From a Mac to a Deck, `COPYFILE_DISABLE=1` keeps macOS from adding `._*` files:

```bash
cd <output folder> && COPYFILE_DISABLE=1 tar -cf - --exclude plan.txt . | ssh deck@<deck ip> "tar -xf - -C '<save folder>'"
```
