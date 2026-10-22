import { imageOf, labelOf } from "../lib/gameData";
import { ownerLabel, ownersOf, placeLabel } from "../lib/inventory";
import { t } from "../lib/i18n";
import { inboxItems, KINDS, verdictOf } from "../lib/newItems";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import PageTitle from "./PageTitle";
import { colorOf, Tooltip, tipHandlers, useTip } from "./StashGrid";

// /new: what the finds dropped on the inbox pages of the shared stash are worth (src/lib/newItems.js), read only,
// so it can be checked with the game still running. The inbox pages are picked here, per shared stash, and the
// Organize page uses the same choice.
export default function NewItemsView({ saveData, lang }) {
  const [inboxes, setInboxes] = useStoredState("inbox", {}); // mode -> page numbers
  const [tip, setTip] = useTip();
  const pagesOf = (stash) => {
    const used = saveData.items.filter((r) => r.owner === stash.name && /^shared\d+$/.test(r.place)).map((r) => Number(r.place.slice(6)));
    const last = Math.max(0, ...used, ...(inboxes[stash.mode] ?? []));
    return Array.from({ length: last }, (_, i) => ({ page: i + 1, count: used.filter((p) => p === i + 1).length }));
  };
  // Shared stashes the game reads, with any page in use or picked
  const stashes = ownersOf(saveData).filter((o) => !o.cls && o.mode && pagesOf(o).length);
  const toggle = (mode, page) => {
    const now = inboxes[mode] ?? [];
    setInboxes({ ...inboxes, [mode]: now.includes(page) ? now.filter((p) => p !== page) : [...now, page].sort((a, b) => a - b) });
  };

  const modeOf = new Map(saveData.owners?.map((o) => [o.name, o.mode]));
  const finds = inboxItems(saveData, inboxes).map((r) => ({ r, verdict: verdictOf(r, saveData.items, modeOf.get(r.owner)) }));
  const chosen = Object.values(inboxes).some((pages) => pages.length);

  return (
    <>
      <PageTitle label={t("newItems", lang)} sub={<p className="text-sm gothic-text-muted">{t("newItemsAbout", lang)}</p>} />
      <div className="max-w-3xl space-y-8">
        <section className="space-y-3">
          <div className="section-head">
            <h2>{t("inboxPagesShort", lang)}</h2>
          </div>
          {stashes.length === 0 && <p className="gothic-text-muted">{t("noStash", lang)}</p>}
          {stashes.map((stash) => (
            <div key={stash.name} className="flex flex-wrap items-center gap-2">
              <span className="text-sm mr-2">{ownerLabel(stash.name, lang)}</span>
              {pagesOf(stash).map(({ page, count }) => {
                const on = (inboxes[stash.mode] ?? []).includes(page);
                return (
                  <button
                    key={page}
                    className={`gothic-btn gothic-btn-small ${on ? "" : "gothic-btn-secondary"}`}
                    aria-pressed={on}
                    onClick={() => toggle(stash.mode, page)}
                  >
                    {t("sharedPage", lang, page)} · {count}
                  </button>
                );
              })}
            </div>
          ))}
          {!chosen && stashes.length > 0 && <p className="text-sm">{t("pickInboxPages", lang)}</p>}
        </section>

        {chosen && finds.length === 0 && <p className="gothic-text-muted">{t("inboxEmpty", lang)}</p>}
        {KINDS.map((kind) => {
          const list = finds.filter((f) => f.verdict.kind === kind);
          if (!list.length) return null;
          return (
            <section key={kind}>
              <div className="section-head">
                <h2>{t(`find_${kind}`, lang)}</h2>
                <span className="gothic-text-muted">{list.length}</span>
              </div>
              <div className="rows">
                {list.map(({ r, verdict }, i) => {
                  const show = (e) => setTip({ item: r, rect: e.currentTarget.getBoundingClientRect() });
                  return (
                    <button
                      type="button"
                      key={i}
                      className="flex gap-4 py-2 w-full text-left"
                      {...tipHandlers(show, setTip)}
                      onClick={show}
                    >
                      <img src={imageOf(r)} alt="" loading="lazy" className="w-10 h-10 object-contain shrink-0" style={r.ethereal ? { opacity: 0.6 } : undefined} />
                      <span className="min-w-0 flex-1">
                        <span className="flex justify-between gap-4">
                          <span style={{ color: colorOf(r) }}>
                            {labelOf(r.key, lang)}
                            {r.ethereal && <span className="gothic-text-muted"> · {t("ethereal", lang)}</span>}
                          </span>
                          <span className="text-sm gothic-text-muted shrink-0">{placeLabel(r.place, lang)}</span>
                        </span>
                        <span className="block text-sm gothic-text-muted">{t(`findWhy_${kind}`, lang, verdict)}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </section>
          );
        })}
        {finds.length > 0 && (
          <p className="text-sm">
            <Link to="/organize" className="gothic-text-gold">
              {t("newItemsOrganize", lang)}
            </Link>
          </p>
        )}
      </div>
      {tip && <Tooltip tip={tip} lang={lang} />}
    </>
  );
}
