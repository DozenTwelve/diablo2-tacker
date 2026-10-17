import { useState } from "react";
import { parseSaveFiles } from "../lib/parseSaves";
import { t } from "../lib/i18n";

const DECK_FIND = `find ~/.local/share/Steam/steamapps/compatdata -type d -path "*/Saved Games/Diablo II Resurrected"`;

// The file inputs stay focusable (sr-only, not display:none) so saves can be picked from the keyboard
export default function SaveLoader({ saveData, onLoad, notStored, lang }) {
  const [busy, setBusy] = useState(false);

  const handleFiles = async (e) => {
    const files = [...e.target.files];
    e.target.value = "";
    if (!files.length) return;
    setBusy(true);
    try {
      onLoad(await parseSaveFiles(files));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="gothic-card space-y-3">
      <div className="flex flex-wrap gap-3 items-center">
        <label className="gothic-btn gothic-btn-small focus-within:outline focus-within:outline-2" style={{ cursor: "pointer", margin: 0 }}>
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
        {saveData && (
          <button className="gothic-btn gothic-btn-secondary gothic-btn-small" onClick={() => onLoad(null)}>
            {t("clear", lang)}
          </button>
        )}
      </div>
      <p className="text-sm">
        {busy
          ? t("parsing", lang)
          : saveData
            ? t("loaded", lang, saveData.files, saveData.items.length, new Date(saveData.loadedAt).toLocaleString())
            : t("noSaves", lang)}
      </p>
      {notStored && <p className="text-sm text-red-400">{t("notStored", lang)}</p>}
      {saveData?.errors.map((err, i) => (
        <p key={i} className="text-sm text-red-400">
          {err}
        </p>
      ))}
      <p className="text-xs gothic-text-muted">{t("privacy", lang)}</p>
      <details className="text-xs gothic-text-muted space-y-2">
        <summary style={{ cursor: "pointer" }}>{t("whereSaves", lang)}</summary>
        <p>
          Windows: <code className="select-all">%USERPROFILE%\Saved Games\Diablo II Resurrected</code>
        </p>
        <p>{t("savesDeck", lang)}</p>
        <code className="block select-all break-all">{DECK_FIND}</code>
        <p>{t("savesOffline", lang)}</p>
      </details>
    </div>
  );
}
