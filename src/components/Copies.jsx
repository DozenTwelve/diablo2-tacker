import { useEffect, useId, useRef } from "react";
import { baseNameOf, imageOf, labelOf } from "../lib/gameData";
import { ownerLabel, placeLabel, statLines, totalCount } from "../lib/inventory";
import { copyScore } from "../lib/props";
import { t } from "../lib/i18n";
import { colorOf, STAT_COLOR } from "./StashGrid";

// A native <dialog> with a title and a close button: Esc and the backdrop close it
export function Modal({ open, title, onClose, lang, children }) {
  const ref = useRef(null);
  const titleId = useId();
  useEffect(() => {
    if (open) ref.current?.showModal();
    else ref.current?.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      aria-labelledby={titleId}
      onClick={(e) => e.target === ref.current && onClose()}
      className="p-0 w-full max-w-3xl text-sm"
      style={{ background: "rgba(12, 12, 12, 0.97)", border: "1px solid var(--color-border-metal)", color: "var(--color-text-primary)" }}
    >
      {open && (
        <div className="p-4 space-y-3">
          <div className="flex items-center justify-between gap-4">
            <h3 id={titleId} className="gothic-text-gold text-lg">
              {title}
            </h3>
            <button className="gothic-tab-btn" style={{ padding: "0.2rem 0.8rem" }} aria-label={t("close", lang)} onClick={onClose}>
              ✕
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}

// Every copy of one catalog entry, best rolls first: where it is, its base, and its stats. records: null when closed.
export default function Copies({ entryKey, records, onClose, lang }) {
  const copies = (records ?? [])
    .map((r) => ({ r, score: copyScore(r) }))
    .sort((a, b) => (b.score ?? 101) - (a.score ?? 101));

  return (
    <Modal
      open={Boolean(records)}
      onClose={onClose}
      lang={lang}
      title={
        records && (
          <>
            {labelOf(entryKey, lang)}
            <span className="gothic-text-muted ml-3">×{totalCount(records)}</span>
          </>
        )
      }
    >
      <div className="grid sm:grid-cols-2 gap-3">
        {copies.map(({ r, score }, i) => (
          <div key={i} className="flex gap-3 p-2" style={{ background: "rgba(0, 0, 0, 0.5)", border: "1px solid #333" }}>
            <img src={imageOf(r)} alt="" className="w-12 h-20 object-contain shrink-0" />
            <div className="min-w-0">
              <div className="gothic-text-gold">
                {ownerLabel(r.owner, lang)} · {placeLabel(r.place, lang)}
                {r.count > 1 && ` ×${r.count}`}
                {score != null && <span className="ml-2 gothic-text-muted">{score}%</span>}
              </div>
              <div style={{ color: colorOf(r) }}>
                {baseNameOf(r.code, lang)}
                {r.ethereal && ` · ${t("ethereal", lang)}`}
                {r.sockets > 0 && ` · ${t("sockets", lang, r.sockets)}`}
              </div>
              {statLines(r, lang).map((line, j) => (
                <div key={j} style={{ color: STAT_COLOR }}>
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}
