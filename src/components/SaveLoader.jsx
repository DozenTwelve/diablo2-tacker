import { useState } from "react";
import { parseSaveFiles } from "../lib/parseSaves";
import { t } from "../lib/i18n";

export default function SaveLoader({ saveData, onLoad, lang }) {
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
        <label className="gothic-btn gothic-btn-small" style={{ cursor: "pointer", margin: 0 }}>
          {t("pickFolder", lang)}
          <input type="file" webkitdirectory="" multiple onChange={handleFiles} className="gothic-hidden" />
        </label>
        <label className="gothic-btn gothic-btn-secondary gothic-btn-small" style={{ cursor: "pointer", margin: 0 }}>
          {t("pickFiles", lang)}
          <input type="file" accept=".d2s,.d2i" multiple onChange={handleFiles} className="gothic-hidden" />
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
      {saveData?.errors.map((err) => (
        <p key={err} className="text-sm text-red-400">
          {err}
        </p>
      ))}
      <p className="text-xs gothic-text-muted">{t("privacy", lang)}</p>
    </div>
  );
}
