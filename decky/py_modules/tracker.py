# Backend of the Decky plugin, without Decky so it can be tested anywhere (../test_tracker.py).
# Finds D2R's saves and game files under Steam's Proton prefixes, turns the game's item icons into PNGs,
# and serves the web app (web/), the saves and the icons on 127.0.0.1.
import base64
import glob
import json
import os
import re
import shutil
import struct
import subprocess
import tempfile
import threading
import time
import zlib
from urllib.parse import unquote
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 18565  # ponytail: fixed port, pick a free one if something else ever takes it
SAVE_EXTENSIONS = (".d2s", ".d2i")


def libraries(home):
    """Steam's steamapps folders: the main one and every library in libraryfolders.vdf (the SD card...).
    A game's Proton prefix is in the library the game is installed in."""
    main = os.path.join(home, ".local/share/Steam/steamapps")
    try:
        with open(os.path.join(main, "libraryfolders.vdf"), encoding="utf-8", errors="replace") as f:
            paths = re.findall(r'"path"\s+"([^"]+)"', f.read())
    except OSError:
        paths = []
    found = [main] + [os.path.join(p, "steamapps") for p in paths]
    return [d for i, d in enumerate(found) if os.path.realpath(d) not in map(os.path.realpath, found[:i])]


def _in_libraries(home, pattern):
    return [d for lib in libraries(home) for d in glob.glob(os.path.join(glob.escape(lib), pattern))]


def _mtime(path):
    try:
        return os.path.getmtime(path)
    except OSError:  # deleted since it was listed
        return 0


def save_dir(home):
    """The save folder; if several prefixes have D2R, the one with the most recently written save."""
    found = _in_libraries(home, "compatdata/*/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected")
    newest = lambda d: max((_mtime(os.path.join(d, f)) for f in list_saves(d)), default=0)
    return max(found, key=newest) if found else None


def game_data_dir(home):
    """The game's CASC storage: Battle.net install in a Proton prefix, or the Steam one."""
    found = _in_libraries(home, "compatdata/*/pfx/drive_c/Program Files (x86)/Diablo II Resurrected/Data")
    found += _in_libraries(home, "common/Diablo II Resurrected/Data")
    return found[0] if found else None


def list_saves(folder):
    try:
        return sorted(f for f in os.listdir(folder) if f.endswith(SAVE_EXTENSIONS) and os.path.isfile(os.path.join(folder, f)))
    except (OSError, TypeError):  # no folder (None), or gone
        return []


def _run(command, **kwargs):
    # Decky points LD_LIBRARY_PATH at its own bundled libraries, which the system's programs must not load
    env = {k: v for k, v in os.environ.items() if k != "LD_LIBRARY_PATH"}
    return subprocess.run(command, env=env, capture_output=True, **kwargs)


def png(width, height, rgba):
    """RGBA pixels as a PNG file, stdlib only."""
    stride = width * 4
    raw = b"".join(b"\x00" + rgba[y * stride : (y + 1) * stride] for y in range(height))

    def chunk(kind, data):
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(raw, 6)) + chunk(b"IEND", b"")


def sprite_to_png(data):
    """D2R SpA1 sprite: u16 version, u16 frame width, u32 total width, u32 height, ... RGBA from byte 40."""
    if data[:4] != b"SpA1":
        raise ValueError("not a SpA1 sprite")
    width, height = struct.unpack_from("<II", data, 8)
    if len(data) < 40 + width * height * 4:
        raise ValueError("sprite is cut short")
    return png(width, height, data[40 : 40 + width * height * 4])


def convert_sprites(sprite_root, out_dir):
    """<group>/<asset dir>/<name>.sprite -> out_dir/<asset dir>/<name>.png, as scripts/gen-images.mjs names them."""
    count = 0
    for path in glob.glob(os.path.join(sprite_root, "*/*/*.sprite")):
        if path.endswith(".lowend.sprite"):
            continue
        sub, name = os.path.basename(os.path.dirname(path)), os.path.basename(path)[: -len(".sprite")]
        os.makedirs(os.path.join(out_dir, sub), exist_ok=True)
        with open(path, "rb") as f:
            data = f.read()
        with open(os.path.join(out_dir, sub, name + ".png"), "wb") as f:
            f.write(sprite_to_png(data))
        count += 1
    return count


