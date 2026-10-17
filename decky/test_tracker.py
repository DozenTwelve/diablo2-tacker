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
    saves = os.path.join(tracker.compatdata(home), "123/pfx/drive_c/users/steamuser/Saved Games/Diablo II Resurrected")
    os.makedirs(saves)
    for name in ["Zanna.d2s", "Mule 二.d2s", "SharedStash.d2i", "Zanna.key", "OLD.D2S"]:
        open(os.path.join(saves, name), "wb").write(name.encode())
    assert tracker.save_dir(home) == saves
    assert tracker.list_saves(saves) == ["Mule 二.d2s", "SharedStash.d2i", "Zanna.d2s"]

    web, icons = os.path.join(tmp, "web"), os.path.join(tmp, "icons")
    os.makedirs(web)
    open(os.path.join(web, "index.html"), "w").write("app")
    os.makedirs(os.path.join(icons, "axe"))
    open(os.path.join(icons, "axe/hand_axe.png"), "wb").write(data)
    backups = os.path.join(tmp, "backups")
    server = tracker.serve(web, lambda: saves, icons, backups, port=0)
    base = f"http://127.0.0.1:{server.server_address[1]}"
    get = lambda path: urllib.request.urlopen(base + path).read()

    def missing(path):
        try:
            get(path)
        except HTTPError as e:
            return e.code == 404
        return False

    assert json.loads(get("/api/saves")) == tracker.list_saves(saves)
    assert get("/api/saves/" + quote("Mule 二.d2s")) == "Mule 二.d2s".encode()
    assert missing("/api/saves/Zanna.key") and missing("/api/saves/..%2f..%2fetc%2fpasswd")
    assert get("/items/axe/hand_axe.webp") == data
    assert missing("/items/../web/index.webp") and missing("/items/axe/none.webp")
    assert get("/characters/Zanna") == b"app" and get("/") == b"app"
    assert get("/../../../etc/passwd") == b"app"

    def post(body, origin=base, kind="application/json"):
        request = urllib.request.Request(base + "/api/write", json.dumps(body).encode(), {"Origin": origin, "Content-Type": kind})
        try:
            return 200, json.loads(urllib.request.urlopen(request).read())
        except HTTPError as e:
            return e.code, None

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
    assert sorted(os.listdir(saves)) == before
    os.rmdir(os.path.join(saves, "Bad.d2s"))

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
