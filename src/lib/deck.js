// In the Steam Deck plugin (decky/, built with VITE_DECK=1) the saves come from the plugin's server
// on the Deck instead of a file picker.
export const onDeck = import.meta.env.VITE_DECK === "1";

const get = async (url) => {
  const response = await fetch(url);
  if (!response.ok) throw new Error(`${url}: ${response.status}`);
  return response;
};

const post = (url, body) => fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

// The close button: the plugin leaves Steam's browser and stops its server
export const closeDeck = () => post("/api/close", {});

// The plugin's backups of the save folder, newest first: [{ name: "YYYYMMDD-HHMMSS", characters }]; restoring one
// backs up the folder as it is first
export const deckBackups = async () => (await get("/api/backups")).json();
export const restoreDeck = (name) => post("/api/restore", { name });
export const deleteDeckBackup = (name) => post("/api/delete-backup", { name });

export async function deckSaveFiles() {
  const names = await (await get("/api/saves")).json();
  return Promise.all(names.map(async (name) => new File([await (await get(`/api/saves/${encodeURIComponent(name)}`)).blob()], name)));
}