def extract_icons(casc, data_dir, out_dir):
    """Pull the inventory icons out of the game files with casc-cli and convert them; returns how many."""
    with tempfile.TemporaryDirectory() as tmp:
        done = _run([casc, "extract", "-o", tmp, data_dir, "data/hd/global/ui/items/**/*.sprite"], timeout=600)
        if done.returncode:
            raise RuntimeError(f"casc failed: {(done.stderr or done.stdout).decode(errors='replace').strip()[-300:]}")
        new_dir = out_dir + ".new"
        shutil.rmtree(new_dir, ignore_errors=True)
        count = convert_sprites(os.path.join(tmp, "data/hd/global/ui/items"), new_dir)
        if not count:
            raise RuntimeError("no item icons found in the game files")
        shutil.rmtree(out_dir, ignore_errors=True)
        os.rename(new_dir, out_dir)
        return count


def game_running():
    """D2R under Proton shows up as a D2R.exe process. pgrep failing is not "not running": writing then
    would race the game, so it raises."""
    code = _run(["pgrep", "-f", "D2R.exe"]).returncode
    if code > 1:
        raise RuntimeError(f"can't tell whether D2R is running (pgrep exited {code}); nothing was written")
    return code == 0


SAVE_NAME = re.compile(r"[^./\\\x00][^/\\\x00]*\.d2[si]")
COMPANIONS = (".ctl", ".key", ".ma0", ".map")  # a character's other files, copied from the template for new mules


def write_saves(folder, files, backup_root, delete=()):
    """Write organized saves into the save folder: files is [{name, bytes, template?}] from the web app's
    organizeFiles; delete: names of emptied characters the player chose to delete, with their other files.
    The game must not be running. The whole folder is backed up first, each file is written next to its target
    and renamed over it, then read back. Returns the backup folder."""
    with _lock:
        return _write_saves(folder, files, backup_root, delete)


def _write_saves(folder, files, backup_root, delete):
    if game_running():
        raise PermissionError("D2R is running; quit the game first")
    for f in files:
        if not SAVE_NAME.fullmatch(f["name"]):
            raise ValueError(f"not a save file name: {f['name']}")
    for name in delete:
        if not SAVE_NAME.fullmatch(name + ".d2s") or any(f["name"] == name + ".d2s" for f in files):
            raise ValueError(f"not a character to delete: {name}")
    backup = _backup(folder, backup_root, {"reason": "organize"})
    try:
        _write(folder, files)
        for name in delete:
            # The save and what the game keeps beside it, as filesOfCharacter in src/lib/organize.js
            for other in os.listdir(folder):
                if re.fullmatch(re.escape(name) + r"\.(d2s|ctl|key|map|ma\d+)", other):
                    os.remove(os.path.join(folder, other))
    except Exception as e:
        _undo(folder, backup, e)
    _prune(backup_root, keep={os.path.basename(backup)})
    return backup


BACKUP_NAME = re.compile(r"\d{8}-\d{6}(-\d+)?")  # when it was made, -2... for a second one in the same second
# What organizing writes (.tmp: one cut short); not settings or loot filters
SAVE_FILE = re.compile(r".+\.(d2s|d2i|ctl|key|map|ma\d+)(\.tmp)?")
ABOUT = ".d2r-backup.json"  # in each backup: why it was made, {"reason": "organize" | "restore", "from"?: name}
KEEP = 10  # backups kept; the oldest past that go when a new one is made
_lock = threading.Lock()  # one write, restore or delete at a time


def _saves_in(folder):
    return {n for n in os.listdir(folder) if SAVE_FILE.fullmatch(n) and os.path.isfile(os.path.join(folder, n))}


def _same_saves(a, b):
    """Whether two folders hold the same saves, byte for byte (what a restore puts back). Read, not filecmp: it
    trusts size and time, and organizing keeps a rewritten save's time on purpose."""

    def read(path):
        with open(path, "rb") as f:
            return f.read()

    names = _saves_in(a)
    return names == _saves_in(b) and all(read(os.path.join(a, n)) == read(os.path.join(b, n)) for n in names)


def _backup(folder, backup_root, about):
    """Copy the save folder to a new backup, unless a backup already holds these same saves: then that one is
    returned, so going back and forth between two states doesn't pile up copies. A new one is copied under a
    .partial name and renamed once complete and on disk, so a copy cut short (disk full) is never listed, nor
    restored over the saves."""
    for b in list_backups(backup_root):
        if _same_saves(folder, os.path.join(backup_root, b["name"])):
            return os.path.join(backup_root, b["name"])
    stamp = time.strftime("%Y%m%d-%H%M%S")
    backup, n = os.path.join(backup_root, stamp), 1
    while os.path.exists(backup) or os.path.exists(backup + ".partial"):
        n += 1
        backup = os.path.join(backup_root, f"{stamp}-{n}")
    try:
        shutil.copytree(folder, backup + ".partial")
        with open(os.path.join(backup + ".partial", ABOUT), "w") as f:
            json.dump(about, f)
        os.sync()
    except Exception:
        shutil.rmtree(backup + ".partial", ignore_errors=True)
        raise
    os.rename(backup + ".partial", backup)
    return backup


