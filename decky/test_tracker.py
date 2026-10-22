# python3 test_tracker.py [sprite dir]: checks tracker.py; with a sprite dir (data/hd/global/ui/items) also converts the real icons.
import base64
import json
import os
import struct
import sys
import tempfile
import urllib.request
import zlib
from urllib.error import HTTPError
from urllib.parse import quote

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "py_modules"))
import tracker  # noqa: E402

# A 2x1 sprite: red, transparent
sprite = b"SpA1" + struct.pack("<HHII", 31, 2, 2, 1) + bytes(24) + bytes([255, 0, 0, 255, 0, 0, 0, 0])
data = tracker.sprite_to_png(sprite)
assert data[:8] == b"\x89PNG\r\n\x1a\n"
width, height = struct.unpack(">II", data[16:24])
assert (width, height) == (2, 1)
idat = data[data.index(b"IDAT") + 4 : data.index(b"IEND") - 8]
assert zlib.decompress(idat) == b"\x00" + bytes([255, 0, 0, 255, 0, 0, 0, 0])

with tempfile.TemporaryDirectory() as tmp:
    home = os.path.join(tmp, "home")
    prefix = "compatdata/123/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected"
    steamapps = os.path.join(home, ".local/share/Steam/steamapps")
    old = os.path.join(steamapps, prefix)
    os.makedirs(old)
    open(os.path.join(old, "Old.d2s"), "wb").write(b"old")
    os.utime(os.path.join(old, "Old.d2s"), (0, 0))
    # The game on the SD card: its prefix is in that library, listed in libraryfolders.vdf
    sd = os.path.join(tmp, "sd card")
    saves = os.path.join(sd, "steamapps", prefix)
    os.makedirs(saves)
    open(os.path.join(steamapps, "libraryfolders.vdf"), "w").write(f'"libraryfolders"\n{{\n "0"\n {{\n  "path"\t\t"{home}/.local/share/Steam"\n }}\n "1"\n {{\n  "path"\t\t"{sd}"\n }}\n}}\n')
    for name in ["Zanna.d2s", "Mule 二.d2s", "SharedStash.d2i", "Zanna.key", "Zanna.ma1", "Zanna-old.d2s", "OLD.D2S"]:
        open(os.path.join(saves, name), "wb").write(name.encode())
    assert tracker.save_dir(home) == saves  # the newest saves, on the SD card
    os.makedirs(os.path.join(sd, "steamapps/common/Diablo II Resurrected/Data"))
    assert tracker.game_data_dir(home) == os.path.join(sd, "steamapps/common/Diablo II Resurrected/Data")

    # pgrep failing is not "the game is not running"
    fake = os.path.join(tmp, "bin")
    os.makedirs(fake)
    path = os.environ["PATH"]
    for code, running in ((0, True), (1, False), (2, None)):
        open(os.path.join(fake, "pgrep"), "w").write(f"#!/bin/sh\nexit {code}\n")
        os.chmod(os.path.join(fake, "pgrep"), 0o755)
        os.environ["PATH"] = fake + os.pathsep + path
        try:
            assert tracker.game_running() == running
        except RuntimeError:
            assert running is None
    os.environ["PATH"] = path
    assert tracker.list_saves(saves) == ["Mule 二.d2s", "SharedStash.d2i", "Zanna-old.d2s", "Zanna.d2s"]

    web, icons = os.path.join(tmp, "web"), os.path.join(tmp, "icons")
    os.makedirs(web)
    open(os.path.join(web, "index.html"), "w").write("app")
    os.makedirs(os.path.join(icons, "axe"))
    open(os.path.join(icons, "axe/hand_axe.png"), "wb").write(data)
    backups = os.path.join(tmp, "backups")
    closed = []
    server = tracker.serve(web, lambda: saves, icons, backups, on_close=lambda: closed.append(1), port=0)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    get = lambda path: urllib.request.urlopen(base + path).read()

    def missing(path):
        try:
            get(path)
        except HTTPError as e:
            return e.code == 404
        return False

    assert json.loads(get("/api/saves")) == tracker.list_saves(saves)
    # The app asks for every save and icon at once
    from concurrent.futures import ThreadPoolExecutor
    with ThreadPoolExecutor(64) as pool:
        assert all(pool.map(lambda _: get("/api/saves/Zanna.d2s") == b"Zanna.d2s", range(200)))
    assert get("/api/saves/" + quote("Mule 二.d2s")) == "Mule 二.d2s".encode()
    assert missing("/api/saves/Zanna.key") and missing("/api/saves/..%2f..%2fetc%2fpasswd")
    assert get("/items/axe/hand_axe.webp") == data
    assert missing("/items/../web/index.webp") and missing("/items/axe/none.webp")
    assert get("/characters/Zanna") == b"app" and get("/") == b"app"
    assert get("/../../../etc/passwd") == b"app"
    assert missing("/assets/index-old.js")  # an old page's script, after an update: not index.html in its place
    assert urllib.request.urlopen(base + "/").headers["Cache-Control"] == "no-cache"
    try:
        urllib.request.urlopen(urllib.request.Request(base + "/index.html", method="HEAD", headers={"Host": "evil.example"}))
        raise AssertionError("HEAD served another host")
    except HTTPError as e:
        assert e.code == 403

    def post(body, origin=base, kind="application/json", path="/api/write"):
        request = urllib.request.Request(base + path, json.dumps(body).encode(), {"Origin": origin, "Content-Type": kind})
        try:
            response = urllib.request.urlopen(request)
            return response.status, json.loads(response.read() or "null")
        except HTTPError as e:
            return e.code, None

    assert post({}, origin="http://evil.example", path="/api/close")[0] == 403 and not closed
    assert post({}, path="/api/close")[0] == 204 and closed
    new = [{"name": "UW-A.d2s", "data": base64.b64encode(b"mule").decode(), "template": "Zanna"}]
    assert post({"files": new}, origin="http://evil.example")[0] == 403
    assert post({"files": new}, kind="text/plain")[0] == 403
    assert post({"files": [{"name": "../x.d2s", "data": ""}]})[0] == 500
    tracker.game_running = lambda: True
    assert post({"files": new})[0] == 409
    tracker.game_running = lambda: False
    status, result = post({"files": new})
    assert status == 200, result
    assert open(os.path.join(saves, "UW-A.d2s"), "rb").read() == b"mule"
    assert open(os.path.join(saves, "UW-A.key"), "rb").read() == b"Zanna.key"  # copied from the template
    assert os.listdir(result["backup"]) and "UW-A.d2s" not in os.listdir(result["backup"])
    assert not [f for f in os.listdir(saves) if f.endswith(".tmp")]

    # A write that fails half way puts the folder back as it was
    os.mkdir(os.path.join(saves, "Bad.d2s"))
    before = sorted(os.listdir(saves))
    broken = [{"name": "UW-B.d2s", "data": base64.b64encode(b"x").decode(), "template": "Zanna"}, {"name": "Bad.d2s", "data": ""}]
    import time; time.sleep(1)  # backups are named by the second
    assert post({"files": broken})[0] == 500
    assert sorted(os.listdir(saves)) == before, (sorted(os.listdir(saves)), before)
    os.rmdir(os.path.join(saves, "Bad.d2s"))

    # Emptied characters the player chose go, with their other files; never one being written
    assert post({"files": new, "delete": ["UW-A"]})[0] == 500
    assert post({"files": new, "delete": ["../Zanna"]})[0] == 500
    time.sleep(1)
    status, result = post({"files": new, "delete": ["Zanna"]})
    assert status == 200, result
    assert "Zanna-old.d2s" in os.listdir(saves)  # another character whose name starts the same
    assert not {"Zanna.d2s", "Zanna.key", "Zanna.ma1"} & set(os.listdir(saves)) and {"Zanna.d2s", "Zanna.key", "Zanna.ma1"} <= set(os.listdir(result["backup"]))

    # Deleting that fails half way puts the folder back too
    open(os.path.join(saves, "Gone.d2s"), "wb").write(b"gone")
    os.mkdir(os.path.join(saves, "Gone.ma1"))
    before = sorted(os.listdir(saves))
    time.sleep(1)
    assert post({"files": new, "delete": ["Gone"]})[0] == 500
    assert sorted(os.listdir(saves)) == before and open(os.path.join(saves, "Gone.d2s"), "rb").read() == b"gone"
    os.rmdir(os.path.join(saves, "Gone.ma1"))

    # A backup cut short (an unreadable file here; a full disk on the Deck) is neither kept nor listed
    listed = json.loads(get("/api/backups"))
    locked = os.path.join(saves, "Locked.d2s")
    open(locked, "wb").write(b"x")
    os.chmod(locked, 0)
    assert post({"files": new})[0] == 500
    os.chmod(locked, 0o644)
    os.remove(locked)
    assert json.loads(get("/api/backups")) == listed and not [n for n in os.listdir(backups) if n.endswith(".partial")]
    # Two in one second get two names; a stray file named like one is no backup
    two = [tracker._backup(saves, backups) for _ in range(2)]
    assert two[0] != two[1]
    for b in two:
        tracker.shutil.rmtree(b)
    open(os.path.join(backups, "20000101-000000"), "w").write("not a backup")

    # Backups, newest first, and putting one back: the folder's saves become exactly those of that backup, after a
    # backup of itself; settings and loot filters stay as they are
    listed = json.loads(get("/api/backups"))
    assert [b["name"] for b in listed] == sorted((n for n in os.listdir(backups) if n != "20000101-000000"), reverse=True)
    zanna = os.path.basename(result["backup"])  # made before Zanna was deleted
    assert next(b for b in listed if b["name"] == zanna)["characters"] == 4  # Zanna, Zanna-old, Mule 二, UW-A
    assert post({"name": "../web"}, path="/api/restore")[0] == 500 and post({"name": "20990101-000000"}, path="/api/restore")[0] == 500
    tracker.game_running = lambda: True
    assert post({"name": zanna}, path="/api/restore")[0] == 409
    tracker.game_running = lambda: False
    os.mkdir(os.path.join(saves, "my old saves"))  # a folder the player keeps there
    open(os.path.join(saves, "Settings.json"), "w").write("changed since")
    now = sorted(os.listdir(saves))
    time.sleep(1)
    status, restored = post({"name": zanna}, path="/api/restore")
    assert status == 200, restored
    assert sorted(os.listdir(saves)) == sorted(os.listdir(os.path.join(backups, zanna)) + ["my old saves", "Settings.json"]) and "Zanna.ma1" in os.listdir(saves)
    assert open(os.path.join(saves, "Settings.json")).read() == "changed since"
    assert sorted(os.listdir(restored["backup"])) == now  # the folder as it was before, to undo the restore
    assert post({"name": zanna}, origin="http://evil.example", path="/api/restore")[0] == 403

    # Only requests to 127.0.0.1 itself: another name pointed at it (DNS rebinding) gets nothing
    request = urllib.request.Request(base + "/api/saves", headers={"Host": "evil.example"})
    try:
        urllib.request.urlopen(request)
        raise AssertionError("served a request for another host")
    except HTTPError as e:
        assert e.code == 403
    server.shutdown()

if len(sys.argv) > 1:
    with tempfile.TemporaryDirectory() as out:
        print(tracker.convert_sprites(sys.argv[1], out), "icons converted")
print("tracker ok")
