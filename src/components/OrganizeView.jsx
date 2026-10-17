import { useEffect, useMemo, useState } from "react";
import { codeOfNumber, labelOf } from "../lib/gameData";
import { deckSaveFiles } from "../lib/deck";
import { roleOf } from "../lib/inventory";
import { t } from "../lib/i18n";
import { modeOfCharacter, modeOfStash, organizeFiles } from "../lib/organize";
import { loadParser, statsOf } from "../lib/parseSaves";
import { describeStats } from "../lib/stats";
import { Link } from "../lib/router";
import { useStoredState } from "../lib/useStoredState";
import PageTitle from "./PageTitle";

const modeLabel = (mode, lang) => {
  const [core, version] = mode.split(":");
  return t(core === "HardCore" ? "hardcore" : "softcore", lang) + (version === "Legacy" ? t("legacyMode", lang) : "");
};
const toBase64 = (bytes) => {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
};

// /organize, on the Steam Deck only: sort the mules and the chosen inbox pages of the shared stash
// (src/lib/organize.js), show what would happen, then have the plugin back up the save folder and write.
export default function OrganizeView({ onWritten, lang }) {
  const [roles] = useStoredState("roles", {});
  const [inboxes, setInboxes] = useStoredState("inbox", {}); // mode -> page numbers
  const [files, setFiles] = useState(null); // [{ name, bytes }] as read from the Deck
  const [wasm, setWasm] = useState(null);
  const [mode, setMode] = useState(null);
  const [state, setState] = useState({}); // { plan, error, busy, backup }

  useEffect(() => {
    Promise.all([deckSaveFiles(), loadParser()]).then(async ([list, parser]) => {
      setFiles(await Promise.all(list.map(async (f) => ({ name: f.name, bytes: new Uint8Array(await f.arrayBuffer()) }))));
      setWasm(parser);
    });
  }, [state.backup]);

  // Characters (with their mode) and shared stash pages per mode, from the files as they are now
  const saves = useMemo(() => {
    if (!files || !wasm) return null;
    return files.map(({ name, bytes }) => {
      if (/\.d2s$/i.test(name)) {
        const json = JSON.parse(wasm.parseD2s(bytes));
        return { name: name.slice(0, -4), mode: modeOfCharacter(json), level: json.character.level };
      }
      const pages = JSON.parse(wasm.parseD2i(bytes)).flatMap((tab, i) => (tab.tab_type === "Normal" ? [{ page: i + 1, items: tab.items.length }] : []));
      return { name: name.slice(0, -4), mode: modeOfStash(name), pages };
    });
  }, [files, wasm]);
  if (!saves) return <PageTitle label={t("organize", lang)} />;

  const modes = [...new Set(saves.filter((s) => s.level != null).map((s) => s.mode))].sort();
  const current = mode ?? (modes.includes("SoftCore:Modern") ? "SoftCore:Modern" : modes[0]);
  const pages = saves.find((s) => s.pages && s.mode === current)?.pages ?? [];
  const inbox = (inboxes[current] ?? []).filter((n) => pages.some((p) => p.page === n));
  const mules = saves.filter((s) => s.level != null && s.mode === current && roleOf(s, roles) === "mule").map((s) => s.name);
  const options = { mode: current, mules, inbox };
  const setInbox = (list) => (setInboxes({ ...inboxes, [current]: list }), setState({}));

  const preview = () => {
    try {
      setState({ plan: organizeFiles(files, wasm, options) });
    } catch (e) {
      setState({ error: t("notWritten", lang, e.message ?? e) });
    }
  };
  const write = async () => {
    setState({ ...state, busy: true });
    try {
      // Organized again from the files as read, so what is written is exactly what was checked
      const { files: out } = organizeFiles(files, wasm, options);
      const response = await fetch("/api/write", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ files: out.map((f) => ({ name: f.name, template: f.template, data: toBase64(f.bytes) })) }),
      });
      const result = await response.json();
      if (result.running) setState({ ...state, error: t("gameRunning", lang) });
      else if (!response.ok) setState({ error: t("writeFailed", lang, result.error) });
      else {
        setState({ backup: result.backup });
        onWritten();
      }
    } catch (e) {
      setState({ error: t("writeFailed", lang, e.message ?? e) });
    }
  };

  const report = state.plan?.report;
  const names = (keys) => keys.map((k) => labelOf(k, lang)).join(t("listSeparator", lang));
  const trash = report?.moves.filter((m) => m.group === "TRASH" && m.stash) ?? [];
  return (
    <>
      <PageTitle label={t("organize", lang)} />
      <div className="max-w-3xl space-y-8">
        {modes.length > 1 && (
          <div className="segmented" role="group">
            {modes.map((m) => (
              <button key={m} className={m === current ? "active" : ""} onClick={() => (setMode(m), setState({}))}>
                {modeLabel(m, lang)}
              </button>
            ))}
          </div>
        )}
        <section>
          <div className="section-head">
            <h2>{t("inboxPages", lang)}</h2>
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {pages.map(({ page, items }) => (
              <label key={page} className="gothic-checkbox">
                <input
                  type="checkbox"
                  checked={inbox.includes(page)}
                  onChange={(e) => setInbox(e.target.checked ? [...inbox, page].sort((a, b) => a - b) : inbox.filter((n) => n !== page))}
                />
                <span>
                  {t("sharedPage", lang, page)} <span className="gothic-text-muted">{t("itemCount", lang, items)}</span>
                </span>
              </label>
            ))}
          </div>
        </section>
        <section>
          <div className="section-head">
            <h2>{t("mules", lang)}</h2>
            <Link to="/characters" className="text-sm gothic-text-muted">
              {t("changeMules", lang)}
            </Link>
          </div>
          <p className="text-sm break-words">{t("mulesToSort", lang, mules.length, mules.join(t("listSeparator", lang)))}</p>
        </section>
        <button className="gothic-btn" disabled={!inbox.length || !mules.length} onClick={preview}>
          {t("preview", lang)}
        </button>
        {!inbox.length && <p className="text-sm gothic-text-muted">{t("pickInbox", lang)}</p>}
        {state.error && <p className="text-red-400">{state.error}</p>}
        {state.backup && <p className="gothic-text-gold break-all">{t("written", lang, state.backup)}</p>}
        {report && (
          <section className="space-y-3">
            <div className="section-head">
              <h2>{t("preview", lang)}</h2>
            </div>
            <p>{t("reportMules", lang, report.newMules.length)}</p>
            <p>
              {t("reportMuseum", lang, report.inbox.museum.length)}
              {report.inbox.museum.length > 0 && <span className="gothic-text-gold">{t("colon", lang) + names(report.inbox.museum)}</span>}
            </p>
            <p>
              {t("reportDup", lang, report.inbox.dup.length)}
              {report.inbox.dup.length > 0 && <span className="gothic-text-muted">{t("colon", lang) + names(report.inbox.dup)}</span>}
            </p>
            <p>{t("reportTrash", lang, report.inbox.trash.length)}</p>
            {trash.length > 0 && (
              <ul className="text-sm pl-4 space-y-1">
                {trash.map((m, i) => (
                  <li key={i}>
                    {labelOf(m.key, lang)}
                    <span style={{ color: "var(--color-accent-blue)" }}>
                      {t("colon", lang)}
                      {describeStats(statsOf(m.item, codeOfNumber(m.item.code)), lang).join(t("listSeparator", lang))}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <p>{t("reportOther", lang, report.inbox.other)}</p>
            {report.dropped.length > 0 && <p className="gothic-text-muted">{t("reportDropped", lang, report.dropped.length)}</p>}
            <p className="text-sm gothic-text-muted pt-2">{t("writeWarning", lang)}</p>
            <button className="gothic-btn" disabled={state.busy} onClick={write}>
              {t(state.busy ? "writing" : "confirmWrite", lang)}
            </button>
          </section>
        )}
      </div>
    </>
  );
}