def _put_back(folder, backup):
    """Make the save folder's saves (and the files beside them) those of the backup; settings, loot filters and
    folders the player keeps in it are left alone."""
    for name in os.listdir(folder):
        if SAVE_FILE.fullmatch(name) and os.path.isfile(os.path.join(folder, name)) and not os.path.exists(os.path.join(backup, name)):
            os.remove(os.path.join(folder, name))
    for name in os.listdir(backup):
        if SAVE_FILE.fullmatch(name) and os.path.isfile(os.path.join(backup, name)):
            shutil.copy2(os.path.join(backup, name), os.path.join(folder, name))


def _undo(folder, backup, error):
    try:
        _put_back(folder, backup)
        restored = "the save folder is back as it was"
    except Exception:
        restored = "restoring failed"
    raise IOError(f"{error}; {restored}, a backup is in {backup}") from error


def list_backups(backup_root):
    """The plugin's backups, newest first: [{name, characters, reason?, from?}], name being when it was made
    (YYYYMMDD-HHMMSS), reason why ("organize", "restore"; none for backups made before it was recorded)."""
    if not os.path.isdir(backup_root):
        return []
    names = sorted((n for n in os.listdir(backup_root) if BACKUP_NAME.fullmatch(n) and os.path.isdir(os.path.join(backup_root, n))), reverse=True)
    listed = []
    for n in names:
        try:
            with open(os.path.join(backup_root, n, ABOUT)) as f:
                about = json.load(f)
        except (OSError, ValueError):
            about = {}
        listed.append({**about, "name": n, "characters": sum(f.endswith(".d2s") for f in _saves_in(os.path.join(backup_root, n)))})
    return listed


def _prune(backup_root, keep):
    """Delete the oldest backups past KEEP, never those in keep (the one this run made or used, the one restored)."""
    for b in list_backups(backup_root)[KEEP:]:
        if b["name"] not in keep:
            shutil.rmtree(os.path.join(backup_root, b["name"]), ignore_errors=True)


def restore_backup(folder, backup_root, name):
    """Put one of the plugin's backups back in place of the save folder, after backing up the folder as it is
    (so a restore can be undone the same way). Returns that new backup folder."""
    with _lock:
        if game_running():
            raise PermissionError("D2R is running; quit the game first")
        if not any(b["name"] == name for b in list_backups(backup_root)):  # only names from the listing, never a path
            raise ValueError(f"no such backup: {name}")
        backup = _backup(folder, backup_root, {"reason": "restore", "from": name})
        try:
            _put_back(folder, os.path.join(backup_root, name))
        except Exception as e:
            _undo(folder, backup, e)
        _prune(backup_root, keep={os.path.basename(backup), name})
        return backup


def delete_backup(backup_root, name):
    """Delete one of the plugin's backups. Only names from the listing, never a path."""
    with _lock:
        if not any(b["name"] == name for b in list_backups(backup_root)):
            raise ValueError(f"no such backup: {name}")
        shutil.rmtree(os.path.join(backup_root, name))


def _write(folder, files):
    for f in files:
        target = os.path.join(folder, f["name"])
        template = f.get("template") if SAVE_NAME.fullmatch(f.get("template", "") + ".d2s") else None
        for ext in COMPANIONS if template else ():
            source = os.path.join(folder, template + ext)
            other = target[:-4] + ext
            if os.path.isfile(source) and not os.path.exists(other):
                shutil.copy2(source, other)
        # D2R lists characters by when their save last changed: a rewritten save keeps its time, a new mule takes
        # its template's, so organizing doesn't put every mule above the characters played last
        keep = target if os.path.exists(target) else template and os.path.join(folder, template + ".d2s")
        when = os.stat(keep).st_mtime if keep and os.path.exists(keep) else None
        with open(target + ".tmp", "wb") as out:
            out.write(f["bytes"])
            out.flush()
            os.fsync(out.fileno())
        os.replace(target + ".tmp", target)
        if when is not None:
            os.utime(target, (when, when))
    for f in files:
        with open(os.path.join(folder, f["name"]), "rb") as written:
            if written.read() != f["bytes"]:
                raise IOError(f"{f['name']} did not read back the same")


