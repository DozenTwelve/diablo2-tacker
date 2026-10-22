import { useEffect, useRef, useState } from "react";
import { parseSaveFiles } from "../lib/parseSaves";
import { t } from "../lib/i18n";
import { deckSaveFiles, onDeck } from "../lib/deck";

const DECK_FIND = `find ~/.local/share/Steam/steamapps/compatdata -type d -path "*/Saved Games/Diablo II Resurrected"`;

// The file inputs stay focusable (sr-only, not display:none) so saves can be picked from the keyboard.
// A panel on the welcome page, or compact: a menu in the top bar. onLoad(saveData, files as picked).
export default function SaveLoader({ saveData, onLoad, notStored, lang, compact }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);
  const menu = useRef(null);
  // The top bar menu closes on Esc or a click outside it
  useEffect(() => {
    if (!compact) return;
    const close = (e) => {
      const m = menu.current;
      if (m?.open && (e.key === "Escape" || (e.type === "pointerdown" && !m.contains(e.target)))) m.open = false;
    };
    addEventListener("pointerdown", close);
    addEventListener("keydown", close);
    return () => {
      removeEventListener("pointerdown", close);
      removeEventListener("keydown", close);
    };
  }, [compact]);

  // files: the picked files, or a promise of them (read from the Deck)
  const load = async (files) => {
    setBusy(true);
    try {
      files = await files;
      if (!files.length) return;
      const data = await parseSaveFiles(files);
      // A folder without saves would replace the loaded ones with nothing
      if (!data.files) return setError(t("noSaveFiles", lang));
      onLoad(data, files);
      setError(null);
      if (menu.current) menu.current.open = false;
    } catch (e) {
      setError(t("readFailed", lang, e.message ?? e));
    } finally {
      setBusy(false);
    }
  };
  const handleFiles = (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    load(files);
  };

  const body = (
    <div className="space-y-3">
      <p className="text-sm">
        {busy
          ? t("parsing", lang)
          : saveData
            ? t("loaded", lang, saveData.files, saveData.items.length, new Date(saveData.loadedAt).toLocaleString())
            : t("noSaves", lang)}
      </p>
      <div className="flex flex-wrap gap-3 items-center">
        {onDeck ? (
          <button className="gothic-btn gothic-btn-small" onClick={() => load(deckSaveFiles())}>
            {t("reloadSaves", lang)}
          </button>
        ) : (
          <>
            <label
              className="gothic-btn gothic-btn-small focus-within:outline focus-within:outline-2"
              style={{ cursor: "pointer", margin: 0 }}
            >
              {t("pickFolder", lang)}
              <input type="file" webkitdirectory="" multiple onChange={handleFiles} className="sr-only" />
            </label>
            <label
              className="gothic-btn gothic-btn-secondary gothic-btn-small focus-within:outline focus-within:outline-2"
              style={{ cursor: "pointer", margin: 0 }}
            >
              {t("pickFiles", lang)}
              <input type="file" accept=".d2s,.d2i" multiple onChange={handleFiles} className="sr-only" />
            </label>
          </>
        )}
        {saveData && !onDeck && (
          <button className="gothic-btn gothic-btn-secondary gothic-btn-small" onClick={() => onLoad(null)}>
            {t("clear", lang)}
          </button>
        )}
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      {notStored && <p className="text-sm text-red-400">{t("notStored", lang)}</p>}
      {saveData?.errors.map((err, i) => (
        <p key={i} className="text-sm text-red-400">
          {err}
        </p>
      ))}
      <p className="text-xs gothic-text-muted">{t("privacy", lang)}</p>
      {!onDeck && (
        <details className="text-xs gothic-text-muted space-y-2">
          <summary style={{ cursor: "pointer" }}>{t("whereSaves", lang)}</summary>
          <p>
            Windows: <code className="select-all">%USERPROFILE%\Saved Games\Diablo II Resurrected</code>
          </p>
          <p>{t("savesDeck", lang)}</p>
          <code className="block select-all break-all">{DECK_FIND}</code>
          <p>{t("savesOffline", lang)}</p>
        </details>
      )}
    </div>
  );

  if (!compact) return <section className="panel mb-10 max-w-2xl">{body}</section>;
  return (
    <details ref={menu} className="relative">
      <summary
        className={`text-sm cursor-pointer whitespace-nowrap ${saveData?.errors.length || notStored ? "text-red-400" : "gothic-text-muted"}`}
      >
        {saveData ? t("savesShort", lang, saveData.files) : t("loadSaves", lang)}
      </summary>
      {/* On a phone the menu sits under the top bar across the screen; the language switch is right of it */}
      <div className="panel fixed inset-x-4 top-24 z-30 shadow-2xl sm:absolute sm:inset-x-auto sm:top-auto sm:right-0 sm:mt-2 sm:w-[26rem]">
        {body}
      </div>
    </details>
  );
}
