# Decky entry point: serves the tracker on 127.0.0.1 from "Open collection" until it is closed (see py_modules/tracker.py).
import asyncio
import os
import shutil

import decky
import tracker

HOME = decky.DECKY_USER_HOME
WEB = os.path.join(decky.DECKY_PLUGIN_DIR, "web")
ICONS = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "items")
BACKUPS = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "backups")


def casc():
    # The plugin folder belongs to root and zip installs drop the executable bit: run a copy we own
    copy = os.path.join(decky.DECKY_PLUGIN_RUNTIME_DIR, "casc")
    shutil.copyfile(os.path.join(decky.DECKY_PLUGIN_DIR, "bin", "casc"), copy)
    os.chmod(copy, 0o755)
    return copy


class Plugin:
    server = None
    stopping = None  # the server being shut down: opening again waits for it to let go of the port
    extracting = False  # here, not in the panel: closing and reopening the menu must not start a second one

    async def _main(self):
        os.makedirs(decky.DECKY_PLUGIN_RUNTIME_DIR, exist_ok=True)
        self.loop = asyncio.get_running_loop()

    async def _unload(self):
        await self.stop()

    async def start(self):
        if self.stopping:
            await self.stopping
        if not self.server:
            # Picked once per opening: with D2R in two prefixes, a restore gives saves their old times and the
            # newest-save rule would move the page to the other prefix, away from the restore's own backup
            folder = tracker.save_dir(HOME, BACKUPS)
            try:
                self.server = tracker.serve(WEB, lambda: folder, ICONS, BACKUPS, self.closed)
            except OSError as e:
                raise RuntimeError(f"port {tracker.PORT} is taken by another program ({e.strerror})") from e
            decky.logger.info(f"serving on 127.0.0.1:{tracker.PORT}")
        return f"http://127.0.0.1:{tracker.PORT}/"

    async def stop(self):
        server, self.server = self.server, None
        if server:
            self.stopping = asyncio.ensure_future(self._close(server))
            await self.stopping

    async def _close(self, server):
        # shutdown() waits for serve_forever, which a request thread mustn't block on
        await asyncio.to_thread(server.shutdown)
        server.server_close()
        decky.logger.info("stopped serving")

    def closed(self):
        # The app's close button, from a request thread: the panel leaves the browser, then the server stops
        asyncio.run_coroutine_threadsafe(decky.emit("closed"), self.loop)
        asyncio.run_coroutine_threadsafe(self.stop(), self.loop)

    async def status(self):
        folder = tracker.save_dir(HOME)
        return {
            "saves": len(tracker.list_saves(folder)),
            "game": tracker.game_data_dir(HOME) is not None,
            "icons": os.path.isdir(ICONS),
            "running": self.server is not None,
            "extracting": self.extracting,
        }

    async def extract_icons(self):
        data = tracker.game_data_dir(HOME)
        if not data:
            return {"error": "game files not found"}
        if self.extracting:
            return {"error": "already getting the icons"}
        self.extracting = True
        try:
            return {"count": await asyncio.to_thread(tracker.extract_icons, casc(), data, ICONS)}
        except Exception as e:
            decky.logger.exception("icon extraction failed")
            return {"error": str(e)}
        finally:
            self.extracting = False