class Handler(SimpleHTTPRequestHandler):
    """GET /api/saves: save file names; /api/saves/<name>: one save; /items/<x>.webp: an icon (PNG);
    anything else: the web app, index.html for unknown paths (the app routes on the client).
    /api/backups: the plugin's backups (list_backups).
    POST /api/write: organized saves to write and characters to delete (write_saves); /api/restore: a backup to put
    back (restore_backup); /api/delete-backup: a backup to delete (delete_backup); /api/close: the app's close
    button (on_close).
    POSTs only from the app itself."""

    web_dir = save_folder = icon_dir = backup_dir = on_close = None  # set by serve()

    def log_message(self, *args):
        pass

    def send_bytes(self, data, kind):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def local(self):
        # A page elsewhere can point its own name at 127.0.0.1 (DNS rebinding); its requests carry that name
        return self.headers.get("Host") == f"127.0.0.1:{self.server.server_address[1]}"

    def end_headers(self):
        # After a plugin update index.html names new assets: never reuse an old copy of it
        if self.path == "/index.html":
            self.send_header("Cache-Control", "no-cache")
        super().end_headers()

    def do_HEAD(self):
        if not self.local():
            return self.send_error(403)
        return super().do_HEAD()

    def do_GET(self):
        if not self.local():
            return self.send_error(403)
        path = self.path.split("?")[0]
        if path == "/api/saves":
            return self.send_bytes(json.dumps(list_saves(self.save_folder())).encode(), "application/json")
        if path == "/api/backups":
            return self.send_bytes(json.dumps(list_backups(self.backup_dir)).encode(), "application/json")
        if path.startswith("/api/saves/"):
            folder = self.save_folder()
            name = unquote(path[len("/api/saves/") :])
            if name not in list_saves(folder):  # only names from the listing, never a path
                return self.send_error(404)
            with open(os.path.join(folder, name), "rb") as f:
                return self.send_bytes(f.read(), "application/octet-stream")
        if path.startswith("/items/") and path.endswith(".webp"):
            icon = os.path.realpath(os.path.join(self.icon_dir, path[len("/items/") : -len(".webp")] + ".png"))
            if not icon.startswith(os.path.realpath(self.icon_dir) + os.sep) or not os.path.isfile(icon):
                return self.send_error(404)
            with open(icon, "rb") as f:
                return self.send_bytes(f.read(), "image/png")
        if not os.path.isfile(os.path.join(self.web_dir, path.lstrip("/"))):
            if path.startswith("/assets/"):  # an old page's script: index.html in its place would load as nothing
                return self.send_error(404)
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        # Only the app's own page: browsers send Origin on every POST, and another site can't send JSON here
        # without a CORS preflight, which this server never answers
        origin = f"http://127.0.0.1:{self.server.server_address[1]}"
        if not self.local() or self.path not in ("/api/write", "/api/restore", "/api/delete-backup", "/api/close") or self.headers.get("Origin") != origin or self.headers.get("Content-Type") != "application/json":
            return self.send_error(403)
        if self.path == "/api/close":
            self.send_response(204)
            self.end_headers()
            return self.on_close()
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.path == "/api/restore":
                result = {"backup": restore_backup(self.save_folder(), self.backup_dir, body["name"])}
            elif self.path == "/api/delete-backup":
                delete_backup(self.backup_dir, body["name"])
                result = {}
            else:
                files = [{**f, "bytes": base64.b64decode(f["data"])} for f in body["files"]]
                result = {"backup": write_saves(self.save_folder(), files, self.backup_dir, body.get("delete", []))}
            status = 200
        except PermissionError as e:
            result, status = {"error": str(e), "running": True}, 409
        except Exception as e:
            result, status = {"error": str(e)}, 500
        data = json.dumps(result).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def translate_path(self, path):
        # Static files from web_dir only
        rel = os.path.normpath(path.split("?")[0]).lstrip("/")
        return os.path.join(self.web_dir, rel)


class Server(ThreadingHTTPServer):
    # The app asks for every save and icon at once; the default backlog of 5 resets the connections past it
    request_queue_size = 128


def serve(web_dir, save_folder, icon_dir, backup_dir, on_close=lambda: None, port=PORT):
    """Start the server in a thread; save_folder is a function, so a new save folder is picked up.
    on_close runs in a request thread when the app's close button is pressed."""
    bound = {"web_dir": web_dir, "save_folder": staticmethod(save_folder), "icon_dir": icon_dir, "backup_dir": backup_dir, "on_close": staticmethod(on_close)}
    handler = type("BoundHandler", (Handler,), bound)
    server = Server(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
