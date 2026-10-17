import { useRef, useState } from "react";
import { parseSaveFiles } from "../lib/parseSaves";
import { t } from "../lib/i18n";
import { deckSaveFiles, onDeck } from "../lib/deck";

const DECK_FIND = `find ~/.local/share/Steam/steamapps/compatdata -type d -path "*/Saved Games/Diablo II Resurrected"`;

// The file inputs stay focusable (sr-only, not display:none) so saves can be picked from the keyboard.
// Before any saves are loaded it is a panel on the page; after, compact: a menu in the top bar.
export default function SaveLoader({ saveData, onLoad, notStored, lang, compact }) {
  const [busy, setBusy] = useState(false);
  const menu = useRef(null);

  const load = async (files) => {
    if (!files.length) return;
    setBusy(true);
    try {
      onLoad(await parseSaveFiles(files));
      if (menu.current) menu.current.open = false;
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
          <button className="gothic-btn gothic-btn-small" onClick={async () => load(await deckSaveFiles())}>
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
        {t("savesShort", lang, saveData.files)}
      </summary>
      <div className="panel absolute right-0 mt-2 z-30 shadow-2xl" style={{ width: "min(26rem, calc(100vw - 2rem))" }}>
        {body}
      </div>
    </details>
  );
}
