# Backend of the Decky plugin, without Decky so it can be tested anywhere (../test_tracker.py).
# Finds D2R's saves and game files under Steam's Proton prefixes, turns the game's item icons into PNGs,
# and serves the web app (web/), the saves and the icons on 127.0.0.1.
import glob
import json
import os
import shutil
import struct
import subprocess
import tempfile
import threading
import zlib
from urllib.parse import unquote
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer

PORT = 18565  # ponytail: fixed port, pick a free one if something else ever takes it
SAVE_EXTENSIONS = (".d2s", ".d2i")


def compatdata(home):
    return os.path.join(home, ".local/share/Steam/steamapps/compatdata")


def save_dir(home):
    """The save folder, the most recently used one if several prefixes have D2R."""
    found = glob.glob(os.path.join(compatdata(home), "*/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected"))
    return max(found, key=os.path.getmtime) if found else None


def game_data_dir(home):
    """The game's CASC storage: Battle.net install in a Proton prefix, or the Steam one."""
    found = glob.glob(os.path.join(compatdata(home), "*/pfx/drive_c/Program Files (x86)/Diablo II Resurrected/Data"))
    found += glob.glob(os.path.join(home, ".local/share/Steam/steamapps/common/Diablo II Resurrected/Data"))
    return found[0] if found else None


def list_saves(folder):
    if not folder or not os.path.isdir(folder):
        return []
    return sorted(f for f in os.listdir(folder) if f.lower().endswith(SAVE_EXTENSIONS) and os.path.isfile(os.path.join(folder, f)))


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


class Handler(SimpleHTTPRequestHandler):
    """/api/saves: save file names; /api/saves/<name>: one save; /items/<x>.webp: an icon (PNG);
    anything else: the web app, index.html for unknown paths (the app routes on the client)."""

    web_dir = save_folder = icon_dir = None  # set by serve()

    def log_message(self, *args):
        pass

    def send_bytes(self, data, kind):
        self.send_response(200)
        self.send_header("Content-Type", kind)
        self.send_header("Content-Length", str(len(data)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path = self.path.split("?")[0]
        folder = self.save_folder()
        if path == "/api/saves":
            return self.send_bytes(json.dumps(list_saves(folder)).encode(), "application/json")
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

    def translate_path(self, path):
        # Static files from web_dir only
        rel = os.path.normpath(path.split("?")[0]).lstrip("/")
        return os.path.join(self.web_dir, rel)


def serve(web_dir, save_folder, icon_dir, port=PORT):
    """Start the server in a thread; save_folder is a function, so a new save folder is picked up."""
    handler = type("BoundHandler", (Handler,), {"web_dir": web_dir, "save_folder": staticmethod(save_folder), "icon_dir": icon_dir})
    server = ThreadingHTTPServer(("127.0.0.1", port), handler)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    return server
