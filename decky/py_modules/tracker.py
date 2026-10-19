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


def compatdata(home):
    return os.path.join(home, ".local/share/Steam/steamapps/compatdata")


def save_dir(home):
    """The save folder; if several prefixes have D2R, the one with the most recently written save."""
    found = glob.glob(os.path.join(compatdata(home), "*/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected"))
    newest = lambda d: max((os.path.getmtime(os.path.join(d, f)) for f in list_saves(d)), default=0)
    return max(found, key=newest) if found else None


def game_data_dir(home):
    """The game's CASC storage: Battle.net install in a Proton prefix, or the Steam one."""
    found = glob.glob(os.path.join(compatdata(home), "*/pfx/drive_c/Program Files (x86)/Diablo II Resurrected/Data"))
    found += glob.glob(os.path.join(home, ".local/share/Steam/steamapps/common/Diablo II Resurrected/Data"))
    return found[0] if found else None


def list_saves(folder):
    if not folder or not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder) if f.endswith(SAVE_EXTENSIONS) and os.path.isfile(os.path.join(folder, f)))


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
        subprocess.run([casc, "extract", "-o", tmp, data_dir, "data/hd/global/ui/items/**/*.sprite"], check=True, capture_output=True, timeout=600)
        new_dir = out_dir + ".new"
        shutil.rmtree(new_dir, ignore_errors=True)
        count = convert_sprites(os.path.join(tmp, "data/hd/global/ui/items"), new_dir)
        if not count:
            raise RuntimeError("no item icons found in the game files")
        shutil.rmtree(out_dir, ignore_errors=True)
        os.rename(new_dir, out_dir)
        return count


def game_running():
    """D2R under Proton shows up as a D2R.exe process."""
    return subprocess.run(["pgrep", "-f", "D2R.exe"], capture_output=True).returncode == 0


SAVE_NAME = re.compile(r"[^./\\\x00][^/\\\x00]*\.d2[si]")
COMPANIONS = (".ctl", ".key", ".ma0", ".map")  # a character's other files, copied from the template for new mules


def write_saves(folder, files, backup_root, delete=()):
    """Write organized saves into the save folder: files is [{name, bytes, template?}] from the web app's
    organizeFiles; delete: names of emptied characters the player chose to delete, with their other files.
    The game must not be running. The whole folder is backed up first, each file is written next to its target
    and renamed over it, then read back. Returns the backup folder."""
    if game_running():
        raise PermissionError("D2R is running; quit the game first")
    for f in files:
        if not SAVE_NAME.fullmatch(f["name"]):
            raise ValueError(f"not a save file name: {f['name']}")
    for name in delete:
        if not SAVE_NAME.fullmatch(name + ".d2s") or any(f["name"] == name + ".d2s" for f in files):
            raise ValueError(f"not a character to delete: {name}")
    backup = _backup(folder, backup_root)
    try:
        _write(folder, files)
        for name in delete:
            # The save and what the game keeps beside it, as filesOfCharacter in src/lib/organize.js
            for other in os.listdir(folder):
                if re.fullmatch(re.escape(name) + r"\.(d2s|ctl|key|map|ma\d+)", other):
                    os.remove(os.path.join(folder, other))
    except Exception as e:
        _undo(folder, backup, e)
    return backup


BACKUP_NAME = re.compile(r"\d{8}-\d{6}")


def _backup(folder, backup_root):
    # ponytail: backups are kept forever (a save folder is a few MB); prune if anyone collects hundreds
    backup = os.path.join(backup_root, time.strftime("%Y%m%d-%H%M%S"))
    shutil.copytree(folder, backup)
    return backup


def _put_back(folder, backup):
    """Make the save folder's files those of the backup; folders the player keeps in it are left alone."""
    for name in os.listdir(folder):
        if os.path.isfile(os.path.join(folder, name)) and not os.path.exists(os.path.join(backup, name)):
            os.remove(os.path.join(folder, name))
    shutil.copytree(backup, folder, dirs_exist_ok=True)


def _undo(folder, backup, error):
    try:
        _put_back(folder, backup)
        restored = "the save folder is back as it was"
    except Exception:
        restored = "restoring failed"
    raise IOError(f"{error}; {restored}, a backup is in {backup}") from error


def list_backups(backup_root):
    """The plugin's backups, newest first: [{name, characters}], name being when it was made (YYYYMMDD-HHMMSS)."""
    if not os.path.isdir(backup_root):
        return []
    names = sorted((n for n in os.listdir(backup_root) if BACKUP_NAME.fullmatch(n)), reverse=True)
    return [{"name": n, "characters": sum(f.endswith(".d2s") for f in os.listdir(os.path.join(backup_root, n)))} for n in names]


def restore_backup(folder, backup_root, name):
    """Put one of the plugin's backups back in place of the save folder, after backing up the folder as it is
    (so a restore can be undone the same way). Returns that new backup folder."""
    if game_running():
        raise PermissionError("D2R is running; quit the game first")
    if not any(b["name"] == name for b in list_backups(backup_root)):  # only names from the listing, never a path
        raise ValueError(f"no such backup: {name}")
    backup = _backup(folder, backup_root)
    try:
        _put_back(folder, os.path.join(backup_root, name))
    except Exception as e:
        _undo(folder, backup, e)
    return backup


def _write(folder, files):
    for f in files:
        target = os.path.join(folder, f["name"])
        for ext in COMPANIONS if f.get("template") else ():
            source = os.path.join(folder, f["template"] + ext)
            other = target[:-4] + ext
            if SAVE_NAME.fullmatch(f["template"] + ".d2s") and os.path.isfile(source) and not os.path.exists(other):
                shutil.copyfile(source, other)
        with open(target + ".tmp", "wb") as out:
            out.write(f["bytes"])
            out.flush()
            os.fsync(out.fileno())
        os.replace(target + ".tmp", target)
    for f in files:
        with open(os.path.join(folder, f["name"]), "rb") as written:
            if written.read() != f["bytes"]:
                raise IOError(f"{f['name']} did not read back the same")


class Handler(SimpleHTTPRequestHandler):
    """GET /api/saves: save file names; /api/saves/<name>: one save; /items/<x>.webp: an icon (PNG);
    anything else: the web app, index.html for unknown paths (the app routes on the client).
    /api/backups: the plugin's backups (list_backups).
    POST /api/write: organized saves to write and characters to delete (write_saves); /api/restore: a backup to put
    back (restore_backup); /api/close: the app's close button (on_close).
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

    def do_GET(self):
        if not self.local():
            return self.send_error(403)
        path = self.path.split("?")[0]
        folder = self.save_folder()
        if path == "/api/saves":
            return self.send_bytes(json.dumps(list_saves(folder)).encode(), "application/json")
        if path == "/api/backups":
            return self.send_bytes(json.dumps(list_backups(self.backup_dir)).encode(), "application/json")
        if path.startswith("/api/saves/"):
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
            self.path = "/index.html"
        return super().do_GET()

    def do_POST(self):
        # Only the app's own page: browsers send Origin on every POST, and another site can't send JSON here
        # without a CORS preflight, which this server never answers
        origin = f"http://127.0.0.1:{self.server.server_address[1]}"
        if not self.local() or self.path not in ("/api/write", "/api/restore", "/api/close") or self.headers.get("Origin") != origin or self.headers.get("Content-Type") != "application/json":
            return self.send_error(403)
        if self.path == "/api/close":
            self.send_response(204)
            self.end_headers()
            return self.on_close()
        try:
            body = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
            if self.path == "/api/restore":
                result = {"backup": restore_backup(self.save_folder(), self.backup_dir, body["name"])}
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
