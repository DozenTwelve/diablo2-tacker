import { useState } from "react";
import { labelOf } from "../lib/gameData";
import { locationLines, totalCount } from "../lib/inventory";
import { t } from "../lib/i18n";
import ProgressBar from "./ProgressBar";

// One collection tab: groups of entry keys, each shown as owned (with count) or missing.
// groups: [{ title, keys: [key] }]
export default function CollectionView({ label, groups, owned, lang }) {
  const [missingOnly, setMissingOnly] = useState(false);
  const all = groups.flatMap((g) => g.keys);

  return (
    <div className="space-y-6">
      <ProgressBar label={label} owned={all.filter((k) => owned.has(k)).length} total={all.length} />
      <label className="gothic-checkbox">
        <input type="checkbox" checked={missingOnly} onChange={(e) => setMissingOnly(e.target.checked)} />
        <span>{t("missingOnly", lang)}</span>
      </label>
      {groups.map(({ title, keys }) => {
        const shown = missingOnly ? keys.filter((k) => !owned.has(k)) : keys;
        if (!shown.length) return null;
        return (
          <div key={title} className="gothic-card">
            <h3 className="gothic-text-gold mb-4">
              {title}
              <span className="gothic-text-muted ml-4">
                ({keys.filter((k) => owned.has(k)).length} / {keys.length})
              </span>
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {shown.map((key) => {
                const records = owned.get(key);
                return (
                  <div
                    key={key}
                    className={records ? "gothic-text-gold" : "gothic-text-muted"}
                    title={records ? locationLines(records, lang).map((l) => `${l.text} ×${l.count}`).join("\n") : t("missing", lang)}
                  >
                    {labelOf(key, lang)}
                    {records && <span className="ml-2 text-sm">×{totalCount(records)}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
