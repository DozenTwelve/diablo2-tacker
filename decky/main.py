# Decky entry point: serves the tracker on 127.0.0.1 while the plugin is loaded (see py_modules/tracker.py).
import asyncio
import os
import shutil

import decky
import tracker

HOME = decky.DECKY_USER_HOME
WEB = os.path.join(decky.DECKY_PLUGIN_DIR, "web")
ICONS = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "items")


def casc():
    # The plugin folder belongs to root and zip installs drop the executable bit: run a copy we own
    copy = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "casc")
    shutil.copyfile(os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "casc"), copy)
    os.chmod(copy, 0o755)
    return copy


class Plugin:
    async def _main(self):
        os.makedirs(decky.DECKY_PLUGIN_RUNTIME_DIR, exist_ok=True)
        self.server = tracker.serve(WEB, lambda: tracker.save_dir(HOME), ICONS)
        decky.logger.info(f"serving on 127.0.0.1:{tracker.PORT}")

    async def _unload(self):
        self.server.shutdown()
        self.server.server_close()

    async def status(self):
        folder = tracker.save_dir(HOME)
        return {
            "url": f"http://127.0.0.1:{tracker.PORT}/",
            "saves": len(tracker.list_saves(folder)),
            "game": tracker.game_data_dir(HOME) is not None,
            "icons": os.path.isdir(ICONS),
        }

    async def extract_icons(self):
        data = tracker.game_data_dir(HOME)
        if not data:
            return {"error": "game files not found"}
        try:
            return {"count": await asyncio.to_thread(tracker.extract_icons, casc(), data, ICONS)}
        except Exception as e:
            decky.logger.exception("icon extraction failed")
            return {"error": str(e)}
